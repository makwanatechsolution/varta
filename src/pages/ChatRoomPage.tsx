import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Phone, Video, Send, ImageIcon, Smile,
  X, Reply as ReplyIcon, Edit2, MessageCircle, Plus
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useMessages, useTyping } from "../hooks/useChat";
import { useCalling } from "../hooks/useCalling";
import { MessageBubble } from "../components/chat/MessageBubble";
import { GifPicker } from "../components/chat/GifPicker";
import { VoiceRecorder } from "../components/chat/VoiceRecorder";
import { TypingIndicatorBubble } from "../components/chat/TypingIndicatorBubble";
import { Avatar } from "../components/ui/Avatar";
import EmojiPicker, { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import type { GifResult, Message, Conversation, Profile } from "../types/database";
import { supabase } from "../lib/supabase";
import clsx from "clsx";

// ─── Hook: load conversation info (with live presence updates) ────────────────

function useConversationInfo(conversationId: string | undefined, myId: string | undefined) {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);

  useEffect(() => {
    if (!conversationId || !myId) return;

    supabase
      .from("conversations")
      .select(`
        *,
        members:conversation_members(
          id, user_id, role,
          profile:profiles(id, display_name, avatar_url, presence, last_seen)
        )
      `)
      .eq("id", conversationId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setConv(data as Conversation);
        const other = (data as Conversation).members?.find((m) => m.user_id !== myId)?.profile;
        if (other) setOtherUser(other as Profile);
      });
  }, [conversationId, myId]);

  // BUG-7 FIX: live presence update for the other user's header status
  useEffect(() => {
    if (!otherUser?.id) return;
    const ch = supabase
      .channel(`profile_presence:${otherUser.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${otherUser.id}` },
        (payload) => {
          setOtherUser((prev) =>
            prev ? { ...prev, presence: (payload.new as any).presence, last_seen: (payload.new as any).last_seen } : prev
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [otherUser?.id]);

  const title = conv?.title ?? otherUser?.display_name ?? "Chat";
  return { conv, otherUser, title };
}

// ─── ChatRoomPage ─────────────────────────────────────────────────────────────

export function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { chatWallpaper, fontSize, enterToSend, resolvedTheme } = useSettings();
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useMessages(id);
  const { typingUsers, sendTyping } = useTyping(id, user?.id);
  const { conv, otherUser, title } = useConversationInfo(id, user?.id);
  const [text, setText] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiComposer, setShowEmojiComposer] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // BUG-6 FIX: removed duplicate usePresence() call — it runs in AppRoutes already

  const typingNames = typingUsers
    .map(uid => conv?.members?.find(m => m.user_id === uid)?.profile?.display_name)
    .filter(Boolean) as string[];

  let typingText = "typing...";
  if (typingNames.length === 1) typingText = `${typingNames[0]} is typing...`;
  else if (typingNames.length === 2) typingText = `${typingNames[0]} and ${typingNames[1]} are typing...`;
  else if (typingNames.length > 2) typingText = `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;

  const { startCall } = useCalling(id);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = (smooth = false) => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (!messages.length) return;
    const currentCount = messages.length;
    const prevCount = prevMsgCountRef.current;

    if (isInitialLoadRef.current) {
      scrollToBottom(false);
      const t1 = setTimeout(() => scrollToBottom(false), 50);
      const t2 = setTimeout(() => scrollToBottom(false), 150);
      isInitialLoadRef.current = false;
      prevMsgCountRef.current = currentCount;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    if (currentCount > prevCount) {
      prevMsgCountRef.current = currentCount;
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;
        const lastMsg = messages[messages.length - 1];
        const isMyMsg = lastMsg?.sender_id === user?.id;
        if (isNearBottom || isMyMsg) scrollToBottom(true);
      }
    } else {
      prevMsgCountRef.current = currentCount;
    }
  }, [messages, user?.id]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    prevMsgCountRef.current = 0;
  }, [id]);

  // ── Wallpaper background style ──────────────────────────────────────────────
  const wallpaperStyle = useMemo((): React.CSSProperties => {
    switch (chatWallpaper) {
      case "whatsapp_dark":
        return { backgroundColor: "#0b141a", backgroundImage: "radial-gradient(#1b2326 1px, transparent 1px)", backgroundSize: "16px 16px" };
      case "telegram_night":
        return { backgroundColor: "#0f172a", backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)", backgroundSize: "20px 20px" };
      case "amoled_pattern":
        return { backgroundColor: "#000000", backgroundImage: "radial-gradient(#1e1e1e 1px, transparent 1px)", backgroundSize: "16px 16px" };
      case "light_paper":
        return { backgroundColor: "#f8fafc", backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "16px 16px" };
      case "emerald_soft":
        return { backgroundColor: "#0d2018", backgroundImage: "radial-gradient(#133024 1px, transparent 1px)", backgroundSize: "16px 16px" };
      default:
        return { backgroundColor: "var(--bg-main)" };
    }
  }, [chatWallpaper]);

  // ── Emoji picker theme follows app theme ────────────────────────────────────
  const emojiTheme = resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK;

  const handleSend = async () => {
    if (editingMsg) {
      if (!editText.trim()) return;
      await editMessage(editingMsg.id, editText);
      setEditingMsg(null);
      setEditText("");
      return;
    }
    if (!text.trim()) return;
    await sendMessage(text, "text", replyTo ? { reply_to_id: replyTo.id } : undefined);
    setText("");
    setReplyTo(null);
  };

  const handleGif = async (gif: GifResult) => {
    await sendMessage("", "gif", { gif_url: gif.url, media_url: gif.url });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;
    const ext = file.name.split(".").pop();
    const path = `chat/${id}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error || !data) return;
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(data.path);
    const isVideo = file.type.startsWith("video/");
    await sendMessage("", isVideo ? "video" : "image", { media_url: urlData.publicUrl });
    e.target.value = "";
  };

  const handleVoiceSend = async (blob: Blob) => {
    if (!user || !id) return;
    const path = `chat/${id}/audio_${Date.now()}.webm`;
    const { data, error } = await supabase.storage.from("media").upload(path, blob, { upsert: true });
    if (error || !data) return;
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(data.path);
    await sendMessage("", "audio", { media_url: urlData.publicUrl });
  };

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditText(msg.content ?? "");
    setReplyTo(null);
  };

  const cancelEdit = () => { setEditingMsg(null); setEditText(""); };

  return (
    <div
      className="flex flex-col relative z-0 overflow-hidden"
      style={{ height: "100dvh", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shadow-sm border-b z-10 sticky top-0 backdrop-blur-xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
        }}
      >
        <Link to="/" className="md:hidden transition-colors hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {otherUser && (
          <Avatar
            src={otherUser.avatar_url}
            name={otherUser.display_name}
            presence={otherUser.presence}
            showRing
            size="sm"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold" style={{ color: "var(--text-main)" }}>{title}</p>
          <p className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}>
            {typingUsers.length > 0
              ? <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>{typingText}</span>
              : conv?.type === "group"
              ? `${conv.members?.length ?? 0} members`
              : otherUser?.presence === "online"
              ? <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>online</span>
              : "tap for info"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => startCall("voice", otherUser || undefined)}
          className="rounded-full p-2 transition-colors hover:opacity-70"
          style={{ color: "var(--color-primary)" }}
          title="Voice Call"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => startCall("video", otherUser || undefined)}
          className="rounded-full p-2 transition-colors hover:opacity-70"
          style={{ color: "var(--color-primary)" }}
          title="Video Call"
        >
          <Video className="h-5 w-5" />
        </button>
      </header>

      {/* ── Messages Stream ──────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        className={clsx(
          "flex-1 space-y-2 overflow-y-auto px-4 py-6 scrollbar-hide transition-all",
          fontSize === "small" && "text-[13px]",
          fontSize === "large" && "text-[17px]",
          (!fontSize || fontSize === "medium") && "text-[15px]"
        )}
        style={wallpaperStyle}
      >
        {loading && (
          <div className="flex justify-center p-4">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
            />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60" style={{ color: "var(--text-muted)" }}>
            <MessageCircle className="h-12 w-12" />
            <p className="text-sm font-medium">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === user?.id}
            onReply={() => setReplyTo(msg)}
            onEdit={() => startEdit(msg)}
            onDelete={() => deleteMessage(msg.id)}
          />
        ))}
        {typingUsers.length > 0 && (
          <div className="px-2">
            <TypingIndicatorBubble />
          </div>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ── Composer ────────────────────────────────────────────────────── */}
      <div
        className="relative border-t px-2 py-2 backdrop-blur-md"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
        }}
      >
        <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGif} />

        {/* Emoji picker — theme-aware */}
        {showEmojiComposer && (
          <div
            className="absolute bottom-full left-2 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <EmojiPicker
              theme={emojiTheme}
              onEmojiClick={(emojiData: EmojiClickData) => {
                setText((prev) => prev + emojiData.emoji);
              }}
            />
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div
            className="flex items-center gap-3 border-b rounded-t-2xl px-4 py-3 mx-2 mt-[-8px] shadow-sm"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            <ReplyIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />
            <div className="min-w-0 flex-1 border-l-2 pl-2" style={{ borderColor: "var(--color-primary)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
                {replyTo.sender?.display_name ?? "Message"}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {replyTo.type === "gif" ? "GIF" : replyTo.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded-full p-1 hover:opacity-70 transition-colors"
            >
              <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        )}

        {/* Edit mode banner */}
        {editingMsg && (
          <div
            className="flex items-center gap-3 border-b rounded-t-2xl px-4 py-3 mx-2 mt-[-8px]"
            style={{ backgroundColor: "rgba(245,158,11,0.1)", borderColor: "var(--border-subtle)" }}
          >
            <Edit2 className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="flex-1 text-xs font-medium text-amber-500">Editing message</span>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-full p-1 hover:opacity-70 transition-colors"
            >
              <X className="h-4 w-4 text-amber-500" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 p-1 relative overflow-hidden">
          {!isVoiceRecording && (
            <div className="flex items-center gap-1 mb-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiComposer(!showEmojiComposer)}
                className="rounded-full p-2 transition-colors hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <Smile className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => setGifOpen(true)}
                className="rounded-full p-2 transition-colors hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <ImageIcon className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full p-2 transition-colors hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {!isVoiceRecording ? (
            <div className="flex-1 relative">
              <textarea
                value={editingMsg ? editText : text}
                onChange={(e) => {
                  if (editingMsg) setEditText(e.target.value);
                  else { setText(e.target.value); sendTyping(); }
                }}
                onKeyDown={(e) => {
                  if (enterToSend) {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  } else {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
                  }
                }}
                placeholder={editingMsg ? "Edit message..." : "Message (Enter to send, Shift+Enter for new line)"}
                rows={1}
                className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none border max-h-32 scrollbar-hide transition-shadow focus:ring-2"
                style={{
                  backgroundColor: "var(--input-bg)",
                  color: "var(--text-main)",
                  borderColor: "var(--border-subtle)",
                }}
              />
            </div>
          ) : (
            <VoiceRecorder
              onSend={handleVoiceSend}
              onCancel={() => setIsVoiceRecording(false)}
              onRecordingChange={setIsVoiceRecording}
              className="flex-1 mb-1"
            />
          )}

          <div className="shrink-0 mb-1">
            {editingMsg || text.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                className="rounded-full p-3 shadow-md transition-transform hover:scale-105 active:scale-95 text-white"
                style={{ backgroundColor: editingMsg ? "#F59E0B" : "var(--color-primary)" }}
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              !isVoiceRecording && (
                <button
                  type="button"
                  onClick={() => setIsVoiceRecording(true)}
                  className="rounded-full p-3 text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
