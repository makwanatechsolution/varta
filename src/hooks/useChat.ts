import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
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

    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberships?.length) {
      setConversations([]);
      if (!silent) setLoading(false);
      return;
    }

    const ids = memberships.map((m) => m.conversation_id);
    const { data: convs, error } = await supabase
      .from("conversations")
      .select(`
        *,
        members:conversation_members(
          id, user_id, role,
          profile:profiles(id, display_name, avatar_url, presence, last_seen, custom_status)
        )
      `)
      .in("id", ids)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error loading conversations:", error);
    }

    if (!convs?.length) {
      setConversations([]);
      if (!silent) setLoading(false);
      return;
    }

    // ── BUG-1 FIX: Single batch query for all last messages (was N+1 queries) ──
    // Fetch ALL last messages across ALL conversation IDs in one round-trip,
    // then join them in memory — eliminates N individual supabase.from() calls.
    const { data: lastMessages } = await supabase
      .from("messages")
      .select("id, content, type, created_at, sender_id, conversation_id")
      .in("conversation_id", ids)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(ids.length * 2); // overfetch slightly to guarantee at least 1 per conv

    // Build a map: conversationId → latest message
    const lastMsgMap = new Map<string, any>();
    if (lastMessages) {
      for (const msg of lastMessages) {
        if (!lastMsgMap.has(msg.conversation_id)) {
          lastMsgMap.set(msg.conversation_id, msg);
        }
      }
    }

    const processedData = (convs as any[]).map((conv: any) => {
      const lastMsg = lastMsgMap.get(conv.id) ?? null;
      return {
        ...conv,
        last_message: lastMsg,
        last_message_at: lastMsg?.created_at || conv.last_message_at,
      };
    });

    setConversations(processedData as Conversation[]);
    if (!silent) setLoading(false);
  }, [user]);

  useEffect(() => {
    load(false);

    const silentReload = () => load(true);

    // ── BUG-2 FIX: user-scoped channel name prevents cross-tab/cross-user
    //    deduplication. Supabase deduplicates channels by name — a static
    //    "conversations_list" silently drops the second subscription when
    //    the same user opens two tabs (or two users share a test session).
    const channel = supabase
      .channel(`conversations_list:${user!.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new as any;
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === newMsg.conversation_id);
          if (idx === -1) {
            // New conversation we don't know about yet — reload to pick it up
            silentReload();
            return prev;
          }
          // Bubble the conversation to the top and update its last_message preview
          const updated = [...prev];
          const item: Conversation = {
            ...updated[idx],
            last_message_at: newMsg.created_at,
            last_message: newMsg as Message,
          };
          updated.splice(idx, 1);
          return [item, ...updated];
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, silentReload)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, silentReload)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        sender:profiles!sender_id(id, display_name, avatar_url),
        reactions:message_reactions(id, emoji, user_id, profile:profiles(id, display_name)),
        reply_to:messages!reply_to_id(id, content, type, sender:profiles!sender_id(id, display_name))
      `)
      .eq("conversation_id", conversationId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error loading messages:", error);
    }

    setMessages((data as Message[]) ?? []);
    if (!silent) setLoading(false);
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !user) return;
    load(false);

    let recoveryTimer: number | undefined;
    const recover = () => {
      window.clearTimeout(recoveryTimer);
      // Postgres Changes is carried over Supabase Realtime's WebSocket. A
      // reconnect can miss an event while the socket is unavailable, so make
      // one silent read after it is established to close that gap.
      recoveryTimer = window.setTimeout(() => load(true), 150);
    };

    const channel = supabase
      .channel(`messages:${conversationId}`)

      // ── INSERT: new message arrives → append or replace optimistic temp ──
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
        let senderData = null;
        if (payload.new.sender_id) {
          const res = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();
          senderData = res.data;
        }

        const newMsg = {
          ...payload.new,
          sender: senderData,
          reactions: [],
          reply_to: null,
        } as unknown as Message;

        setMessages(prev => {
          // deduplicate: already in list
          if (prev.find(m => m.id === newMsg.id)) return prev;

          // Replace matching optimistic temp message
          const tempIdx = prev.findIndex(
            (m) =>
              m.id.startsWith("temp-") &&
              m.sender_id === newMsg.sender_id &&
              m.type === newMsg.type &&
              (m.content === newMsg.content ||
                (m as any).gif_url === (newMsg as any).gif_url ||
                (m as any).media_url === (newMsg as any).media_url)
          );

          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = newMsg;
            return next;
          }

          return [...prev, newMsg];
        });
      })

      // ── UPDATE: edit / delete / star / pin → patch in-place, zero reload ──
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const updated = payload.new as any;
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === updated.id);
          if (idx === -1) return prev;

          if (updated.is_deleted) {
            return prev.filter(m => m.id !== updated.id);
          }

          const next = [...prev];
          next[idx] = {
            ...next[idx],           // preserve enriched sender / reactions / reply_to
            content: updated.content,
            is_edited: updated.is_edited,
            is_deleted: updated.is_deleted,
            is_starred: updated.is_starred,
            is_pinned: updated.is_pinned,
          } as Message;
          return next;
        });
      })

      // ── REACTION INSERT: append reaction object in-place ──
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "message_reactions"
      }, async (payload) => {
        const r = payload.new as any;
        let profile = null;
        if (r.user_id) {
          const res = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', r.user_id)
            .single();
          profile = res.data;
        }
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === r.message_id);
          if (idx === -1) return prev;
          const existing = (prev[idx].reactions ?? []) as any[];
          if (existing.find((x: any) => x.id === r.id)) return prev;
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            reactions: [...existing, { ...r, profile }],
          } as Message;
          return next;
        });
      })

      // ── REACTION DELETE: remove reaction object in-place ──
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "message_reactions"
      }, (payload) => {
        const removed = payload.old as any;
        setMessages(prev => prev.map(msg => {
          const existing = (msg.reactions ?? []) as any[];
          if (!existing.find((r: any) => r.id === removed.id)) return msg;
          return { ...msg, reactions: existing.filter((r: any) => r.id !== removed.id) } as Message;
        }));
      })

      .subscribe((status) => {
        if (status === "SUBSCRIBED") recover();
      });

    return () => {
      window.clearTimeout(recoveryTimer);
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, load]);

  const sendMessage = async (
    content: string,
    type: Message["type"] = "text",
    extras?: Partial<Message>,
  ) => {
    if (!conversationId || !user) return;
    if (type === "text" && !content.trim()) return;

    // Optimistic UI — instant append before DB write
    const tempId = `temp-${crypto.randomUUID()}`;
    const newMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      type,
      content: content.trim() || null,
      created_at: new Date().toISOString(),
      is_edited: false,
      is_deleted: false,
      sender: {
        id: user.id,
        display_name: user.user_metadata?.display_name || "You",
        avatar_url: user.user_metadata?.avatar_url || null,
      },
      ...extras,
    };

    setMessages((prev) => [...prev, newMessage as unknown as Message]);

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      type,
      content: content.trim() || null,
      ...extras,
    });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }

    // Fire-and-forget push notification
    try {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      const recipientIds = (members ?? [])
        .map((m) => m.user_id)
        .filter((id) => id !== user.id);

      if (recipientIds.length > 0) {
        const senderName = user.user_metadata?.display_name || "Someone";
        fetch("/api/sendMessagePush", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            senderId: user.id,
            senderName,
            preview: type === "text" ? (content.trim() || "Sent a message") : `Sent a ${type}`,
            recipientIds,
          }),
        }).catch((err) => console.warn("Push notification failed:", err));
      }
    } catch (e) {
      console.warn("Error dispatching push:", e);
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    // Optimistic in-place patch — no scroll, no reload
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, content: newContent.trim(), is_edited: true } : m
    ));
    await supabase
      .from("messages")
      .update({ content: newContent.trim(), is_edited: true })
      .eq("id", messageId);
  };

  const deleteMessage = async (messageId: string) => {
    // Optimistic remove — message vanishes instantly
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await supabase.from("messages").update({ is_deleted: true }).eq("id", messageId);
  };

  return { messages, loading, sendMessage, editMessage, deleteMessage };
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

