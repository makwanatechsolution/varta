import { useState, useEffect } from "react";
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

// ── Per-conversation lastReadAt tracking ──────────────────────────────────────
const STORAGE_KEY = "varta_last_read";

function getLastReadMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markConversationRead(conversationId: string) {
  const map = getLastReadMap();
  map[conversationId] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading } = useConversations();
  const { typingMap, syncTypingChannels } = useGlobalTyping(user?.id);
  const { stories, myStories, markViewed, postStory } = useStories();
  const [viewerStories, setViewerStories] = useState<StatusStory[] | null>(null);
  const [search, setSearch] = useState("");
  // BUG-11 FIX: per-conversation read timestamps for accurate unread badge
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>(getLastReadMap);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync typing channels whenever conversation list changes (BUG-4 fix wiring)
  useEffect(() => {
    if (!conversations.length) return;
    syncTypingChannels(conversations.map((c) => c.id));
  }, [conversations, syncTypingChannels]);

  // Mark current conversation as read when route changes
  useEffect(() => {
    const match = location.pathname.match(/^\/chat\/(.+)$/);
    if (match) {
      markConversationRead(match[1]);
      setLastReadMap(getLastReadMap());
    }
  }, [location.pathname]);

  const filtered = conversations.filter((c) =>
    getConversationTitle(c, user!.id).toLowerCase().includes(search.toLowerCase()),
  );

  // BUG-11 FIX: only count conversations where last_message_at is AFTER lastReadAt
  const unreadCount = conversations.filter((c) => {
    const msg = Array.isArray((c as any).last_message)
      ? (c as any).last_message[0]
      : (c as any).last_message;
    if (!msg) return false;
    const isFromOther = msg.sender_id !== user?.id;
    const isCurrentChat = location.pathname === `/chat/${c.id}`;
    if (isCurrentChat || !isFromOther) return false;
    const lastRead = lastReadMap[c.id];
    if (!lastRead) return true; // never opened
    return (c.last_message_at ?? "") > lastRead;
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
    <div className="flex h-screen overflow-hidden font-sans" style={{ backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}>

      {/* ─── Narrow Left Navigation Rail (Desktop) ──────────────────────── */}
      <nav
        className="hidden md:flex flex-col items-center py-6 w-[72px] shrink-0 z-20 shadow-xl border-r"
        style={{
          backgroundColor: "var(--nav-rail-bg)",
          borderColor: "var(--border-subtle)",
        }}
      >
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
                  active
                    ? "shadow-lg"
                    : "hover:opacity-80"
                )}
                style={active
                  ? { backgroundColor: "var(--color-primary)", color: "#fff" }
                  : { color: "var(--text-muted)" }
                }
              >
                <Icon className={clsx("h-6 w-6", active ? "stroke-[2.5px]" : "stroke-[2px]")} />
                {badge && (
                  <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2" style={{ borderColor: "var(--nav-rail-bg)" }} />
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
              )}
              style={location.pathname.startsWith("/admin")
                ? { backgroundColor: "var(--color-primary)", color: "#fff" }
                : { color: "#f59e0b" }
              }
            >
              <ShieldAlert className="h-6 w-6" />
            </Link>
          )}
          <Link
            to="/archive"
            title="Archived Chats"
            className="flex items-center justify-center h-12 w-12 rounded-2xl transition-colors hover:opacity-80"
            style={location.pathname.startsWith("/archive")
              ? { backgroundColor: "var(--color-primary)", color: "#fff" }
              : { color: "var(--text-muted)" }
            }
          >
            <Archive className="h-6 w-6" />
          </Link>
          <Link
            to="/settings"
            title="Settings"
            className="flex items-center justify-center h-12 w-12 rounded-2xl transition-colors hover:opacity-80"
            style={location.pathname.startsWith("/settings")
              ? { backgroundColor: "var(--color-primary)", color: "#fff" }
              : { color: "var(--text-muted)" }
            }
          >
            <Settings className="h-6 w-6" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            title="Log Out"
            className="flex items-center justify-center h-12 w-12 rounded-2xl transition-colors hover:opacity-80"
            style={{ color: "#ef4444" }}
          >
            <LogOut className="h-6 w-6 stroke-[2px]" />
          </button>
        </div>
      </nav>

      {/* ─── Secondary Sidebar (Conversation List) ──────────────────────── */}
      <aside
        className={clsx(
          "flex w-full md:w-[380px] flex-col z-10 shrink-0 transition-all border-r",
          location.pathname === "/" ? "" : "hidden md:flex"
        )}
        style={{ backgroundColor: "var(--bg-sidebar)", borderColor: "var(--border-subtle)" }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>Chats</h1>
          <div className="flex items-center gap-1">
            <button
              className="rounded-full p-2 transition-colors hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
              title="Filter unread"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <Link
              to="/new-chat"
              className="rounded-full p-2 transition-colors hover:opacity-70"
              style={{ color: "var(--color-primary)" }}
              title="New Chat"
            >
              <Plus className="h-6 w-6 stroke-[2.5px]" />
            </Link>
          </div>
        </header>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start a new chat"
              className="w-full rounded-2xl py-2.5 pl-11 pr-4 text-[15px] outline-none border shadow-sm composer-input"
              style={{
                backgroundColor: "var(--input-bg)",
                color: "var(--text-main)",
                borderColor: "var(--border-subtle)",
              }}
            />
          </div>
        </div>

        {/* Story bar */}
        {(stories.length > 0 || myStories.length > 0) && (
          <div className="px-2 pb-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <StoryBar
              myStories={myStories}
              contactStories={stories}
              onAddStory={handleAddStory}
              onOpenStory={handleOpenStory}
            />
          </div>
        )}

        {/* Mobile Nav tabs */}
        <nav className="flex border-b text-xs px-2 md:hidden" style={{ borderColor: "var(--border-subtle)" }}>
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className="relative flex flex-1 flex-col items-center gap-1 py-3 transition-colors"
                style={active
                  ? { color: "var(--color-primary)" }
                  : { color: "var(--text-muted)" }
                }
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium tracking-wide">{label}</span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ backgroundColor: "var(--color-primary)" }}
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">{search ? `No results for "${search}"` : "No conversations yet."}</p>
            </div>
          )}

          <div className="space-y-0.5">
            {filtered.map((conv) => {
              const preview = getLastMessagePreview(conv);
              const isActive = location.pathname === `/chat/${conv.id}`;
              const isTyping = Boolean(typingMap[conv.id]?.length);

              return (
                <div key={conv.id}>
                  <Link
                    to={`/chat/${conv.id}`}
                    className={clsx(
                      "group relative flex items-center gap-3.5 rounded-2xl px-3 py-3 mb-0.5 transition-all",
                    )}
                    style={isActive
                      ? { backgroundColor: "var(--color-primary)", color: "#fff" }
                      : { color: "var(--text-main)" }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-surface)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                    }}
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
                        <p className="truncate font-semibold text-[15px] tracking-tight" style={isActive ? { color: "#fff" } : { color: "var(--text-main)" }}>
                          {getConversationTitle(conv, user!.id)}
                        </p>
                        {conv.last_message_at && (
                          <span
                            className="text-[11px] font-medium shrink-0 ml-2 transition-colors"
                            style={isActive ? { color: "rgba(255,255,255,0.8)" } : { color: "var(--text-muted)" }}
                          >
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p
                          className="truncate text-[13px] transition-colors flex-1 mr-2"
                          style={isActive
                            ? { color: "rgba(255,255,255,0.9)" }
                            : isTyping
                              ? { color: "var(--color-primary)", fontWeight: 500 }
                              : { color: "var(--text-muted)" }
                          }
                        >
                          {isTyping ? "typing..." : (preview ?? (
                            conv.type === "group" ? "Group chat" : "Tap to chat"
                          ))}
                        </p>
                        {conv.type === "group" && !isActive && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold border"
                            style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}
                          >
                            group
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ─── Main content area ───────────────────────────────────────────── */}
      <main
        className={clsx(
          "relative flex-1 flex-col",
          location.pathname === "/" ? "hidden md:flex" : "flex"
        )}
        style={{ backgroundColor: "var(--bg-main)" }}
      >
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
                <div
                  className="rounded-3xl p-8 shadow-2xl backdrop-blur-3xl border"
                  style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                >
                  <MessageCircle className="h-20 w-20" style={{ color: "var(--color-primary)" }} />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-light tracking-tight" style={{ color: "var(--text-main)" }}>Varta Desktop</h1>
                  <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Send and receive messages seamlessly across your devices. End-to-end encrypted and beautifully designed.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/new-chat")}
                  className="mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
                  style={{ backgroundColor: "var(--color-primary)" }}
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

      {/* ─── Story viewer overlay ────────────────────────────────────────── */}
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
