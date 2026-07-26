import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Varta: Supabase env vars missing. Copy .env.example → .env");
}

export const supabase = createClient<Database>(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder_anon_key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        // Allow up to 10 realtime events per second per channel
        eventsPerSecond: 10,
      },
      // Send a heartbeat every 25s — keeps the connection alive through Vercel's
      // 30s idle timeout and Supabase's own 60s limit
      heartbeatIntervalMs: 25_000,
      // Exponential backoff: 1s → 2s → 5s → 10s, then cap at 10s
      reconnectAfterMs: (tries: number) =>
        ([1_000, 2_000, 5_000, 10_000] as const)[tries - 1] ?? 10_000,
    },
  }
);
