// Varta Production Unified GIF Service
// Native Official Tenor Web API + Giphy Proxy Engine

export interface VartaGif {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  provider: "tenor" | "giphy" | "varta_cache";
  mp4_url?: string;
  aspect_ratio?: number;
}

export const GIF_CATEGORIES = [
  { id: "happy", name: "Happy", emoji: "😊" },
  { id: "love", name: "Love", emoji: "❤️" },
  { id: "laugh", name: "Laugh", emoji: "😂" },
  { id: "sad", name: "Sad", emoji: "😢" },
  { id: "angry", name: "Angry", emoji: "😡" },
  { id: "wow", name: "Wow", emoji: "😲" },
  { id: "thanks", name: "Thanks", emoji: "🙏" },
  { id: "hi", name: "Hi", emoji: "👋" },
  { id: "bye", name: "Bye", emoji: "🖐" },
  { id: "party", name: "Party", emoji: "🎉" },
  { id: "food", name: "Food", emoji: "🍕" },
  { id: "sports", name: "Sports", emoji: "⚽" },
  { id: "movies", name: "Movies", emoji: "🍿" },
  { id: "memes", name: "Memes", emoji: "🐸" },
  { id: "animals", name: "Animals", emoji: "🐱" },
  { id: "gaming", name: "Gaming", emoji: "🎮" },
];

const TENOR_WEB_KEY = "AIzaSyCZt6SSh5VgVPzD9fhyzG1DprdPRhtoaR4";

// Curated High Quality Fallback GIFs (Ensures Varta NEVER displays broken/empty images)
const CURATED_FALLBACK_GIFS: VartaGif[] = [
  {
    id: "cache-1",
    title: "Happy Cat Vibe",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeWs1ZXh4OHhieHZnZ2kxb3hqcHRiaTNxeGZzOGExbXFxZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/jpbnoe3UIa8TU8LM13/giphy.gif",
    thumbnail: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeWs1ZXh4OHhieHZnZ2kxb3hqcHRiaTNxeGZzOGExbXFxZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/jpbnoe3UIa8TU8LM13/200w.gif",
    width: 480,
    height: 270,
    provider: "varta_cache",
  },
  {
    id: "cache-2",
    title: "Mind Blown Wow",
    url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
    thumbnail: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.gif",
    width: 480,
    height: 270,
    provider: "varta_cache",
  },
  {
    id: "cache-3",
    title: "Popcorn Movie Time",
    url: "https://media.giphy.com/media/hVTouq08y8fzW/giphy.gif",
    thumbnail: "https://media.giphy.com/media/hVTouq08y8fzW/200w.gif",
    width: 480,
    height: 270,
    provider: "varta_cache",
  },
  {
    id: "cache-4",
    title: "Dancing Party",
    url: "https://media.giphy.com/media/l3q2t2KAyvM5ab8iY/giphy.gif",
    thumbnail: "https://media.giphy.com/media/l3q2t2KAyvM5ab8iY/200w.gif",
    width: 480,
    height: 270,
    provider: "varta_cache",
  },
  {
    id: "cache-5",
    title: "Laughing Out Loud",
    url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif",
    thumbnail: "https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif",
    width: 480,
    height: 270,
    provider: "varta_cache",
  },
];

