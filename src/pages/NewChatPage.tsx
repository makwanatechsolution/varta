import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Search, Users, Plus, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { searchUsers, createDirectConversation, createGroupConversation } from "../hooks/useChat";
import { Avatar } from "../components/ui/Avatar";
import type { Profile } from "../types/database";

export function NewChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const tid = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setLoading(true);
      const found = await searchUsers(query);
      // exclude self
      setResults((found as Profile[]).filter((p) => p.id !== user?.id));
      setLoading(false);
    }, 300);
    return () => clearTimeout(tid);
  }, [query, user]);

  const handleSelectUser = async (profile: Profile) => {
    if (mode === "dm") {
      if (!user) return;
      setCreating(true);
      const conv = await createDirectConversation(profile.id, user.id);
      navigate(`/chat/${conv.id}`);
    } else {
      setSelected((prev) =>
        prev.some((p) => p.id === profile.id)
          ? prev.filter((p) => p.id !== profile.id)
          : [...prev, profile],
      );
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim() || selected.length === 0) return;
    setCreating(true);
    const conv = await createGroupConversation(
      groupName.trim(),
      selected.map((p) => p.id),
      user.id,
    );
    navigate(`/chat/${conv.id}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white">
      {/* Header */}
      <header className="flex items-center gap-4 bg-[#111b21] px-4 py-3">
        <Link to="/" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-semibold">New Chat</h1>
          <p className="text-xs text-zinc-500">
            {mode === "dm" ? "Find a contact to message" : `${selected.length} selected`}
          </p>
        </div>

        {/* Toggle DM / Group */}
        <button
          type="button"
          onClick={() => setMode(mode === "dm" ? "group" : "dm")}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          <Users className="h-3.5 w-3.5" />
          {mode === "dm" ? "Create group" : "Direct message"}
        </button>
      </header>

      {/* Group name input (group mode) */}
      {mode === "group" && (
        <div className="bg-[#111b21] px-4 pb-3 border-b border-zinc-800">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name..."
            className="w-full rounded-lg bg-[#202c33] px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 rounded-full bg-[#1E88C7]/20 px-2 py-1 text-xs text-[#1E88C7]"
                >
                  {p.display_name}
                  <button type="button" onClick={() => setSelected((prev) => prev.filter((x) => x.id !== p.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="relative px-4 py-3">
        <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username..."
          className="w-full rounded-lg bg-[#202c33] py-2 pl-10 pr-4 text-sm outline-none placeholder:text-zinc-500"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-sm text-zinc-500">Searching...</p>
        )}
        {!loading && query && results.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">No users found for "{query}"</p>
        )}
        {!query && (
          <p className="py-12 text-center text-sm text-zinc-600">
            Start typing to search users
          </p>
        )}

        {results.map((profile) => {
          const isSelected = selected.some((p) => p.id === profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelectUser(profile)}
              className={`flex w-full items-center gap-3 px-4 py-3 hover:bg-[#111b21] transition-colors ${isSelected ? "bg-[#1E88C7]/10" : ""}`}
            >
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name}
                presence={profile.presence}
                showRing
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium">{profile.display_name}</p>
                {profile.username && (
                  <p className="text-xs text-zinc-500">@{profile.username}</p>
                )}
              </div>
              {mode === "group" && isSelected && (
                <div className="h-5 w-5 rounded-full bg-[#1E88C7] flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Create group FAB */}
      {mode === "group" && selected.length > 0 && groupName.trim() && (
        <div className="p-4">
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E88C7] py-3 font-semibold text-white disabled:opacity-50 hover:bg-[#1971A5] transition-colors"
          >
            <Plus className="h-5 w-5" />
            {creating ? "Creating..." : `Create Group · ${selected.length + 1} members`}
          </button>
        </div>
      )}
    </div>
  );
}
