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
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        members:conversation_members(
          id, user_id, role,
          profile:profiles(id, display_name, avatar_url, presence, last_seen, custom_status)
        ),
        last_message:messages(id, content, type, created_at, sender_id)
      `)
      .in("id", ids)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error loading conversations:", error);
    }
    
    // Process conversations to ensure last_message is correctly represented
    const processedData = (data as any[])?.map(conv => {
      let lastMsg = conv.last_message;
      if (Array.isArray(lastMsg)) {
        lastMsg = lastMsg.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      }
      return { ...conv, last_message: lastMsg };
    }) as Conversation[];

    setConversations(processedData ?? []);
    if (!silent) setLoading(false);
  }, [user]);

  useEffect(() => {
    load(false);

    const silentReload = () => load(true);

    // Realtime: silent reload when conversations or messages update
    const channel = supabase
      .channel("conversations_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, silentReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, silentReload)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

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

    const silentReload = () => load(true);

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        // Fetch sender info for the new message
        let senderData = null;
        if (payload.new.sender_id) {
          const res = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', payload.new.sender_id).single();
          senderData = res.data;
        }
        
        const newMsg = {
          ...payload.new,
          sender: senderData,
          reactions: [],
          reply_to: null
        } as unknown as Message;
        
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;

          // Replace matching temporary optimistic message if present
          const tempIdx = prev.findIndex(
            (m) =>
              m.id.startsWith("temp-") &&
              m.sender_id === newMsg.sender_id &&
              m.type === newMsg.type &&
              (m.content === newMsg.content || m.gif_url === newMsg.gif_url || m.media_url === newMsg.media_url)
          );

          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = newMsg;
            return updated;
          }

          return [...prev, newMsg];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, silentReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, silentReload)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user, load]);

  const sendMessage = async (
    content: string,
    type: Message["type"] = "text",
    extras?: Partial<Message>,
  ) => {
    if (!conversationId || !user) return;
    // Only block empty sends for text messages — GIFs, images etc. can have empty content
    if (type === "text" && !content.trim()) return;

    // Optimistic UI update
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
      // Revert optimistic update on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }

    // Trigger push notification to other conversation members
    try {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (members && members.length > 0) {
        const recipientIds = members.map((m) => m.user_id).filter((id) => id !== user.id);
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
          }).catch((err) => console.warn("Failed to trigger message push notification:", err));
        }
      }
    } catch (pushErr) {
      console.warn("Error fetching conversation members for push notification:", pushErr);
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    await supabase
      .from("messages")
      .update({ content: newContent.trim(), is_edited: true })
      .eq("id", messageId);
  };

  const deleteMessage = async (messageId: string) => {
    await supabase.from("messages").update({ is_deleted: true }).eq("id", messageId);
  };

  return { messages, loading, sendMessage, editMessage, deleteMessage };
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

// Hook for a specific conversation
export function useTyping(conversationId: string | undefined, myId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const globalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId || !myId) return;

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

    // Join the global typing channel to broadcast typing status globally
    // We don't subscribe or remove it here because AppShell's useGlobalTyping manages the connection.
    const globalCh = supabase.channel(`typing_global`, {
      config: { presence: { key: myId } },
    });
    globalChannelRef.current = globalCh;

    return () => { 
      supabase.removeChannel(ch); 
    };
  }, [conversationId, myId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !globalChannelRef.current) return;
    
    // Broadcast locally
    channelRef.current.track({ typing: true });
    
    // Broadcast globally (so sidebar can see it)
    globalChannelRef.current.track({ typing: true, conversationId });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      channelRef.current?.track({ typing: false });
      globalChannelRef.current?.track({ typing: false, conversationId });
    }, 2500);
  }, [conversationId]);

  return { typingUsers, sendTyping };
}

// Hook for all conversations (used in the sidebar)
export function useGlobalTyping(myId: string | undefined) {
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!myId) return;
    
    const ch = supabase.channel(`typing_global`, {
      config: { presence: { key: myId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ typing: boolean; conversationId: string }>();
      
      const newMap: Record<string, string[]> = {};
      
      Object.entries(state).forEach(([uid, payloads]) => {
        if (uid === myId) return;
        const payload = (payloads as { typing: boolean; conversationId: string }[])[0];
        if (payload?.typing && payload?.conversationId) {
          if (!newMap[payload.conversationId]) newMap[payload.conversationId] = [];
          newMap[payload.conversationId].push(uid);
        }
      });
      
      setTypingMap(newMap);
    });

    ch.subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [myId]);

  return typingMap;
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
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, presence")
    .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(20);
  return data ?? [];
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