class VartaGIFService {
  private cache: Map<string, VartaGif[]> = new Map();
  private recentSearches: string[] = [];
  private favorites: VartaGif[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const savedSearches = localStorage.getItem("varta_recent_gif_searches");
      if (savedSearches) this.recentSearches = JSON.parse(savedSearches);

      const savedFavorites = localStorage.getItem("varta_favorite_gifs");
      if (savedFavorites) this.favorites = JSON.parse(savedFavorites);
    } catch (e) {
      console.warn("Could not load GIF cache from localStorage", e);
    }
  }

  public getRecentSearches(): string[] {
    return this.recentSearches;
  }

  public addRecentSearch(query: string) {
    if (!query.trim()) return;
    const clean = query.trim().toLowerCase();
    this.recentSearches = [clean, ...this.recentSearches.filter((s) => s !== clean)].slice(0, 10);
    try {
      localStorage.setItem("varta_recent_gif_searches", JSON.stringify(this.recentSearches));
    } catch (e) {}
  }

  public clearRecentSearches() {
    this.recentSearches = [];
    localStorage.removeItem("varta_recent_gif_searches");
  }

  public getFavorites(): VartaGif[] {
    return this.favorites;
  }

  public toggleFavorite(gif: VartaGif): boolean {
    const exists = this.favorites.some((f) => f.id === gif.id);
    if (exists) {
      this.favorites = this.favorites.filter((f) => f.id !== gif.id);
    } else {
      this.favorites = [gif, ...this.favorites];
    }
    try {
      localStorage.setItem("varta_favorite_gifs", JSON.stringify(this.favorites));
    } catch (e) {}
    return !exists;
  }

  public isFavorite(gifId: string): boolean {
    return this.favorites.some((f) => f.id === gifId);
  }

  // ─── Priority 1: Official Tenor Web API v2 (tenor.com client engine) ───────
  private async fetchTenorWeb(query: string, limit = 50): Promise<VartaGif[]> {
    try {
      const base = "https://tenor.googleapis.com/v2";
      const endpoint = query.trim() ? "search" : "featured";
      const searchParam = query.trim() ? `&q=${encodeURIComponent(query)}` : "";
      
      const url = `${base}/${endpoint}?key=${TENOR_WEB_KEY}&client_key=tenor_web&locale=en_GB${searchParam}&limit=${limit}&contentfilter=low&media_filter=gif,tinygif,nanogif,gifpreview,mp4`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Tenor HTTP status: ${res.status}`);

      const data = await res.json();
      const results = data.results || [];
      if (!results.length) return [];

      return results.map((item: any) => {
        const formats = item.media_formats || {};
        const gifObj = formats.gif || formats.mediumgif || formats.tinygif;
        const thumbObj = formats.nanogif || formats.tinygif || formats.gifpreview || gifObj;

        return {
          id: `tenor-${item.id}`,
          title: item.title || item.content_description || item.h1_title || "GIF",
          url: gifObj?.url || "",
          thumbnail: thumbObj?.url || gifObj?.url || "",
          width: gifObj?.dims?.[0] || 300,
          height: gifObj?.dims?.[1] || 200,
          provider: "tenor" as const,
          mp4_url: formats.mp4?.url || formats.tinymp4?.url,
          aspect_ratio: (gifObj?.dims?.[0] || 300) / (gifObj?.dims?.[1] || 200),
        };
      }).filter((g: any) => g.url && !g.url.includes("unavailable"));
    } catch (e) {
      console.warn("Tenor Web API fetch failed:", e);
      return [];
    }
  }

  // ─── Priority 2: Keyless Giphy Public Search Proxy ─────────────────────────
  private async fetchGiphyKeyless(query: string, limit = 30): Promise<VartaGif[]> {
    const publicKeys = ["3o7btL0S5b6Nn38t8k", "g0f3T4sHk522qf4z9N683vU8h0Hl2u7L"];
    
    for (const key of publicKeys) {
      try {
        const base = "https://api.giphy.com/v1/gifs";
        const url = query.trim()
          ? `${base}/search?api_key=${key}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`
          : `${base}/trending?api_key=${key}&limit=${limit}&rating=g`;

        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const results = data.data || [];
        if (!results.length) continue;

        const validGifs: VartaGif[] = [];
        for (const item of results) {
          const mainUrl = item.images?.fixed_height?.url || item.images?.downsized_medium?.url || item.images?.original?.url;
          const thumbUrl = item.images?.fixed_height_small?.url || item.images?.preview_gif?.url || mainUrl;

          if (!mainUrl || mainUrl.includes("unavailable")) continue;

          validGifs.push({
            id: `giphy-${item.id}`,
            title: item.title || "GIF",
            url: mainUrl,
            thumbnail: thumbUrl,
            width: parseInt(item.images?.fixed_height?.width || "300", 10),
            height: parseInt(item.images?.fixed_height?.height || "200", 10),
            provider: "giphy",
            mp4_url: item.images?.original_mp4?.url,
            aspect_ratio: parseInt(item.images?.fixed_height?.width || "300", 10) / parseInt(item.images?.fixed_height?.height || "200", 10),
          });
        }

        if (validGifs.length > 0) return validGifs;
      } catch (e) {}
    }
    return [];
  }

  // ─── Unified Public Search Engine ───────────────────────────────────────────
  public async searchGIFs(query = ""): Promise<VartaGif[]> {
    const cacheKey = query.trim().toLowerCase() || "trending";
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (query.trim()) {
      this.addRecentSearch(query);
    }

    // 1. Try Official Tenor Web API v2 (tenor.com client engine)
    try {
      const tenorResults = await this.fetchTenorWeb(query);
      if (tenorResults && tenorResults.length > 0) {
        this.cache.set(cacheKey, tenorResults);
        return tenorResults;
      }
    } catch (e) {}

    // 2. Try Giphy Web Public API
    try {
      const giphyResults = await this.fetchGiphyKeyless(query);
      if (giphyResults && giphyResults.length > 0) {
        this.cache.set(cacheKey, giphyResults);
        return giphyResults;
      }
    } catch (e) {}

    // 3. Fallback: High Quality Curated Cache
    return CURATED_FALLBACK_GIFS;
  }
}

export const vartaGifService = new VartaGIFService();
