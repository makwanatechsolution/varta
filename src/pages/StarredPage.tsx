import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Star, Loader2, MessageCircle } from "lucide-react";
import { useStarredMessages, starMessage } from "../hooks/useChat";
import { Avatar } from "../components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";

export function StarredPage() {
  const { messages, loading, reload } = useStarredMessages();
  const [unstarring, setUnstarring] = useState<string | null>(null);

  const handleUnstar = async (id: string) => {
    setUnstarring(id);
    await starMessage(id, false);
    await reload();
    setUnstarring(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white">
      <header className="flex items-center gap-4 bg-[#111b21] px-4 py-3 shadow">
        <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" />
          <h1 className="font-semibold">Starred Messages</h1>
        </div>
        {messages.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            {messages.length}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <Star className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-base font-medium text-zinc-500">No starred messages</p>
            <p className="mt-1 text-sm opacity-60 text-center max-w-xs">
              Star important messages in any chat to find them here quickly
            </p>
          </div>
        )}

        {!loading && messages.length > 0 && (
          <div className="divide-y divide-zinc-800/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-[#111b21]/50 transition-colors"
              >
                <Avatar
                  src={msg.sender?.avatar_url}
                  name={msg.sender?.display_name ?? "?"}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {msg.sender?.display_name ?? "Unknown"}
                    </p>
                    <span className="shrink-0 text-[10px] text-zinc-600">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-400 line-clamp-3">
                    {msg.type === "image" ? "📷 Photo" :
                     msg.type === "video" ? "🎥 Video" :
                     msg.type === "gif" ? "🎞 GIF" :
                     msg.content ?? ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Link
                      to={`/chat/${msg.conversation_id}`}
                      className="flex items-center gap-1 rounded-full bg-[#202c33] px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                      Go to chat
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleUnstar(msg.id)}
                      disabled={unstarring === msg.id}
                      className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50"
                    >
                      {unstarring === msg.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Star className="h-3 w-3" />
                      )}
                      Unstar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