// Global broadcast channel name — shared between sendTyping and useGlobalTyping.
// Using broadcast (not presence) means no channel-already-subscribed conflicts.
const TYPING_BROADCAST_CHANNEL = "typing_broadcasts";

// Hook for a specific conversation — presence for in-room indicator
export function useTyping(conversationId: string | undefined, myId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId || !myId) return;

    // Per-room PRESENCE channel — only used for in-room typing bubble.
    // useGlobalTyping does NOT touch this channel, so no after-subscribe conflict.
    const ch = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: myId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ typing: boolean }>();
      const typers = Object.entries(state)
        .filter(([uid, payloads]) => uid !== myId && (payloads as { typing: boolean }[])[0]?.typing)
        .map(([uid]) => uid);
      setTypingUsers(typers);
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ch.track({ typing: false }).catch(() => {});
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [conversationId, myId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !conversationId || !myId) return;

    // 1. Track on per-room presence channel → in-room typing bubble
    channelRef.current.track({ typing: true });

    // 2. Send broadcast event → sidebar typing indicator via useGlobalTyping
    //    We fire-and-forget on the shared broadcast channel.
    //    Supabase broadcast doesn't require the channel to be "owned" — any
    //    subscribed channel can send events, and sending without being
    //    subscribed also works (just delivers to all subscribers).
    supabase
      .channel(TYPING_BROADCAST_CHANNEL)
      .send({
        type: "broadcast",
        event: "typing",
        payload: { uid: myId, cid: conversationId, typing: true },
      })
      .catch(() => {});

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      channelRef.current?.track({ typing: false });
      supabase
        .channel(TYPING_BROADCAST_CHANNEL)
        .send({
          type: "broadcast",
          event: "typing",
          payload: { uid: myId, cid: conversationId, typing: false },
        })
        .catch(() => {});
    }, 2500);
  }, [conversationId, myId]);

  return { typingUsers, sendTyping };
}

