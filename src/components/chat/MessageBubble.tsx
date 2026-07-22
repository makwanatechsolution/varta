import { useState, useRef } from "react";
import clsx from "clsx";
import { format } from "date-fns";
import { Smile, Reply, Edit2, Trash2, Phone, Video } from "lucide-react";
import type { Message } from "../../types/database";
import { useReactions, EmojiPickerPanel } from "../../hooks/useReactions";
import { Avatar } from "../ui/Avatar";

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
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-2 rounded-full bg-[#1a2a35] px-4 py-1.5 text-xs text-zinc-400">
          {message.content?.includes("📹") ? (
            <Video className="h-3 w-3" />
          ) : (
            <Phone className="h-3 w-3" />
          )}
          <span>{message.content?.split("||")[0]}</span>
          <span className="text-zinc-600">·</span>
          <span>{format(new Date(message.created_at), "HH:mm")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("group relative flex gap-2 items-end", isOwn ? "flex-row-reverse" : "flex-row")}>
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
            "mb-1 rounded-lg border-l-2 border-[#25D366] bg-[#1a2a35] px-2 py-1 text-xs",
            isOwn ? "ml-auto" : "",
          )}>
            <p className="font-medium text-[#25D366]">
              {(message as Message & { reply_to?: { sender?: { display_name: string } } }).reply_to?.sender?.display_name ?? "Reply"}
            </p>
            <p className="truncate text-zinc-400">
              {(message as Message & { reply_to?: { content: string | null } }).reply_to?.content ?? ""}
            </p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={clsx(
            "relative rounded-2xl px-3 py-2 text-sm",
            isOwn ? "rounded-tr-sm bg-[#005c4b] text-white" : "rounded-tl-sm bg-[#202c33] text-zinc-100",
          )}
        >
          {/* Sender name in groups */}
          {!isOwn && message.sender?.display_name && (
            <p className="mb-0.5 text-[11px] font-semibold text-[#25D366]">
              {message.sender.display_name}
            </p>
          )}

          {message.type === "gif" && message.gif_url ? (
            <img src={message.gif_url} alt="GIF" className="max-h-48 max-w-full rounded-lg" />
          ) : message.type === "image" && message.media_url ? (
            <img src={message.media_url} alt="Image" className="max-h-64 max-w-full rounded-lg" loading="lazy" />
          ) : message.type === "video" && message.media_url ? (
            <video src={message.media_url} controls className="max-h-48 max-w-full rounded-lg" />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          <div className="mt-0.5 flex items-center justify-end gap-1">
            {message.is_edited && <span className="text-[9px] opacity-50">edited</span>}
            <span className="text-[10px] opacity-60">{format(new Date(message.created_at), "HH:mm")}</span>
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <div className={clsx("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}>
            {Object.entries(grouped).map(([emoji, reactions]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setShowReactors(showReactors === emoji ? null : emoji)}
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-xs transition-all hover:scale-110",
                  reactions!.some((r) => r.user_id === message.sender_id)
                    ? "border-[#25D366]/50 bg-[#25D366]/10"
                    : "border-zinc-700 bg-[#202c33]",
                )}
              >
                {emoji} {reactions!.length}
              </button>
            ))}
            {/* Add reaction button */}
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="rounded-full border border-zinc-700 bg-[#202c33] px-1.5 py-0.5 text-xs text-zinc-500 hover:text-white"
            >
              +
            </button>
          </div>
        )}

        {/* Reactor names */}
        {showReactors && grouped[showReactors] && (
          <div className="mt-1 rounded-lg bg-[#202c33] px-3 py-1.5 text-xs text-zinc-300 shadow-lg">
            <span className="font-medium text-white">{showReactors} </span>
            {grouped[showReactors]!.map((r) => r.profile?.display_name ?? "User").join(", ")}
          </div>
        )}

        {/* Quick actions bar (on hover) */}
        <div className={clsx(
          "mt-1 flex gap-1 opacity-0 transition-all group-hover:opacity-100",
          isOwn ? "flex-row-reverse" : "",
        )}>
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-full p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-white"
            title="React"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="rounded-full p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-white"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && onEdit && message.type === "text" && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-amber-400"
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwn && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
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
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
            <div className="rounded-xl bg-[#202c33] p-4 text-center shadow-xl">
              <p className="mb-3 text-sm text-white">Delete this message?</p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
