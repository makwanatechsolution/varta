import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  MessageCircle, Phone, CircleDot, Settings, Search,
  Plus, CalendarDays, Archive, LogOut, ShieldAlert
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useConversations, useGlobalTyping } from "../../hooks/useChat";
import { useStories } from "../../hooks/useStories";
import { Avatar } from "../ui/Avatar";
import { StoryBar, StoryViewer } from "../stories/StoryViewer";
import type { StatusStory, Conversation } from "../../types/database";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useSettings } from "../../contexts/SettingsContext";
import { formatChatTime } from "../../lib/time";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConversationTitle(conv: Conversation, myId: string) {
  if (conv.title) return conv.title;
  return conv.members?.find((m) => m.user_id !== myId)?.profile?.display_name ?? "Chat";
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

// ─── Unread tracking ──────────────────────────────────────────────────────────
const STORAGE_KEY = "varta_last_read";

function getLastReadMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function markConversationRead(conversationId: string) {
  const map = getLastReadMap();
  map[conversationId] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading } = useConversations();
  const { typingMap, syncTypingChannels } = useGlobalTyping(user?.id);
  const { stories, myStories, markViewed, postStory } = useStories();
  const [viewerStories, setViewerStories] = useState<StatusStory[] | null>(null);
  const [search, setSearch] = useState("");
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>(getLastReadMap);
  const { timeFormat } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // On mobile, are we showing the chat list or the content panel?
  const isMobileShowingContent = location.pathname !== "/";

  // Sync typing channels whenever conversations change
  useEffect(() => {
    if (!conversations.length) return;
    syncTypingChannels(conversations.map((c) => c.id));
  }, [conversations, syncTypingChannels]);

  // Mark current conversation as read
  useEffect(() => {
    const match = location.pathname.match(/^\/chat\/(.+)$/);
    if (match) {
      markConversationRead(match[1]);
      setLastReadMap(getLastReadMap());
    }
  }, [location.pathname]);

  const filtered = conversations.filter((c) =>
    getConversationTitle(c, user!.id).toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = conversations.filter((c) => {
    const msg = Array.isArray((c as any).last_message)
      ? (c as any).last_message[0] : (c as any).last_message;
    if (!msg) return false;
    if (msg.sender_id === user?.id) return false;
    if (location.pathname === `/chat/${c.id}`) return false;
    const lastRead = lastReadMap[c.id];
    if (!lastRead) return true;
    return (c.last_message_at ?? "") > lastRead;
  }).length;

  const handleAddStory = async () => {
    const text = prompt("What's on your mind?");
    if (text) await postStory({ media_type: "text", text_content: text, background_color: "#6366f1" });
  };

  // ── Nav items (desktop left-rail + mobile bottom bar) ────────────────────
  const navItems = [
    { path: "/", icon: MessageCircle, label: "Chats", badge: unreadCount > 0 ? unreadCount : null },
    { path: "/calls", icon: Phone, label: "Calls" },
    { path: "/status", icon: CircleDot, label: "Status" },
    { path: "/meetings", icon: CalendarDays, label: "Meetings" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    // Use 100dvh — shrinks when keyboard opens on iOS/Android
    <div
      className="flex overflow-hidden font-sans"
      style={{ height: "100dvh", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP: Left navigation rail (hidden on mobile)
      ═══════════════════════════════════════════════════════════════════ */}
      <nav
        className="hidden md:flex flex-col items-center py-4 w-[68px] shrink-0 z-20 border-r"
        style={{ backgroundColor: "var(--nav-rail-bg)", borderColor: "var(--border-subtle)" }}
      >
        {/* Avatar */}
        <Link to="/settings" className="mb-5 mt-2" title="Profile" style={{ minHeight: "unset", minWidth: "unset" }}>
          <Avatar src={profile?.avatar_url} name={profile?.display_name ?? "You"} presence={profile?.presence} size="md" showRing />
        </Link>

        {/* Nav icons */}
        <div className="flex flex-col items-center gap-2 flex-1 w-full px-2">
          {navItems.slice(0, 4).map(({ path, icon: Icon, label, badge }) => {
            const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                title={label}
                className="relative flex items-center justify-center h-11 w-11 rounded-2xl transition-all"
                style={active
                  ? { backgroundColor: "var(--color-primary)", color: "#fff", minHeight: "unset", minWidth: "unset" }
                  : { color: "var(--text-muted)", minHeight: "unset", minWidth: "unset" }
                }
              >
                <Icon className="h-5 w-5" />
                {badge != null && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-2 px-2 pb-2">
          {profile?.is_admin && (
            <Link to="/admin" title="Admin" className="flex items-center justify-center h-11 w-11 rounded-2xl"
              style={location.pathname.startsWith("/admin")
                ? { backgroundColor: "var(--color-primary)", color: "#fff", minHeight: "unset", minWidth: "unset" }
                : { color: "#f59e0b", minHeight: "unset", minWidth: "unset" }
              }
            >
              <ShieldAlert className="h-5 w-5" />
            </Link>
          )}
          <Link to="/archive" title="Archive" className="flex items-center justify-center h-11 w-11 rounded-2xl"
            style={{ color: "var(--text-muted)", minHeight: "unset", minWidth: "unset" }}
          >
            <Archive className="h-5 w-5" />
          </Link>
          <Link to="/settings" title="Settings" className="flex items-center justify-center h-11 w-11 rounded-2xl"
            style={location.pathname.startsWith("/settings")
              ? { backgroundColor: "var(--color-primary)", color: "#fff", minHeight: "unset", minWidth: "unset" }
              : { color: "var(--text-muted)", minHeight: "unset", minWidth: "unset" }
            }
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button onClick={signOut} title="Log Out" className="flex items-center justify-center h-11 w-11 rounded-2xl"
            style={{ color: "#ef4444", minHeight: "unset", minWidth: "unset" }}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          SIDEBAR: Conversation list
          — Desktop: always visible (fixed width)
          — Mobile: full-screen when on "/" route, hidden otherwise
      ═══════════════════════════════════════════════════════════════════ */}
      <aside
        className={clsx(
          "flex flex-col z-10 shrink-0 border-r",
          // Desktop: fixed 360px wide
          "md:w-[360px] md:flex",
          // Mobile: full-screen list OR hidden (behind chat room)
          isMobileShowingContent ? "hidden" : "flex w-full"
        )}
        style={{ backgroundColor: "var(--bg-sidebar)", borderColor: "var(--border-subtle)" }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0"
          style={{ backgroundColor: "var(--bg-header)", paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
        >
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text-main)" }}>Chats</h1>
          <div className="flex gap-1">
            <button className="h-9 w-9 rounded-full flex items-center justify-center" style={{ color: "var(--text-muted)" }} title="Filter">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <Link to="/new-chat" className="h-9 w-9 rounded-full flex items-center justify-center" style={{ color: "var(--color-primary)", minHeight: "unset", minWidth: "unset" }} title="New Chat">
              <Plus className="h-6 w-6" />
            </Link>
          </div>
        </header>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start a new chat"
              className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none border"
              style={{ backgroundColor: "var(--input-bg)", color: "var(--text-main)", borderColor: "var(--border-subtle)" }}
            />
          </div>
        </div>

        {/* Story bar */}
        {(stories.length > 0 || myStories.length > 0) && (
          <div className="shrink-0 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <StoryBar myStories={myStories} contactStories={stories} onAddStory={handleAddStory} onOpenStory={(s) => setViewerStories(s)} />
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-2" style={{ backgroundColor: "var(--bg-sidebar)" }}>
          {loading && (
            <div className="flex justify-center p-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              <MessageCircle className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium">{search ? `No results for "${search}"` : "No conversations yet."}</p>
            </div>
          )}
          {filtered.map((conv) => {
            const preview = getLastMessagePreview(conv);
            const isActive = location.pathname === `/chat/${conv.id}`;
            const isTyping = Boolean(typingMap[conv.id]?.length);
            const title = getConversationTitle(conv, user!.id);
            return (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`}
                className="flex items-center gap-3 px-4 py-3.5 w-full transition-all relative border-l-4"
                style={isActive
                  ? {
                      backgroundColor: "rgba(30,136,199,0.12)",
                      borderColor: "var(--color-primary)",
                    }
                  : {
                      borderColor: "transparent",
                      color: "var(--text-main)",
                    }
                }
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                <Avatar
                  src={getConversationAvatar(conv, user!.id)}
                  name={title}
                  presence={getOtherPresence(conv, user!.id)}
                  showRing={!isActive}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className="truncate font-semibold text-[14px]" style={{ color: "var(--text-main)" }}>
                      {title}
                    </p>
                    {conv.last_message_at && (
                      <span className="shrink-0 text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {formatChatTime(conv.last_message_at, timeFormat)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[12px] mt-0.5"
                    style={{
                      color: isTyping ? "var(--color-primary)" : "var(--text-muted)"
                    }}
                  >
                    {isTyping ? "typing..." : preview ?? (conv.type === "group" ? "Group chat" : "Tap to chat")}
                  </p>
                </div>
              </Link>
            );
          })}
          {/* Bottom padding for mobile bottom nav */}
          <div className="h-16 md:hidden" />
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          — Desktop: flex-1 always visible
          — Mobile: full-screen when NOT on "/"
      ═══════════════════════════════════════════════════════════════════ */}
      <main
        className={clsx(
          "flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden",
          isMobileShowingContent ? "flex" : "hidden md:flex"
        )}
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        {location.pathname === "/" ? (
          /* Desktop placeholder */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-5 p-12 max-w-xs text-center">
              <div className="rounded-3xl p-8 border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                <MessageCircle className="h-16 w-16" style={{ color: "var(--color-primary)" }} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-light" style={{ color: "var(--text-main)" }}>Varta Desktop</h1>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Select a conversation to start messaging
                </p>
              </div>
              <button
                onClick={() => navigate("/new-chat")}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-all"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                New conversation
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="flex-1 flex flex-col overflow-hidden h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE BOTTOM NAVIGATION BAR (WhatsApp-style)
          Hidden inside individual chat rooms (/chat/:id) so composer takes full bottom
      ═══════════════════════════════════════════════════════════════════ */}
      {!location.pathname.startsWith("/chat/") && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 border-t z-30 flex"
          style={{
            backgroundColor: "var(--bottom-nav-bg)",
            borderColor: "var(--border-subtle)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {navItems.map(({ path, icon: Icon, label, badge }) => {
            const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium"
                style={{ color: active ? "var(--color-primary)" : "var(--text-muted)", minHeight: "unset", minWidth: "unset" }}
              >
                <div className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} />
                  {badge != null && (
                    <span className="absolute -top-1 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span>{label}</span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-pip"
                    className="absolute -bottom-[1px] left-1/2 h-0.5 w-6 rounded-t-full -translate-x-1/2"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Story viewer */}
      <AnimatePresence>
        {viewerStories && (
          <StoryViewer stories={viewerStories} onClose={() => setViewerStories(null)} onView={markViewed} />
        )}
      </AnimatePresence>
    </div>
  );
}
