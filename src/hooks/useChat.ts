import { useEffect, useState, useCallback, useRef } from "react";
import { vartaWS } from "../lib/ws";
import { conversationsApi, messagesApi, profilesApi, api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { Conversation, Message } from "../types/database";

// ─── Conversations ────────────────────────────────────────────────────────────

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);

    const { data, error } = await conversationsApi.list();
    if (error) console.error("Error loading conversations:", error);
    setConversations((data as Conversation[]) ?? []);
    if (!silent) setLoading(false);
  }, [user]);

  useEffect(() => {
    load(false);
    const silentReload = () => load(true);

    // WebSocket: listen for new messages to bubble conversation up
    const unsubMsg = vartaWS.on("conversations", "new_message", (payload: any) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversation_id);
        if (idx === -1) {
          silentReload();
          return prev;
        }
        const updated = [...prev];
        const item: Conversation = {
          ...updated[idx],
          last_message_at: payload.created_at,
          last_message: payload as Message,
        };
        updated.splice(idx, 1);
        return [item, ...updated];
      });
    });

    const unsubConv = vartaWS.on("conversations", "updated", silentReload);
    const unsubProfile = vartaWS.on("profiles", "updated", silentReload);

    return () => {
      unsubMsg();
      unsubConv();
      unsubProfile();
    };
  }, [load, user]);

  return { conversations, loading, reload: () => load(false) };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useMessages(conversationId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!conversationId || !user) return;
    if (!silent) setLoading(true);
    const { data, error } = await messagesApi.list(conversationId);
    if (error) console.error("Error loading messages:", error);
    setMessages((data as Message[]) ?? []);
    if (!silent) setLoading(false);
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !user) return;
    load(false);

    // WebSocket events for this conversation
    const unsubInsert = vartaWS.on(`messages:${conversationId}`, "insert", (payload: any) => {
      const newMsg = payload as Message;
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        // Replace matching optimistic temp message
        const tempIdx = prev.findIndex(
          (m) =>
            m.id.startsWith("temp-") &&
            m.sender_id === newMsg.sender_id &&
            m.type === newMsg.type &&
            (m.content === newMsg.content ||
              (m as any).gif_url === (newMsg as any).gif_url ||
              (m as any).media_url === (newMsg as any).media_url),
        );
        if (tempIdx !== -1) {
          const next = [...prev];
          next[tempIdx] = newMsg;
          return next;
        }
        return [...prev, newMsg];
      });
    });

    const unsubUpdate = vartaWS.on(`messages:${conversationId}`, "update", (payload: any) => {
      const updated = payload as any;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === updated.id);
        if (idx === -1) return prev;
        if (updated.is_deleted) return prev.filter((m) => m.id !== updated.id);
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          content: updated.content,
          is_edited: updated.is_edited,
          is_deleted: updated.is_deleted,
          is_starred: updated.is_starred,
          is_pinned: updated.is_pinned,
        } as Message;
        return next;
      });
    });

    const unsubReactionAdd = vartaWS.on(`messages:${conversationId}`, "reaction_add", (payload: any) => {
      const r = payload as any;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === r.message_id);
        if (idx === -1) return prev;
        const existing = (prev[idx].reactions ?? []) as any[];
        if (existing.find((x: any) => x.id === r.id)) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], reactions: [...existing, r] } as Message;
        return next;
      });
    });

    const unsubReactionDel = vartaWS.on(`messages:${conversationId}`, "reaction_remove", (payload: any) => {
      const removed = payload as any;
      setMessages((prev) =>
        prev.map((msg) => {
          const existing = (msg.reactions ?? []) as any[];
          if (!existing.find((r: any) => r.id === removed.id)) return msg;
          return { ...msg, reactions: existing.filter((r: any) => r.id !== removed.id) } as Message;
        }),
      );
    });

    return () => {
      unsubInsert();
      unsubUpdate();
      unsubReactionAdd();
      unsubReactionDel();
    };
  }, [conversationId, user, load]);

  const sendMessage = async (
    content: string,
    type: Message["type"] = "text",
    extras?: Partial<Message>,
  ) => {
    if (!conversationId || !user) return;
    if (type === "text" && !content.trim()) return;

    // Optimistic UI
    const tempId = `temp-${crypto.randomUUID()}`;
    const newMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.uid,
      type,
      content: content.trim() || null,
      created_at: new Date().toISOString(),
      is_edited: false,
      is_deleted: false,
      sender: {
        id: user.uid,
        display_name: user.displayName || "You",
        avatar_url: user.photoURL || null,
      },
      ...extras,
    };

    setMessages((prev) => [...prev, newMessage as unknown as Message]);

    const { error } = await messagesApi.send(conversationId, {
      content: content ? content.trim() : undefined,
      type,
      ...extras,
    } as any);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw new Error(error);
    }

    // Fire-and-forget push notification (server handles push internally)
  };

  const editMessage = async (messageId: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content: newContent.trim(), is_edited: true } : m)),
    );
    await messagesApi.update(messageId, newContent.trim());
  };

  const deleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await messagesApi.delete(messageId);
  };

  return { messages, loading, sendMessage, editMessage, deleteMessage };
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