// Hook for sidebar — listens ONLY to broadcast events, never touches presence.
// No channel name conflicts with useTyping's presence channel.
export function useGlobalTyping(myId: string | undefined) {
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!myId) return;

    // Single broadcast channel for all typing sidebar signals.
    // Broadcast channels have no presence restriction — safe to add listeners
    // at any time without the "after subscribe" error.
    const ch = supabase.channel(TYPING_BROADCAST_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    ch.on(
      "broadcast",
      { event: "typing" },
      ({ payload }: { payload: { uid: string; cid: string; typing: boolean } }) => {
        const { uid, cid, typing } = payload;
        if (uid === myId) return; // ignore own events
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
      }
    );

    ch.subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [myId]);

  // Simple map — no syncTypingChannels needed (broadcast handles all convs at once)
  return { typingMap, syncTypingChannels: (_ids: string[]) => { /* no-op — broadcast covers all */ } };
}

// ─── Conversation helpers ──────────────────────────────────────────────────────

export async function createDirectConversation(otherUserId: string, myUserId: string) {
  // Check if a direct conversation already exists
  const { data: existing } = await supabase
    .from("conversation_members")
    .select("conversation_id, conversation:conversations!inner(type)")
    .eq("user_id", myUserId);

  const myConvIds = existing?.map((m: any) => m.conversation_id as string) ?? [];

  if (myConvIds.length) {
    const { data: sharedDirect } = await supabase
      .from("conversation_members")
      .select("conversation_id, conversation:conversations!inner(type)")
      .eq("user_id", otherUserId)
      .in("conversation_id", myConvIds);

    const directMatch = sharedDirect?.find(
      (m: any) => m.conversation?.type === "direct",
    );
    if (directMatch) return { id: (directMatch as any).conversation_id as string };
  }

  const convId = crypto.randomUUID();

  const { error } = await supabase
    .from("conversations")
    .insert({ id: convId, type: "direct", created_by: myUserId });

  if (error) throw error;

  // Insert owner first to satisfy RLS for adding other members
  await supabase.from("conversation_members").insert({
    conversation_id: convId,
    user_id: myUserId,
    role: "owner"
  });
  
  // Then insert the other member
  await supabase.from("conversation_members").insert({
    conversation_id: convId,
    user_id: otherUserId,
    role: "member"
  });

  return { id: convId };
}

