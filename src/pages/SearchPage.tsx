import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, MessageCircle, User, Hash, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { supabase } from "../lib/supabase";
import type { Message, Profile, Conversation } from "../types/database";
import { formatDistanceToNow } from "date-fns";
import { createDirectConversation } from "../hooks/useChat";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResults {
  messages: (Message & { conversation?: { id: string; title: string | null; type: string } })[];
  users: Profile[];
  conversations: Conversation[];
}

// ─── Highlight matching text ──────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[#25D366]/30 text-[#25D366] rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Recent searches stored in localStorage ───────────────────────────────────

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem("varta_recent_searches") ?? "[]"); }
  catch { return []; }
}
function addRecentSearch(q: string) {
  try {
    const prev = getRecentSearches();
    const next = [q, ...prev.filter((x) => x !== q)].slice(0, 8);
    localStorage.setItem("varta_recent_searches", JSON.stringify(next));
  } catch { /* noop */ }
}
function clearRecentSearches() {
  localStorage.removeItem("varta_recent_searches");
}

// ─── SearchPage ───────────────────────────────────────────────────────────────

export function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ messages: [], users: [], conversations: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "messages" | "people" | "groups">("all");
  const [recent, setRecent] = useState<string[]>(getRecentSearches);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !user) {
      setResults({ messages: [], users: [], conversations: [] });
      return;
    }
    setLoading(true);

    // Get my conversation IDs for scoping message search
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const convIds = memberships?.map((m: any) => m.conversation_id) ?? [];

    // Run all 3 queries in parallel
    const [messagesResult, usersResult, conversationsResult] = await Promise.allSettled([
      // Messages — full-text ilike search across content
      convIds.length > 0
        ? supabase
            .from("messages")
            .select(`
              id, conversation_id, sender_id, type, content, media_url, gif_url,
              created_at, is_deleted,
              sender:profiles!sender_id(id, display_name, avatar_url),
              conversation:conversations!conversation_id(id, title, type)
            `)
            .in("conversation_id", convIds)
            .ilike("content", `%${q}%`)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),

      // Users — search by name OR username
      supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, presence, bio")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%,bio.ilike.%${q}%`)
        .neq("id", user.id)
        .limit(20),

      // Conversations — search by title (groups & channels)
      convIds.length > 0
        ? supabase
            .from("conversations")
            .select(`id, title, type, avatar_url, description, last_message_at,
              members:conversation_members(count)`)
            .in("id", convIds)
            .neq("type", "direct")
            .ilike("title", `%${q}%`)
            .limit(15)
        : Promise.resolve({ data: [] }),
    ]);

    setResults({
      messages: (messagesResult.status === "fulfilled" ? (messagesResult.value as any).data : []) as Message[],
      users: (usersResult.status === "fulfilled" ? (usersResult.value as any).data : []) as Profile[],
      conversations: (conversationsResult.status === "fulfilled" ? (conversationsResult.value as any).data : []) as Conversation[],
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => doSearch(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim()) addRecentSearch(q.trim());
  };

  const handleUserSelect = async (profile: Profile) => {
    if (!user) return;
    const conv = await createDirectConversation(profile.id, user.id);
    navigate(`/chat/${conv.id}`);
  };

  const totalResults = results.messages.length + results.users.length + results.conversations.length;
  const hasQuery = query.trim().length > 0;

  const TABS = [
    { id: "all" as const, label: "All", count: totalResults },
    { id: "messages" as const, label: "Messages", count: results.messages.length },
    { id: "people" as const, label: "People", count: results.users.length },
    { id: "groups" as const, label: "Groups", count: results.conversations.length },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#111b21] shadow-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>

          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && handleSearch(query)}
              placeholder="Search messages, people, groups..."
              className="w-full rounded-xl bg-[#202c33] py-2.5 pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#25D366]/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" />}
        </div>

        {/* Tabs — only show when there are results */}
        {hasQuery && (
          <div className="flex border-b border-zinc-800 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-[#25D366] text-[#25D366]"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === tab.id ? "bg-[#25D366]/20 text-[#25D366]" : "bg-zinc-700 text-zinc-400"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Empty / initial state */}
        {!hasQuery && (
          <div className="px-4 py-4">
            {recent.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Recent searches
                  </p>
                  <button
                    type="button"
                    onClick={() => { clearRecentSearches(); setRecent([]); }}
                    className="text-xs text-zinc-600 hover:text-zinc-400"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQuery(r)}
                      className="flex items-center gap-1.5 rounded-full bg-[#202c33] px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      <Clock className="h-3 w-3 text-zinc-500" />
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recent.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <Search className="mb-4 h-12 w-12 opacity-30" />
                <p className="text-base font-medium text-zinc-500">Search Varta</p>
                <p className="mt-1 text-sm opacity-60 text-center max-w-xs">
                  Find messages, people, groups, and channels across all your conversations
                </p>
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {hasQuery && !loading && totalResults === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <Search className="mb-4 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium text-zinc-500">No results for "{query}"</p>
            <p className="mt-1 text-xs opacity-60">Try different keywords or check spelling</p>
          </div>
        )}

        {/* ── People ── */}
        {hasQuery && (activeTab === "all" || activeTab === "people") && results.users.length > 0 && (
          <section className="border-b border-zinc-800/50">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <User className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">People</p>
            </div>
            {results.users.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleUserSelect(profile)}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[#111b21] transition-colors"
              >
                <Avatar
                  src={profile.avatar_url}
                  name={profile.display_name}
                  presence={profile.presence}
                  showRing
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-white">
                    <Highlight text={profile.display_name} query={query} />
                  </p>
                  {profile.username && (
                    <p className="text-xs text-zinc-500">
                      @<Highlight text={profile.username} query={query} />
                    </p>
                  )}
                  {profile.bio && (
                    <p className="mt-0.5 truncate text-xs text-zinc-600">
                      <Highlight text={profile.bio} query={query} />
                    </p>
                  )}
                </div>
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  profile.presence === "online" ? "bg-[#25D366]" :
                  profile.presence === "away" ? "bg-amber-400" :
                  profile.presence === "busy" ? "bg-red-500" : "bg-zinc-600"
                }`} />
              </button>
            ))}
          </section>
        )}

        {/* ── Groups & Channels ── */}
        {hasQuery && (activeTab === "all" || activeTab === "groups") && results.conversations.length > 0 && (
          <section className="border-b border-zinc-800/50">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <Hash className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Groups & Channels</p>
            </div>
            {results.conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#111b21] transition-colors"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#202c33] text-xl">
                  {conv.type === "channel" ? "📢" : "👥"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    <Highlight text={conv.title ?? "Group"} query={query} />
                  </p>
                  <p className="text-xs capitalize text-zinc-500">
                    {conv.type}
                    {conv.description && (
                      <span className="ml-1 text-zinc-600">
                        · <Highlight text={conv.description} query={query} />
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* ── Messages ── */}
        {hasQuery && (activeTab === "all" || activeTab === "messages") && results.messages.length > 0 && (
          <section>
            <div className="flex items-center gap-2 px-4 py-2.5">
              <MessageCircle className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Messages</p>
            </div>
            {results.messages.map((msg) => {
              const conv = (msg as any).conversation;
              return (
                <Link
                  key={msg.id}
                  to={`/chat/${msg.conversation_id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-[#111b21] transition-colors"
                  onClick={() => addRecentSearch(query)}
                >
                  <Avatar
                    src={(msg.sender as any)?.avatar_url}
                    name={(msg.sender as any)?.display_name ?? "Unknown"}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {(msg.sender as any)?.display_name ?? "Unknown"}
                        {conv?.title && (
                          <span className="ml-1.5 text-xs font-normal text-zinc-500">
                            in {conv.title}
                          </span>
                        )}
                      </p>
                      <span className="shrink-0 text-[10px] text-zinc-600">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-zinc-400">
                      {msg.type === "image" ? "📷 Photo" :
                       msg.type === "video" ? "🎥 Video" :
                       msg.type === "gif" ? "🎞 GIF" : (
                        <Highlight text={msg.content ?? ""} query={query} />
                      )}
                    </p>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
