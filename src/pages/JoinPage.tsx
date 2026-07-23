import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { MessageCircle, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { lookupInvite } from "../hooks/useInvites";
import { useAuth } from "../contexts/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import type { Invitation } from "../types/database";

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { session, signUp } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<Invitation | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Signup form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoadingInvite(false); return; }
    lookupInvite(token).then((inv) => {
      if (!inv) setNotFound(true);
      else {
        setInvite(inv);
        setEmail(inv.email);
      }
      setLoadingInvite(false);
    });
  }, [token]);

  // Already logged in — just accept and redirect
  useEffect(() => {
    if (session && invite && !done) {
      setDone(true);
      navigate("/");
    }
  }, [session, invite, done, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signUp(email, password, name);
      setDone(true);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b141a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E88C7]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b141a] px-4 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h1 className="text-xl font-bold text-white">Invalid or Expired Invite</h1>
        <p className="mt-2 text-sm text-zinc-400">This invite link is not valid or has already been used.</p>
        <Link to="/login" className="mt-6 rounded-xl bg-[#1E88C7] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1971A5] transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b141a] px-4">
      <div className="w-full max-w-sm">
        {/* Varta logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E88C7]/10">
            <MessageCircle className="h-7 w-7 text-[#1E88C7]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Join Varta</h1>
        </div>

        {/* Inviter card */}
        {invite && (
          <div className="mb-6 rounded-2xl bg-[#111b21] p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Avatar
                src={(invite.inviter as any)?.avatar_url}
                name={(invite.inviter as any)?.display_name ?? "Someone"}
                size="lg"
              />
              <div>
                <p className="font-semibold text-white">
                  {(invite.inviter as any)?.display_name ?? "Someone"} invited you!
                </p>
                <p className="text-xs text-zinc-500">Personal invite · expires in 7 days</p>
              </div>
            </div>
            {invite.custom_message && (
              <div className="mt-3 rounded-xl bg-[#202c33] px-3 py-2 text-sm text-zinc-300 italic border-l-2 border-[#1E88C7]">
                "{invite.custom_message}"
              </div>
            )}
          </div>
        )}

        {/* Signup form */}
        <form onSubmit={handleSignup} className="space-y-3 rounded-2xl bg-[#111b21] p-5 shadow-2xl">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#1E88C7]"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#1E88C7]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (min 6 chars)"
            required
            minLength={6}
            className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#1E88C7]"
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E88C7] py-3 font-semibold text-white disabled:opacity-50 hover:bg-[#1971A5] transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {submitting ? "Creating account..." : "Join Varta"}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="text-[#1E88C7] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
