import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  X,
  Flame,
  Star,
  Clock,
  Grid,
  Loader2,
  Send,
  Copy,
  Check,
  Maximize2,
} from "lucide-react";
import { vartaGifService, GIF_CATEGORIES, type VartaGif } from "../../services/vartaGifService";
import type { GifResult } from "../../types/database";

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}

export function GifPicker({ open, onClose, onSelect }: GifPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"trending" | "categories" | "favorites" | "recent">("trending");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const [gifs, setGifs] = useState<VartaGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [previewGif, setPreviewGif] = useState<VartaGif | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Click outside handler to close GIF section automatically
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open, onClose]);

  // Load GIF content when picker opens or parameters change
  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      if (activeTab === "favorites") {
        setGifs(vartaGifService.getFavorites());
      } else {
        const results = await vartaGifService.searchGIFs(query);
        setGifs(results);
      }
    } catch (e) {
      console.warn("Failed to load GIFs", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (open) {
      setRecentSearches(vartaGifService.getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 80);
      fetchGifs(searchQuery);
    }
  }, [open, fetchGifs]);

  // Debounced live search
  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    setActiveCategory(null);
    if (val.trim()) {
      setActiveTab("trending");
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      fetchGifs(val);
    }, 300);
  };

  const handleSelectCategory = (catName: string) => {
    setActiveCategory(catName);
    setSearchQuery(catName);
    fetchGifs(catName);
  };

  const handleSelectRecentSearch = (term: string) => {
    setSearchQuery(term);
    fetchGifs(term);
  };

  const handleSendGif = (gif: VartaGif) => {
    onSelect({
      id: gif.id,
      url: gif.url,
      preview: gif.thumbnail,
      provider: gif.provider as any,
      width: gif.width,
      height: gif.height,
    });
    onClose();
  };

  const handleCopyLink = (gif: VartaGif) => {
    navigator.clipboard.writeText(gif.url);
    setCopiedId(gif.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!open) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 z-50 mb-3 w-[420px] max-w-[92vw] h-[520px] rounded-3xl border border-zinc-800 bg-[#111b21] shadow-2xl overflow-hidden flex flex-col backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-3 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Top Header & Search Bar ────────────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800/80 bg-[#0b141a]/60 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full rounded-2xl bg-[#202c33] py-2.5 pl-10 pr-9 text-xs text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-[#1E88C7]/30 transition-all font-medium"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : loading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1E88C7] animate-spin" />
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-[#202c33] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setActiveTab("trending"); setSearchQuery(""); fetchGifs(""); }}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition-all ${
              activeTab === "trending" ? "bg-[#1E88C7] text-white shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Trending</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition-all ${
              activeTab === "categories" ? "bg-[#1E88C7] text-white shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("favorites"); fetchGifs(""); }}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition-all ${
              activeTab === "favorites" ? "bg-[#1E88C7] text-white shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Categories Grid (When Categories tab is selected) */}
        {activeTab === "categories" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {GIF_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.name)}
                className={`p-3 rounded-2xl border flex items-center gap-3 transition-all hover:scale-[1.02] text-left ${
                  activeCategory === cat.name
                    ? "bg-[#1E88C7]/20 border-[#1E88C7] text-white"
                    : "bg-[#202c33]/70 border-zinc-800/80 text-zinc-300 hover:bg-[#202c33]"
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="font-semibold text-xs">{cat.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Reaction Categories Horizontal Scroll (when on Trending) */}
            {activeTab === "trending" && !searchQuery && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {GIF_CATEGORIES.slice(0, 10).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.name)}
                    className="shrink-0 flex items-center gap-1.5 rounded-full bg-[#202c33] hover:bg-zinc-700 px-3 py-1.5 text-xs text-white border border-zinc-700/50 transition-all active:scale-95"
                  >
                    <span>{cat.emoji}</span>
                    <span className="font-medium">{cat.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Recent Searches Pills */}
            {recentSearches.length > 0 && !searchQuery && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Recent Searches
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      vartaGifService.clearRecentSearches();
                      setRecentSearches([]);
                    }}
                    className="hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.slice(0, 5).map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSelectRecentSearch(term)}
                      className="rounded-xl bg-[#202c33]/80 hover:bg-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center justify-center py-12 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin text-[#1E88C7]" />
              </div>
            )}

            {/* Masonry Pinterest-style Adaptive GIF Grid */}
            {!loading && (
              <div className="columns-2 gap-2.5 space-y-2.5">
                {gifs.map((gif) => (
                  <div
                    key={gif.id}
                    className="group relative rounded-2xl overflow-hidden bg-[#202c33] cursor-pointer break-inside-avoid border border-zinc-800/60 shadow-md hover:shadow-xl transition-all duration-200"
                    onClick={() => handleSendGif(gif)}
                  >
                    <img
                      src={gif.thumbnail || gif.url}
                      alt={gif.title}
                      loading="lazy"
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Hover Overlay Controls */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewGif(gif);
                          }}
                          className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                          title="Preview"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/90 truncate max-w-[120px]">
                          {gif.title}
                        </span>
                        <div className="h-7 w-7 rounded-full bg-[#1E88C7] flex items-center justify-center text-white shadow-lg">
                          <Send className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && gifs.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-xs font-medium space-y-2">
                <p>No GIFs found matching your search.</p>
                <button
                  type="button"
                  onClick={() => handleQueryChange("trending")}
                  className="text-[#1E88C7] hover:underline"
                >
                  View Trending GIFs
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Fullscreen GIF Preview Modal ─────────────────────────────────────── */}
      {previewGif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setPreviewGif(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-64 border border-zinc-800">
              <img src={previewGif.url} alt={previewGif.title} className="max-h-64 object-contain" />
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-white text-sm">{previewGif.title}</h4>
              <p className="text-[11px] text-zinc-500 font-mono">
                {previewGif.width} × {previewGif.height} px
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleCopyLink(previewGif)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#202c33] py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                {copiedId === previewGif.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{copiedId === previewGif.id ? "Copied!" : "Copy Link"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSendGif(previewGif);
                  setPreviewGif(null);
                }}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#1E88C7] py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-[#1971A5] transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Send GIF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
