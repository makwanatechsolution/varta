import { useState } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { MessageCircle, Phone, CircleDot, Settings, Search, Plus, CalendarDays, Archive, LogOut } from "lucide-react";
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
  const globalTyping = useGlobalTyping(user?.id);
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

  const handleOpenStory = (storyList: StatusStory[]) => {
    setViewerStories(storyList);
  };

  const navItems = [
    { path: "/", icon: MessageCircle, label: "All Chats", badge: 3 },
    { path: "/calls", icon: Phone, label: "Calls" },
    { path: "/status", icon: CircleDot, label: "Updates" },
    { path: "/meetings", icon: CalendarDays, label: "Meetings" },
  ];

  return (
    <div className="flex h-screen bg-background text-main overflow-hidden font-sans">
      
      {/* ─── Narrow Left Navigation Rail (Desktop) ─────────────────────────── */}
      <nav className="hidden md:flex flex-col items-center py-6 w-[72px] shrink-0 border-r border-border-subtle bg-sidebar z-20 shadow-sm">
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
                  active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted hover:bg-surface hover:text-main"
                )}
              >
                <Icon className={clsx("h-6 w-6", active ? "stroke-[2.5px]" : "stroke-[2px]")} />
                {badge && (
                  <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-error border-2 border-sidebar" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-4 w-full">
          <Link
            to="/archive"
            title="Archive"
            className="flex items-center justify-center h-12 w-12 rounded-2xl text-muted hover:bg-surface hover:text-main transition-colors"
          >
            <Archive className="h-6 w-6" />
          </Link>
          <Link
            to="/settings"
            title="Settings"
            className={clsx(
              "flex items-center justify-center h-12 w-12 rounded-2xl transition-colors",
              location.pathname.startsWith("/settings") ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted hover:bg-surface hover:text-main"
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
        "flex w-full md:w-[380px] flex-col border-r border-border-subtle bg-surface z-10 shrink-0 transition-all",
        location.pathname === "/" ? "" : "hidden md:flex"
      )}>
        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-main">Chats</h1>
          <div className="flex items-center gap-1">
            <button className="rounded-full p-2 text-muted hover:bg-card hover:text-main transition-colors" title="Filter unread">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <Link to="/new-chat" className="rounded-full p-2 text-primary hover:bg-primary/10 transition-colors" title="New Chat">
              <Plus className="h-6 w-6 stroke-[2.5px]" />
            </Link>
          </div>
        </header>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start a new chat"
              className="w-full rounded-2xl bg-card border border-border-subtle py-2.5 pl-11 pr-4 text-[15px] text-main outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
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

          <AnimatePresence>
            {filtered.map((conv) => {
              const preview = getLastMessagePreview(conv);
              const isActive = location.pathname === `/chat/${conv.id}`;
              const isTyping = Boolean(globalTyping[conv.id]?.length);

              return (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    to={`/chat/${conv.id}`}
                    className={clsx(
                      "group relative flex items-center gap-3.5 rounded-2xl px-3 py-3 mb-1 transition-all",
                      isActive ? "bg-primary text-white shadow-md shadow-primary/20" : "hover:bg-card"
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
                        <p className="truncate font-semibold text-[15px] tracking-tight">{getConversationTitle(conv, user!.id)}</p>
                        {conv.last_message_at && (
                          <span className={clsx(
                            "text-[11px] font-medium shrink-0 ml-2 transition-colors",
                            isActive ? "text-white/80" : "text-muted group-hover:text-main"
                          )}>
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={clsx(
                          "truncate text-[13px] transition-colors flex-1 mr-2",
                          isActive ? "text-white/90" : (isTyping ? "text-primary font-medium" : "text-muted")
                        )}>
                          {isTyping ? "typing..." : (preview ?? (
                            conv.type === "group" ? "Group chat" : "Tap to chat"
                          ))}
                        </p>
                        {/* Example Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.type === "group" && !isActive && (
                            <span className="rounded-full bg-card border border-border-subtle px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-muted">
                              group
                            </span>
                          )}
                          {/* Unread dot placeholder */}
                          {/* <div className="h-5 min-w-[20px] rounded-full bg-primary flex items-center justify-center px-1">
                                <span className="text-[11px] font-bold text-white">2</span>
                              </div> */}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
