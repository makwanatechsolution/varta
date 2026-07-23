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
  }
);
