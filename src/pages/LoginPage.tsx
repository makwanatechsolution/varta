import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) await signUp(email, password, name);
      else await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b141a] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/20">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#25D366]" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Varta</h1>
          <p className="mt-2 text-sm text-zinc-400">
            WhatsApp calls · Telegram groups · Instagram stories
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-[#111b21] p-6 shadow-2xl">
          {isRegister && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              required
              className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#25D366]"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#25D366]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#25D366]"
          />

          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#25D366] py-3 font-semibold text-white disabled:opacity-50 hover:bg-[#1da855] transition-colors"
          >
            {loading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {isRegister ? "Already have an account? Sign in" : "New here? Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [customStatus, setCustomStatus] = useState(profile?.custom_status ?? "");
  const [presence, setPresence] = useState(profile?.presence ?? "online");
  const [saved, setSaved] = useState(false);

  const PRESENCE_OPTIONS = [
    { value: "online", label: "Online", color: "#25D366" },
    { value: "away", label: "Away", color: "#f59e0b" },
    { value: "busy", label: "Busy", color: "#ef4444" },
    { value: "dnd", label: "Do Not Disturb", color: "#dc2626" },
  ] as const;

  const save = async () => {
    await supabase
      .from("profiles")
      .update({ display_name: displayName, username, custom_status: customStatus || null, presence })
      .eq("id", profile!.id);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0b141a] text-white">
      <header className="flex items-center gap-4 bg-[#111b21] px-4 py-3">
        <a href="/" className="text-zinc-400 hover:text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <div className="p-6 max-w-md space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-zinc-400">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-[#202c33] px-4 py-2.5 text-white outline-none focus:ring-1 focus:ring-[#25D366]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-400">Username</span>
          <div className="relative mt-1.5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-[#202c33] py-2.5 pl-8 pr-4 text-white outline-none focus:ring-1 focus:ring-[#25D366]"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-400">Custom status</span>
          <input
            value={customStatus}
            onChange={(e) => setCustomStatus(e.target.value)}
            placeholder="In a meeting until 3pm..."
            className="mt-1.5 w-full rounded-xl bg-[#202c33] px-4 py-2.5 text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-[#25D366]"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-zinc-400">Status</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PRESENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPresence(opt.value)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                  presence === opt.value
                    ? "border-transparent text-white"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
                style={presence === opt.value ? { backgroundColor: `${opt.color}22`, borderColor: opt.color, color: opt.color } : {}}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          className="w-full rounded-xl bg-[#25D366] py-3 font-semibold text-white hover:bg-[#1da855] transition-colors"
        >
          {saved ? "✓ Saved!" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
