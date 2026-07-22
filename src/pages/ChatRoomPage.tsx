import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Video, Send, ImageIcon, Smile, X, Reply as ReplyIcon, Edit2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useMessages, useTyping } from "../hooks/useChat";
import { useCalling } from "../hooks/useCalling";
import { usePresence } from "../hooks/usePresence";
import { MessageBubble } from "../components/chat/MessageBubble";
import { GifPicker } from "../components/chat/GifPicker";
import { IncomingCallScreen, ActiveCallOverlay } from "../components/calls/CallUI";
import { Avatar } from "../components/ui/Avatar";
import type { GifResult, Message, Conversation, Profile } from "../types/database";
import { supabase } from "../lib/supabase";
import clsx from "clsx";

// ─── Hook: load conversation info ────────────────────────────────────────────

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

  const title = conv?.title ?? otherUser?.display_name ?? "Chat";
  return { conv, otherUser, title };
}

// ─── ChatRoomPage ─────────────────────────────────────────────────────────────

export function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useMessages(id);
  const { typingUsers, sendTyping } = useTyping(id, user?.id);
  const { conv, otherUser, title } = useConversationInfo(id, user?.id);
  const [text, setText] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiComposer, setShowEmojiComposer] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  usePresence();

  const {
    activeCall, incomingCall, localStream, remoteStream,
    isMuted, isVideoOff, startCall, acceptCall, declineCall, endCall,
    toggleMute, toggleVideo,
  } = useCalling(id);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    await sendMessage("", "gif", { gif_url: gif.url });
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

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditText(msg.content ?? "");
    setReplyTo(null);
  };

  const cancelEdit = () => { setEditingMsg(null); setEditText(""); };

  const QUICK_EMOJIS = ["😀","❤️","😂","🔥","👍","🎉"];

  return (
    <div className="flex h-screen flex-col bg-[#0b141a]">
      {/* Header */}
      <header className="flex items-center gap-3 bg-[#111b21] px-4 py-3">
        <Link to="/" className="md:hidden text-zinc-400 hover:text-white">
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
          <p className="truncate font-medium text-white">{title}</p>
          <p className="text-xs text-zinc-500">
            {typingUsers.length > 0
              ? "typing..."
              : conv?.type === "group"
              ? `${conv.members?.length ?? 0} members`
              : otherUser?.presence === "online"
              ? <span className="text-[#25D366]">online</span>
              : "tap for info"}
          </p>
        </div>

        <button type="button" onClick={() => startCall("voice")} className="rounded-full p-2 hover:bg-zinc-800">
          <Phone className="h-5 w-5 text-[#25D366]" />
        </button>
        <button type="button" onClick={() => startCall("video")} className="rounded-full p-2 hover:bg-zinc-800">
          <Video className="h-5 w-5 text-[#25D366]" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {loading && <p className="text-center text-sm text-zinc-500">Loading messages...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-zinc-500 mt-8">
            No messages yet. Say hello! 👋
          </p>
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
          <div className="flex items-center gap-2 px-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">typing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="relative border-t border-zinc-800 bg-[#111b21]">
        {/* GIF picker */}
        <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGif} />

        {/* Quick emoji bar for composer */}
        {showEmojiComposer && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-1 rounded-full bg-[#202c33] px-3 py-2 shadow-lg">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setText((prev) => prev + e); setShowEmojiComposer(false); }}
                className="text-xl hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
            <button type="button" onClick={() => setShowEmojiComposer(false)}>
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center gap-2 border-b border-zinc-700 px-4 py-2">
            <ReplyIcon className="h-4 w-4 text-[#25D366] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#25D366]">{replyTo.sender?.display_name ?? "Message"}</p>
              <p className="truncate text-xs text-zinc-400">
                {replyTo.type === "gif" ? "GIF" : replyTo.content}
              </p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)}>
              <X className="h-4 w-4 text-zinc-500 hover:text-white" />
            </button>
          </div>
        )}

        {/* Edit mode banner */}
        {editingMsg && (
          <div className="flex items-center gap-2 border-b border-zinc-700 bg-[#1a2a35] px-4 py-2">
            <Edit2 className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="flex-1 text-xs text-amber-400">Editing message</span>
            <button type="button" onClick={cancelEdit}>
              <X className="h-4 w-4 text-zinc-500 hover:text-white" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 p-3">
          <button type="button" onClick={() => setShowEmojiComposer(!showEmojiComposer)} className="rounded-full p-2 hover:bg-zinc-800">
            <Smile className="h-5 w-5 text-zinc-400" />
          </button>
          <button type="button" onClick={() => setGifOpen(true)} className="rounded-full p-2 hover:bg-zinc-800">
            <ImageIcon className="h-5 w-5 text-zinc-400" />
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full p-2 hover:bg-zinc-800">
            <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          <input
            value={editingMsg ? editText : text}
            onChange={(e) => {
              if (editingMsg) setEditText(e.target.value);
              else { setText(e.target.value); sendTyping(); }
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={editingMsg ? "Edit message..." : "Type a message"}
            className="flex-1 rounded-full bg-[#202c33] px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={editingMsg ? !editText.trim() : !text.trim()}
            className={clsx(
              "rounded-full p-2 disabled:opacity-40 transition-all",
              editingMsg ? "bg-amber-500" : "bg-[#25D366]",
            )}
          >
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Overlays */}
      {incomingCall && (
        <IncomingCallScreen
          call={incomingCall}
          callerName={otherUser?.display_name ?? "Incoming call"}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}
      {activeCall && (
        <ActiveCallOverlay
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEnd={endCall}
          isVideo={activeCall.type === "video"}
          callerName={otherUser?.display_name ?? ""}
          duration={activeCall.started_at ? new Date(activeCall.started_at) : undefined}
        />
      )}
    </div>
  );
}
