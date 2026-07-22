import { useState, useEffect, useRef, useCallback } from "react";
import type { GifResult } from "../types/database";

// ─── Tenor normalizer ─────────────────────────────────────────────────────────

function normalizeTenor(items: unknown[]): GifResult[] {
  return (items as Array<{
    id: string;
    media_formats: {
      gif: { url: string; dims: [number, number] };
      tinygif: { url: string };
      nanogif?: { url: string };
      gifpreview?: { url: string };
    };
    content_description: string;
  }>).map((item) => ({
    id: `tenor-${item.id}`,
    url: item.media_formats.gif.url,
    preview:
      item.media_formats.nanogif?.url ??
      item.media_formats.tinygif?.url ??
      item.media_formats.gifpreview?.url ??
      item.media_formats.gif.url,
    width: item.media_formats.gif.dims?.[0] ?? 200,
    height: item.media_formats.gif.dims?.[1] ?? 200,
    provider: "tenor" as const,
  }));
}

// ─── Giphy normalizer ─────────────────────────────────────────────────────────

function normalizeGiphy(items: unknown[]): GifResult[] {
  return (items as Array<{
    id: string;
    images: {
      fixed_height: { url: string; width: string; height: string };
      fixed_height_small: { url: string };
      preview_gif: { url: string };
      downsized_medium: { url: string };
    };
  }>).map((item) => ({
    id: `giphy-${item.id}`,
    url: item.images.downsized_medium?.url ?? item.images.fixed_height.url,
    preview:
      item.images.fixed_height_small?.url ??
      item.images.preview_gif?.url ??
      item.images.fixed_height.url,
    width: parseInt(item.images.fixed_height.width, 10),
    height: parseInt(item.images.fixed_height.height, 10),
    provider: "giphy" as const,
  }));
}

// ─── API fetchers ─────────────────────────────────────────────────────────────

async function fetchTenor(q: string, limit = 30): Promise<GifResult[]> {
  const key = import.meta.env.VITE_TENOR_API_KEY;
  if (!key) return [];
  const base = "https://tenor.googleapis.com/v2";
  const url = q
    ? `${base}/search?q=${encodeURIComponent(q)}&key=${key}&limit=${limit}&contentfilter=medium`
    : `${base}/featured?key=${key}&limit=${limit}&contentfilter=medium`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return normalizeTenor(data.results ?? []);
}

async function fetchGiphy(q: string, limit = 30): Promise<GifResult[]> {
  const key = import.meta.env.VITE_GIPHY_API_KEY;
  if (!key) return [];
  const base = "https://api.giphy.com/v1/gifs";
  const url = q
    ? `${base}/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g`
    : `${base}/trending?api_key=${key}&limit=${limit}&rating=g`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return normalizeGiphy(data.data ?? []);
}

// ─── Both providers merged ────────────────────────────────────────────────────

function interleave(a: GifResult[], b: GifResult[]): GifResult[] {
  const seen = new Set<string>();
  const out: GifResult[] = [];
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    if (a[i] && !seen.has(a[i].url)) { seen.add(a[i].url); out.push(a[i]!); }
    if (b[i] && !seen.has(b[i].url)) { seen.add(b[i].url); out.push(b[i]!); }
  }
  return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type GifProvider = "tenor" | "giphy" | "both";

export function useGifSearch(initialProvider: GifProvider = "both") {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<GifProvider>(initialProvider);
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, prov: GifProvider) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setResults([]);

    try {
      if (prov === "tenor") {
        const r = await fetchTenor(q);
        setResults(r);
      } else if (prov === "giphy") {
        const r = await fetchGiphy(q);
        setResults(r);
      } else {
        // Both: stream results as they arrive
        const partial: { tenor: GifResult[]; giphy: GifResult[] } = { tenor: [], giphy: [] };
        const update = () => setResults(interleave(partial.tenor, partial.giphy));

        await Promise.allSettled([
          fetchTenor(q).then((r) => { partial.tenor = r; update(); }),
          fetchGiphy(q).then((r) => { partial.giphy = r; update(); }),
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => doSearch(query, provider), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, provider, doSearch]);

  return { query, setQuery, provider, setProvider, results, loading };
}
