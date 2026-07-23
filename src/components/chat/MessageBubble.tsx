import { useState, useRef } from "react";
import clsx from "clsx";
import { format } from "date-fns";
import { Smile, Reply, Edit2, Trash2, Phone, Video } from "lucide-react";
import type { Message } from "../../types/database";
import { useReactions, EmojiPickerPanel } from "../../hooks/useReactions";
import { Avatar } from "../ui/Avatar";
import { VoicePlayer } from "./VoicePlayer";
import { motion, AnimatePresence } from "framer-motion";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageBubble({ message, isOwn, onReply, onEdit, onDelete }: MessageBubbleProps) {
  const { toggleReaction } = useReactions(message.id);
  const [showPicker, setShowPicker] = useState(false);
  const [showReactors, setShowReactors] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const grouped = (message.reactions ?? []).reduce<Record<string, typeof message.reactions>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji]!.push(r);
    return acc;
  }, {});

  // call_log message
  if (message.type === "call_log") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="flex items-center gap-2 rounded-full bg-surface/80 border border-border-subtle backdrop-blur-sm px-4 py-2 text-xs font-medium text-muted shadow-sm">
          {message.content?.includes("📹") ? (
            <Video className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          <span>{message.content?.split("||")[0]}</span>
          <span className="text-border-subtle">·</span>
          <span>{format(new Date(message.created_at), "HH:mm")}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={clsx("group relative flex gap-2 items-end mb-2", isOwn ? "flex-row-reverse" : "flex-row")}
    >
      {!isOwn && (
        <Avatar
          src={message.sender?.avatar_url}
          name={message.sender?.display_name ?? "?"}
          size="sm"
        />
      )}

      <div className={clsx("max-w-[75%]", isOwn ? "items-end" : "items-start")}>
        {/* Reply preview */}
        {message.reply_to_id && (message as Message & { reply_to?: { content: string | null; sender?: { display_name: string } } }).reply_to && (
          <div className={clsx(
            "mb-1 rounded-xl border-l-2 border-primary bg-surface px-3 py-2 text-xs shadow-sm",
            isOwn ? "ml-auto" : "",
          )}>
            <p className="font-semibold text-primary mb-0.5">
              {(message as Message & { reply_to?: { sender?: { display_name: string } } }).reply_to?.sender?.display_name ?? "Reply"}
            </p>
            <p className="truncate text-muted">
              {(message as Message & { reply_to?: { content: string | null } }).reply_to?.content ?? ""}
            </p>
          </div>
        )}

        {/* Bubble */}
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            // TODO: Open native-feeling custom context menu (Reply, Edit, Delete, Forward)
            console.log("Context menu triggered for message", message.id);
          }}
          className={clsx(
            "relative px-4 py-2.5 text-[15px] leading-relaxed shadow-sm transition-all cursor-default",
            isOwn 
              ? "rounded-2xl rounded-br-sm bg-gradient-to-br from-primary to-accent text-white shadow-primary/20" 
              : "rounded-2xl rounded-bl-sm bg-surface border border-border-subtle text-main",
          )}
        >
          {/* Sender name in groups */}
          {!isOwn && message.sender?.display_name && (
            <p className="mb-1 text-xs font-semibold text-primary">
              {message.sender.display_name}
            </p>
          )}

          {message.type === "gif" && message.gif_url ? (
            <img src={message.gif_url} alt="GIF" className="max-h-56 max-w-full rounded-xl object-cover mt-1" />
          ) : message.type === "image" && message.media_url ? (
            <img src={message.media_url} alt="Image" className="max-h-72 max-w-full rounded-xl object-cover mt-1" loading="lazy" />
          ) : message.type === "video" && message.media_url ? (
            <video src={message.media_url} controls className="max-h-56 max-w-full rounded-xl mt-1" />
          ) : message.type === "audio" && message.media_url ? (
            <VoicePlayer url={message.media_url} isOwn={isOwn} />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1.5">
            {message.is_edited && <span className="text-[10px] font-medium opacity-60">edited</span>}
            <span className="text-[10px] font-medium opacity-70">{format(new Date(message.created_at), "HH:mm")}</span>
            {isOwn && (
              <span className="text-white opacity-80" title="Read">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 7 17l-5-5" />
                  <path d="m22 10-7.5 7.5L13 16" />
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <div className={clsx("mt-1.5 flex flex-wrap gap-1", isOwn && "justify-end")}>
            {Object.entries(grouped).map(([emoji, reactions]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setShowReactors(showReactors === emoji ? null : emoji)}
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-xs font-medium transition-all hover:scale-105 active:scale-95 shadow-sm",
                  reactions!.some((r) => r.user_id === message.sender_id)
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border-subtle bg-surface text-main",
                )}
              >
                {emoji} {reactions!.length}
              </button>
            ))}
            {/* Add reaction button */}
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-xs text-muted hover:text-main transition-colors shadow-sm"
            >
              +
            </button>
          </div>
        )}

        {/* Reactor names */}
        <AnimatePresence>
          {showReactors && grouped[showReactors] && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-1 rounded-lg bg-card border border-border-subtle px-3 py-1.5 text-xs text-muted shadow-lg"
            >
              <span className="font-semibold text-main mr-1">{showReactors}</span>
              {grouped[showReactors]!.map((r) => r.profile?.display_name ?? "User").join(", ")}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick actions bar (on hover) */}
        <div className={clsx(
          "mt-1 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          isOwn ? "flex-row-reverse" : "",
        )}>
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-full p-1.5 bg-surface border border-border-subtle shadow-sm hover:bg-card text-muted hover:text-main transition-all hover:scale-110 active:scale-95"
            title="React"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="rounded-full p-1.5 bg-surface border border-border-subtle shadow-sm hover:bg-card text-muted hover:text-main transition-all hover:scale-110 active:scale-95"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && onEdit && message.type === "text" && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full p-1.5 bg-surface border border-border-subtle shadow-sm hover:bg-card text-muted hover:text-warning transition-all hover:scale-110 active:scale-95"
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full p-1.5 bg-surface border border-border-subtle shadow-sm hover:bg-card text-muted hover:text-error transition-all hover:scale-110 active:scale-95"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Full emoji picker */}
        {showPicker && (
          <div
            ref={pickerRef}
            className={clsx("absolute z-50 mt-1", isOwn ? "right-0" : "left-0")}
            style={{ bottom: "calc(100% + 8px)" }}
          >
            <EmojiPickerPanel
              onSelect={toggleReaction}
              onClose={() => setShowPicker(false)}
            />
          </div>
        )}

        {/* Delete confirmation */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="rounded-2xl bg-card border border-border-subtle p-6 text-center shadow-2xl max-w-sm w-full mx-4"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/10 mb-4">
                  <Trash2 className="h-6 w-6 text-error" />
                </div>
                <h3 className="text-lg font-semibold text-main mb-2">Delete Message</h3>
                <p className="mb-6 text-sm text-muted">Are you sure you want to delete this message? This action cannot be undone.</p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-xl bg-surface border border-border-subtle px-4 py-2.5 text-sm font-medium text-main hover:bg-surface/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
                    className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-medium text-white hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
