import { useState, useEffect, useRef } from "react";
import type { GifResult } from "../../types/database";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";
import { useGifSearch } from "../../hooks/useGifSearch";

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}

const CATEGORIES = [
  { label: "Trending", q: "" },
  { label: "Reactions", q: "reactions" },
  { label: "Funny", q: "funny" },
  { label: "Love", q: "love" },
  { label: "Sad", q: "sad" },
  { label: "Anime", q: "anime" },
  { label: "Memes", q: "memes" },
  { label: "Celebration", q: "celebration" },
];

export function GifPicker({ open, onClose, onSelect }: GifPickerProps) {
  const { query, setQuery, results, loading, provider, setProvider } = useGifSearch();
  const [activeCategory, setActiveCategory] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Load trending on open
      if (!query) setQuery("");
    }
  }, [open, query, setQuery]);

  const handleCategory = (idx: number, q: string) => {
    setActiveCategory(idx);
    setQuery(q);
  };

  if (!open) return null;

  return (
    <div
      className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-lg rounded-2xl border border-zinc-700/50 bg-[#111b21] shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 pt-3 pb-2">
        {/* Provider tabs */}
        <div className="flex rounded-lg bg-[#202c33] p-0.5">
          {(["tenor", "giphy"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-all ${
                provider === p
                  ? "bg-[#1E88C7] text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {p === "tenor" ? "🎵 Tenor" : "🎨 Giphy"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveCategory(-1);
            }}
            placeholder="Search GIFs..."
            className="w-full rounded-lg bg-[#202c33] py-1.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setActiveCategory(0); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide border-b border-zinc-800/50">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleCategory(i, cat.q)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activeCategory === i && !query
                ? "bg-[#1E88C7] text-white"
                : "bg-[#202c33] text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {i === 0 && <TrendingUp className="h-3 w-3" />}
            {cat.label}
          </button>
        ))}
      </div>

      {/* GIF Grid */}
      <div className="h-72 overflow-y-auto p-2">
        {loading && results.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Loading GIFs...</span>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
            <span className="text-2xl">🔍</span>
            <span className="text-sm">No GIFs found for "{query}"</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="columns-3 gap-1.5 space-y-1.5">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => { onSelect(gif); onClose(); }}
                className="group relative w-full overflow-hidden rounded-lg hover:ring-2 hover:ring-[#1E88C7] transition-all"
              >
                <img
                  src={gif.preview}
                  alt=""
                  className="w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Provider badge */}
                <span className={`absolute bottom-1 right-1 rounded px-1 py-0.5 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${
                  gif.provider === "tenor" ? "bg-blue-500/80" : "bg-purple-500/80"
                } text-white`}>
                  {gif.provider}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Loading more indicator */}
        {loading && results.length > 0 && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          </div>
        )}
      </div>

      {/* Footer attribution */}
      <div className="flex items-center justify-center gap-4 border-t border-zinc-800/50 px-3 py-1.5">
        <a
          href="https://tenor.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Powered by Tenor
        </a>
        <span className="text-zinc-700">·</span>
        <a
          href="https://giphy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Powered by GIPHY
        </a>
      </div>
    </div>
  );
}