export function useTyping(conversationId: string | undefined, myId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId || !myId) return;

    const unsub = vartaWS.on(`typing:${conversationId}`, "typing", (payload: any) => {
      const { uid, typing } = payload as { uid: string; typing: boolean };
      if (uid === myId) return;
      setTypingUsers((prev) => {
        if (typing) return prev.includes(uid) ? prev : [...prev, uid];
        return prev.filter((u) => u !== uid);
      });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsub();
    };
  }, [conversationId, myId]);

  const sendTyping = useCallback(() => {
    if (!conversationId || !myId) return;
    // Send typing event via WS
    (vartaWS as any).send?.({
      type: "broadcast",
      channel: `typing:${conversationId}`,
      event: "typing",
      payload: { uid: myId, cid: conversationId, typing: true },
    });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      (vartaWS as any).send?.({
        type: "broadcast",
        channel: `typing:${conversationId}`,
        event: "typing",
        payload: { uid: myId, cid: conversationId, typing: false },
      });
    }, 2500);
  }, [conversationId, myId]);

  return { typingUsers, sendTyping };
}

export function useGlobalTyping(myId: string | undefined) {
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!myId) return;

    const unsub = vartaWS.on("typing_global", "typing", (payload: any) => {
      const { uid, cid, typing } = payload as { uid: string; cid: string; typing: boolean };
      if (uid === myId) return;
      setTypingMap((prev) => {
        const existing = prev[cid] ?? [];
        if (typing) {
          if (existing.includes(uid)) return prev;
          return { ...prev, [cid]: [...existing, uid] };
        } else {
          const next = existing.filter((u) => u !== uid);
          if (next.length === existing.length) return prev;
          return { ...prev, [cid]: next };
        }
      });
    });

    return () => { unsub(); };
  }, [myId]);

  return { typingMap, syncTypingChannels: (_ids: string[]) => { /* no-op */ } };
}

// ─── Conversation helpers ──────────────────────────────────────────────────────

export async function createDirectConversation(otherUserId: string, _myUserId: string) {
  const { data, error } = await conversationsApi.create({
    type: "direct",
    memberIds: [otherUserId],
  });
  if (error) throw new Error(error);
  return { id: (data as any).id as string };
}

export async function createGroupConversation(title: string, memberIds: string[], _myUserId: string) {
  const { data, error } = await conversationsApi.create({
    type: "group",
    title,
    memberIds,
  });
  if (error) throw new Error(error);
  return { id: (data as any).id as string };
}

// ─── User search ───────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  if (!query.trim()) return [];
  const { data } = await profilesApi.search(query.trim());
  return data ?? [];
}

// ─── Star / Pin / Forward ─────────────────────────────────────────────────────

export async function starMessage(messageId: string, starred: boolean) {
  await messagesApi.star(messageId, starred);
}

export async function pinMessage(messageId: string, pinned: boolean) {
  await api.patch(`/api/messages/${messageId}`, { is_pinned: pinned });
}

export async function forwardMessage(
  messageId: string,
  toConversationId: string,
  _senderId: string,
) {
  // Get original message and re-send to target conversation
  const { data: orig } = await (await import("../lib/api")).api.get<any>(`/api/messages/${messageId}`);
  if (!orig) return;
  await messagesApi.send(toConversationId, {
    type: orig.type,
    content: orig.content,
    media_url: orig.media_url,
    gif_url: orig.gif_url,
  });
}

// ─── Starred messages ─────────────────────────────────────────────────────────

export function useStarredMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (await import("../lib/api")).starredApi.list();
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  return { messages, loading, reload: load };
}

// ─── Pinned messages ──────────────────────────────────────────────────────────

export function usePinnedMessages(conversationId: string | undefined) {
  const [pinned, setPinned] = useState<Message[]>([]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await (await import("../lib/api")).api.get<any[]>(
      `/api/conversations/${conversationId}/messages?pinned=true`,
    );
    setPinned((data as Message[]) ?? []);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  return { pinned, reload: load };
}

// ─── Mark messages read ───────────────────────────────────────────────────────

export async function markMessagesRead(messageIds: string[], _userId: string) {
  if (!messageIds.length) return;
  await (await import("../lib/api")).api.post("/api/messages/read", { messageIds });
}

// ─── Global message search ────────────────────────────────────────────────────

export async function searchMessages(query: string, _userId: string) {
  if (!query.trim()) return [];
  const { data } = await (await import("../lib/api")).api.get<any[]>(
    `/api/messages/search?q=${encodeURIComponent(query.trim())}`,
  );
  return (data as Message[]) ?? [];
}
