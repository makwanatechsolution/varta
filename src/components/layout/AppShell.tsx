import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Phone, CircleDot, Settings, Search, Plus, CalendarDays, UserPlus, Star } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useConversations } from "../../hooks/useChat";
import { useStories } from "../../hooks/useStories";
import { Avatar, PresenceLabel } from "../ui/Avatar";
import { StoryBar, StoryViewer } from "../stories/StoryViewer";
import type { StatusStory, Conversation } from "../../types/database";

function getConversationTitle(conv: Conversation, myId: string) {
  if (conv.title) return conv.title;
  const other = conv.members?.find((m) => m.user_id !== myId)?.profile;
  return other?.display_name ?? "Chat";
}

function getConversationAvatar(conv: Conversation, myId: string) {
  if (conv.avatar_url) return conv.avatar_url;
  return conv.members?.find((m) => m.user_id !== myId)?.profile?.avatar_url;
}

function getOtherPresence(conv: Conversation, myId: string) {
  return conv.members?.find((m) => m.user_id !== myId)?.profile?.presence;
}

function getLastMessagePreview(conv: Conversation) {
  const msg = (conv as Conversation & { last_message?: { content: string | null; type: string }[] }).last_message;
  if (!msg || !msg[0]) return null;
  const m = msg[0];
  if (m.type === "gif") return "🎞 GIF";
  if (m.type === "image") return "📷 Photo";
  if (m.type === "video") return "🎥 Video";
  if (m.type === "call_log") return m.content?.split("||")[0] ?? "📞 Call";
  return m.content ?? "";
}

export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading } = useConversations();
  const { stories, myStories, markViewed, postStory } = useStories();
  const [viewerStories, setViewerStories] = useState<StatusStory[] | null>(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const filtered = conversations.filter((c) =>
    getConversationTitle(c, user!.id).toLowerCase().includes(search.toLowerCase()),
  );

  const handleAddStory = async () => {
    const text = prompt("What's on your mind?");
    if (text) await postStory({ media_type: "text", text_content: text, background_color: "#6366f1" });
  };

  // Fix: StoryBar expects (stories: StatusStory[], index: number) → we just need (stories: StatusStory[])
  const handleOpenStory = (storyList: StatusStory[]) => {
    setViewerStories(storyList);
  };

  const navItems = [
    { path: "/", icon: MessageCircle, label: "Chats" },
    { path: "/calls", icon: Phone, label: "Calls" },
    { path: "/status", icon: CircleDot, label: "Status" },
    { path: "/meetings", icon: CalendarDays, label: "Meetings" },
  ];

  return (
    <div className="flex h-screen bg-[#0b141a] text-white">
      {/* Sidebar */}
      <aside className="flex w-full max-w-md flex-col border-r border-zinc-800 md:w-[420px]">
        {/* Header */}
        <header className="flex items-center gap-3 bg-[#111b21] px-4 py-3">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.display_name ?? "You"}
            presence={profile?.presence}
            showRing
          />
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{profile?.display_name}</p>
            <p className="text-xs">
              <PresenceLabel presence={profile?.presence ?? "offline"} lastSeen={profile?.last_seen} />
              {profile?.custom_status && (
                <span className="ml-1 text-zinc-500">· {profile.custom_status}</span>
              )}
            </p>
          </div>
          <Link to="/search" className="rounded-full p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Search">
            <Search className="h-5 w-5" />
          </Link>
          <Link to="/invite" className="rounded-full p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Invite friends">
            <UserPlus className="h-5 w-5" />
          </Link>
          <Link to="/starred" className="rounded-full p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Starred messages">
            <Star className="h-5 w-5" />
          </Link>
          <Link to="/settings" className="rounded-full p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Settings">
            <Settings className="h-5 w-5" />
          </Link>
        </header>

        {/* Search */}
        <div className="relative px-3 py-2">
          <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-lg bg-[#202c33] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-zinc-500"
          />
        </div>

        {/* Story bar — Instagram-style */}
        <StoryBar
          myStories={myStories}
          contactStories={stories}
          onAddStory={handleAddStory}
          onOpenStory={handleOpenStory}
        />

        {/* Nav tabs */}
        <nav className="flex border-b border-zinc-800 text-xs">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  active ? "border-b-2 border-[#1E88C7] text-[#1E88C7]" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Conversation list */}
        <div className="relative flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-center text-sm text-zinc-500">Loading chats...</p>}
          {!loading && filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-zinc-500">
              {search ? `No results for "${search}"` : "No conversations yet."}
            </p>
          )}

          {filtered.map((conv) => {
            const preview = getLastMessagePreview(conv);
            const isActive = location.pathname === `/chat/${conv.id}`;

            return (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive ? "bg-[#2a3942]" : "hover:bg-[#111b21]"
                }`}
              >
                <Avatar
                  src={getConversationAvatar(conv, user!.id)}
                  name={getConversationTitle(conv, user!.id)}
                  presence={getOtherPresence(conv, user!.id)}
                  showRing
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{getConversationTitle(conv, user!.id)}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {preview ?? (
                      conv.type === "group" ? "Group chat" : "Tap to chat"
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {conv.last_message_at && (
                    <span className="text-[10px] text-zinc-500">
                      {new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {conv.type === "group" && (
                    <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400">
                      group
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* New Chat FAB */}
          <button
            type="button"
            onClick={() => navigate("/new-chat")}
            className="fixed bottom-6 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1E88C7] text-white shadow-xl hover:bg-[#1971A5] transition-all hover:scale-105 md:absolute"
            title="New chat"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => signOut()}
          className="border-t border-zinc-800 px-4 py-3 text-left text-sm text-zinc-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </aside>

      {/* Main content — desktop split pane */}
      <main className="hidden flex-1 flex-col md:flex">
        <div className="flex flex-1 flex-col items-center justify-center bg-[#0b141a] text-zinc-500">
          <div className="flex flex-col items-center gap-4 opacity-60">
            <MessageCircle className="h-20 w-20 opacity-20" />
            <p className="text-2xl font-light text-zinc-400">Varta</p>
            <p className="text-sm text-zinc-600">
              WhatsApp calls · Telegram groups · Instagram stories
            </p>
            <p className="mt-2 text-xs text-zinc-700">Select a chat to start messaging</p>
          </div>
        </div>
      </main>

      {/* Story viewer overlay */}
      {viewerStories && (
        <StoryViewer
          stories={viewerStories}
          onClose={() => setViewerStories(null)}
          onView={markViewed}
        />
      )}
    </div>
  );
}
