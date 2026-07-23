import { useState, useRef, useEffect } from "react";
import type { GifResult } from "../../types/database";
import { Search, X, ExternalLink, Send } from "lucide-react";

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}

export function GifPicker({ open, onClose, onSelect }: GifPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    window.open(`https://giphy.com/search/${encodeURIComponent(searchQuery)}`, "_blank");
  };

  const handleSend = () => {
    if (!pasteUrl.trim()) return;
    // Basic validation to ensure it's a URL
    try {
      new URL(pasteUrl);
      onSelect({
        id: Date.now().toString(),
        url: pasteUrl,
        preview: pasteUrl,
        provider: "giphy",
        width: 480,
        height: 480,
      });
      setPasteUrl("");
      setSearchQuery("");
      onClose();
    } catch {
      alert("Please enter a valid URL");
    }
  };

  if (!open) return null;

  return (
    <div
      className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-sm rounded-2xl border border-zinc-700/50 bg-[#111b21] shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-white">Send a GIF</h3>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Search */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            1. Find on Giphy
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search keywords..."
                className="w-full rounded-lg bg-[#202c33] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1E88C7] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#1971A5] transition-colors"
            >
              Search <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            Opens Giphy in a new tab. Find a GIF you like, right-click it, and select "Copy Image Address" (or "Copy Link").
          </p>
        </div>

        <hr className="border-zinc-800" />

        {/* Step 2: Paste */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            2. Paste Link Here
          </label>
          <div className="flex gap-2">
            <input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="https://media.giphy.com/..."
              className="flex-1 rounded-lg bg-[#202c33] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              onClick={handleSend}
              disabled={!pasteUrl.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1E88C7] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#1971A5] transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preview */}
        {pasteUrl.trim() && (
          <div className="mt-2 flex justify-center rounded-lg border border-zinc-800 bg-black/20 p-2">
            <img 
              src={pasteUrl} 
              alt="GIF Preview" 
              className="max-h-32 rounded object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1MjUyNTIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxsaW5lIHgxPSIxMiIgeTE9IjgiIHgyPSIxMiIgeTI9IjEyIi8+PGxpbmUgeDE9IjEyIiB5MT0iMTYiIHgyPSIxMi4wMSIgeTI9IjE2Ii8+PC9zdmc+';
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
