import { useState } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { MessageCircle, Phone, CircleDot, Settings, Search, Plus, CalendarDays, Archive, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useConversations, useGlobalTyping } from "../../hooks/useChat";
import { useStories } from "../../hooks/useStories";
import { Avatar } from "../ui/Avatar";
import { StoryBar, StoryViewer } from "../stories/StoryViewer";
import type { StatusStory, Conversation } from "../../types/database";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

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
  const msg = (conv as any).last_message;
  if (!msg) return null;
  const m = Array.isArray(msg) ? msg[0] : msg;
  if (!m) return null;
  if (m.type === "gif") return "🎞 GIF";
  if (m.type === "image") return "📷 Photo";
  if (m.type === "video") return "🎥 Video";
  if (m.type === "audio") return "🎙️ Voice note";
  if (m.type === "call_log") return m.content?.split("||")[0] ?? "📞 Call";
  return m.content || null;
}

export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading } = useConversations();
  const globalTyping = useGlobalTyping(user?.id);
  const { stories, myStories, markViewed, postStory } = useStories();
  const [viewerStories, setViewerStories] = useState<StatusStory[] | null>(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const filtered = conversations.filter((c) =>
    getConversationTitle(c, user!.id).toLowerCase().includes(search.toLowerCase()),
  );

  // Dynamic unread badge calculation: count conversations where last message is from other and not current chat
  const unreadCount = conversations.filter((c) => {
    const msg = Array.isArray((c as any).last_message) ? (c as any).last_message[0] : (c as any).last_message;
    const isFromOther = msg && msg.sender_id !== user?.id;
    const isCurrentChat = location.pathname === `/chat/${c.id}`;
    return isFromOther && !isCurrentChat;
  }).length;

  const handleAddStory = async () => {
    const text = prompt("What's on your mind?");
    if (text) await postStory({ media_type: "text", text_content: text, background_color: "#6366f1" });
  };

  const handleOpenStory = (storyList: StatusStory[]) => {
    setViewerStories(storyList);
  };

  const navItems = [
    { path: "/", icon: MessageCircle, label: "All Chats", badge: unreadCount > 0 ? unreadCount : null },
    { path: "/calls", icon: Phone, label: "Calls" },
    { path: "/status", icon: CircleDot, label: "Updates" },
    { path: "/meetings", icon: CalendarDays, label: "Meetings" },
  ];

  return (
    <div className="flex h-screen bg-[#0b141a] text-white overflow-hidden font-sans">
      
      {/* ─── Narrow Left Navigation Rail (Desktop) ─────────────────────────── */}
      <nav className="hidden md:flex flex-col items-center py-6 w-[72px] shrink-0 border-r border-zinc-800 bg-[#0b141a] z-20 shadow-xl">
        <Link to="/settings" title="Profile Settings" className="mb-6 relative transition-transform hover:scale-105 active:scale-95">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.display_name ?? "You"}
            presence={profile?.presence}
            size="md"
            showRing
          />
        </Link>

        <div className="flex flex-col items-center gap-4 flex-1 w-full">
          {navItems.map(({ path, icon: Icon, label, badge }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                title={label}
                className={clsx(
                  "relative flex items-center justify-center h-12 w-12 rounded-2xl transition-all duration-200",
                  active ? "bg-[#1E88C7] text-white shadow-lg shadow-[#1E88C7]/20" : "text-zinc-400 hover:bg-[#1b2326] hover:text-white"
                )}
              >
                <Icon className={clsx("h-6 w-6", active ? "stroke-[2.5px]" : "stroke-[2px]")} />
                {badge && (
                  <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#0b141a]" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-4 w-full">
          {profile?.is_admin && (
            <Link
              to="/admin"
              title="Admin Dashboard"
              className={clsx(
                "relative flex items-center justify-center h-12 w-12 rounded-2xl transition-colors",
                location.pathname.startsWith("/admin")
                  ? "bg-[#1E88C7] text-white shadow-md shadow-[#1E88C7]/20"
                  : "text-amber-400 hover:bg-[#1E88C7]/10 hover:text-[#1E88C7]"
              )}
            >
              <ShieldAlert className={clsx("h-6 w-6", location.pathname.startsWith("/admin") ? "stroke-[2.5px]" : "stroke-[2px]")} />
            </Link>
          )}
          <Link
            to="/archive"
            title="Archived Chats"
            className={clsx(
              "flex items-center justify-center h-12 w-12 rounded-2xl transition-colors",
              location.pathname.startsWith("/archive") ? "bg-[#1E88C7] text-white shadow-md shadow-[#1E88C7]/20" : "text-zinc-400 hover:bg-[#1b2326] hover:text-white"
            )}
          >
            <Archive className="h-6 w-6" />
          </Link>
          <Link
            to="/settings"
            title="Settings"
            className={clsx(
              "flex items-center justify-center h-12 w-12 rounded-2xl transition-colors",
              location.pathname.startsWith("/settings") ? "bg-[#1E88C7] text-white shadow-md shadow-[#1E88C7]/20" : "text-zinc-400 hover:bg-[#1b2326] hover:text-white"
            )}
          >
            <Settings className={clsx("h-6 w-6", location.pathname.startsWith("/settings") ? "stroke-[2.5px]" : "stroke-[2px]")} />
          </Link>
          <button
            type="button"
            onClick={signOut}
            title="Log Out / Sign Out"
            className="flex items-center justify-center h-12 w-12 rounded-2xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="h-6 w-6 stroke-[2px]" />
          </button>
        </div>
      </nav>

      {/* ─── Secondary Sidebar (List Panel) ────────────────────────────────── */}
      <aside className={clsx(
        "flex w-full md:w-[380px] flex-col border-r border-zinc-800 bg-[#111b21] z-10 shrink-0 transition-all",
        location.pathname === "/" ? "" : "hidden md:flex"
      )}>
        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">Chats</h1>
          <div className="flex items-center gap-1">
            <button className="rounded-full p-2 text-zinc-400 hover:bg-[#1b2326] hover:text-white transition-colors" title="Filter unread">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <Link to="/new-chat" className="rounded-full p-2 text-[#1E88C7] hover:bg-[#1E88C7]/10 transition-colors" title="New Chat">
              <Plus className="h-6 w-6 stroke-[2.5px]" />
            </Link>
          </div>
        </header>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start a new chat"
              className="w-full rounded-2xl bg-[#1b2326] border border-zinc-800 py-2.5 pl-11 pr-4 text-[15px] text-white outline-none placeholder:text-zinc-500 focus:border-[#1E88C7] transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Story bar (only show if there are stories) */}
        {(stories.length > 0 || myStories.length > 0) && (
          <div className="px-2 pb-2 border-b border-border-subtle">
            <StoryBar
              myStories={myStories}
              contactStories={stories}
              onAddStory={handleAddStory}
              onOpenStory={handleOpenStory}
            />
          </div>
        )}

        {/* Mobile Nav tabs (hidden on desktop) */}
        <nav className="flex border-b border-border-subtle text-xs px-2 md:hidden">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={clsx(
                  "relative flex flex-1 flex-col items-center gap-1 py-3 transition-colors",
                  active ? "text-primary" : "text-muted hover:text-main hover:bg-card rounded-t-lg"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium tracking-wide">{label}</span>
                {active && (
                  <motion.div 
                    layoutId="mobile-nav-indicator" 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" 
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Conversation list */}
        <div className="relative flex-1 overflow-y-auto scrollbar-hide py-2 px-2">
          {loading && (
            <div className="flex justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted">
              <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">{search ? `No results for "${search}"` : "No conversations yet."}</p>
            </div>
          )}

          <div className="space-y-1">
            {filtered.map((conv) => {
              const preview = getLastMessagePreview(conv);
              const isActive = location.pathname === `/chat/${conv.id}`;
              const isTyping = Boolean(globalTyping[conv.id]?.length);

              return (
                <div key={conv.id}>
                  <Link
                    to={`/chat/${conv.id}`}
                    className={clsx(
                      "group relative flex items-center gap-3.5 rounded-2xl px-3 py-3 mb-1 transition-all",
                      isActive ? "bg-[#1E88C7] text-white shadow-lg shadow-[#1E88C7]/20 font-semibold" : "hover:bg-[#1b2326] text-white"
                    )}
                  >
                    <Avatar
                      src={getConversationAvatar(conv, user!.id)}
                      name={getConversationTitle(conv, user!.id)}
                      presence={getOtherPresence(conv, user!.id)}
                      showRing={!isActive}
                      size="md"
                    />
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <p className="truncate font-semibold text-[15px] tracking-tight text-white">{getConversationTitle(conv, user!.id)}</p>
                        {conv.last_message_at && (
                          <span className={clsx(
                            "text-[11px] font-medium shrink-0 ml-2 transition-colors",
                            isActive ? "text-white/80" : "text-zinc-400 group-hover:text-white"
                          )}>
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={clsx(
                          "truncate text-[13px] transition-colors flex-1 mr-2",
                          isActive ? "text-white/90" : (isTyping ? "text-[#1E88C7] font-medium" : "text-zinc-400")
                        )}>
                          {isTyping ? "typing..." : (preview ?? (
                            conv.type === "group" ? "Group chat" : "Tap to chat"
                          ))}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.type === "group" && !isActive && (
                            <span className="rounded-full bg-[#1b2326] border border-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-zinc-400">
                              group
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ─── Main content — Chat / Settings Area ───────────────────────────── */}
      <main className={clsx(
        "relative flex-1 flex-col bg-background/50",
        location.pathname === "/" ? "hidden md:flex" : "flex"
      )}>
        <AnimatePresence mode="wait">
          {location.pathname === "/" ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex h-full flex-col items-center justify-center"
            >
              <div className="flex flex-col items-center gap-6 p-12 max-w-sm text-center">
                <div className="rounded-3xl bg-surface/50 border border-border-subtle p-8 shadow-2xl backdrop-blur-3xl">
                  <MessageCircle className="h-20 w-20 text-primary/80" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-light tracking-tight text-main">Varta Desktop</h1>
                  <p className="text-[15px] text-muted leading-relaxed">
                    Send and receive messages seamlessly across your devices. End-to-end encrypted and beautifully designed.
                  </p>
                </div>
                <button 
                  onClick={() => navigate('/new-chat')}
                  className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Start a new chat
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col"
            >
              <Outlet />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Story viewer overlay ──────────────────────────────────────────── */}
      <AnimatePresence>
        {viewerStories && (
          <StoryViewer
            stories={viewerStories}
            onClose={() => setViewerStories(null)}
            onView={markViewed}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
