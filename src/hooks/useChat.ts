import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { Conversation, Message } from "../types/database";

// ─── Conversations ────────────────────────────────────────────────────────────

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberships?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const ids = memberships.map((m) => m.conversation_id);
    const { data } = await supabase
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

    setConversations((data as Conversation[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();

    // Realtime: reload when conversations update
    const channel = supabase
      .channel("conversations_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { conversations, loading, reload: load };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useMessages(conversationId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!conversationId || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select(`
        *,
        sender:profiles(id, display_name, avatar_url),
        reactions:message_reactions(id, emoji, user_id, profile:profiles(id, display_name)),
        reply_to:messages!reply_to_id(id, content, type, sender:profiles(id, display_name))
      `)
      .eq("conversation_id", conversationId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);

    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !user) return;
    load();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, load)
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

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      type,
      content: content.trim() || null,
      ...extras,
    });

    if (error) throw error;
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

export function useTyping(conversationId: string | undefined, myId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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

    return () => { supabase.removeChannel(ch); };
  }, [conversationId, myId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.track({ typing: true });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      channelRef.current?.track({ typing: false });
    }, 2500);
  }, []);

  return { typingUsers, sendTyping };
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