export async function createGroupConversation(title: string, memberIds: string[], myUserId: string) {
  const convId = crypto.randomUUID();

  const { error } = await supabase
    .from("conversations")
    .insert({ id: convId, type: "group", title, created_by: myUserId });

  if (error) throw error;

  // Insert owner first
  await supabase.from("conversation_members").insert({
    conversation_id: convId,
    user_id: myUserId,
    role: "owner"
  });

  // Insert others
  const otherMembers = memberIds.map((uid) => ({
    conversation_id: convId,
    user_id: uid,
    role: "member",
  }));

  if (otherMembers.length > 0) {
    await supabase.from("conversation_members").insert(otherMembers);
  }

  return { id: convId };
}

// ─── User search ───────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  if (!query.trim()) return [];
  const normalized = query.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);

  const [byName, byUsername, byId] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, presence")
      .ilike("display_name", `%${normalized}%`)
      .limit(20),
    supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, presence")
      .ilike("username", `%${normalized}%`)
      .limit(20),
    isUuid
      ? supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, presence")
          .eq("id", normalized)
          .limit(1)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const merged = [...(byName.data ?? []), ...(byUsername.data ?? []), ...(byId.data ?? [])];
  const deduped = Array.from(new Map(merged.map((profile) => [profile.id, profile])).values());

  return deduped.slice(0, 20);
}

// ─── Star / Pin / Forward ─────────────────────────────────────────────────────

export async function starMessage(messageId: string, starred: boolean) {
  await supabase.from("messages").update({ is_starred: starred }).eq("id", messageId);
}

export async function pinMessage(messageId: string, pinned: boolean) {
  await supabase.from("messages").update({ is_pinned: pinned }).eq("id", messageId);
}

export async function forwardMessage(
  messageId: string,
  toConversationId: string,
  senderId: string,
) {
  const { data: orig } = await supabase
    .from("messages")
    .select("type,content,media_url,gif_url")
    .eq("id", messageId)
    .single();
  if (!orig) return;
  await supabase.from("messages").insert({
    conversation_id: toConversationId,
    sender_id: senderId,
    type: orig.type,
    content: orig.content,
    media_url: orig.media_url,
    gif_url: orig.gif_url,
    forwarded_from_id: messageId,
  });
}

// ─── Starred messages (cross-conversation) ────────────────────────────────────

export function useStarredMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Get all conversation IDs the user is in
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = memberships?.map((m: any) => m.conversation_id) ?? [];
    if (!ids.length) { setMessages([]); setLoading(false); return; }

    const { data } = await supabase
      .from("messages")
      .select(`*, sender:profiles(id,display_name,avatar_url)`)
      .in("conversation_id", ids)
      .eq("is_starred", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  return { messages, loading, reload: load };
}

// ─── Pinned messages (per conversation) ──────────────────────────────────────

export function usePinnedMessages(conversationId: string | undefined) {
  const [pinned, setPinned] = useState<Message[]>([]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("messages")
      .select(`*, sender:profiles(id,display_name,avatar_url)`)
      .eq("conversation_id", conversationId)
      .eq("is_pinned", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10);
    setPinned((data as Message[]) ?? []);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  return { pinned, reload: load };
}

// ─── Mark messages read ───────────────────────────────────────────────────────

export async function markMessagesRead(messageIds: string[], userId: string) {
  if (!messageIds.length) return;
  await supabase.from("message_read_receipts").upsert(
    messageIds.map((id) => ({ message_id: id, user_id: userId, read_at: new Date().toISOString() })),
    { onConflict: "message_id,user_id" },
  );
}

// ─── Global message search ────────────────────────────────────────────────────

export async function searchMessages(query: string, userId: string) {
  if (!query.trim()) return [];
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const ids = memberships?.map((m: any) => m.conversation_id) ?? [];
  if (!ids.length) return [];

  const { data } = await supabase
    .from("messages")
    .select(`*, sender:profiles(id,display_name,avatar_url)`)
    .in("conversation_id", ids)
    .ilike("content", `%${query}%`)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Message[]) ?? [];
}
