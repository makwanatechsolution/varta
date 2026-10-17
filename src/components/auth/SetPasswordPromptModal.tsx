import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { firebaseAuth } from "../../lib/firebase";
import { updatePassword, EmailAuthProvider, linkWithCredential } from "firebase/auth";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X } from "lucide-react";

export function SetPasswordPromptModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if user has password provider linked
    const hasPassword = user.providerData.some((p) => p.providerId === "password");
    const isGoogleUser = user.providerData.some((p) => p.providerId === "google.com");
    const dismissed = sessionStorage.getItem(`dismiss_pwd_prompt_${user.uid}`);

    // If they logged in with Google and don't have password set yet
    if (isGoogleUser && !hasPassword && !dismissed) {
      // Delay prompt slightly so they see the dashboard first
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleClose = () => {
    sessionStorage.setItem(`dismiss_pwd_prompt_${user.uid}`, "true");
    setIsOpen(false);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (firebaseAuth.currentUser && user.email) {
        // Try linking email/password credential first, or updating password
        try {
          const cred = EmailAuthProvider.credential(user.email, password);
          await linkWithCredential(firebaseAuth.currentUser, cred);
        } catch {
          // If already has email, updatePassword directly
          await updatePassword(firebaseAuth.currentUser, password);
        }
      }
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to set password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-[#111b21] border border-zinc-800 p-6 shadow-2xl text-white">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-[#1E88C7]/20 text-[#1E88C7] flex items-center justify-center font-bold">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Create Account Password</h3>
            <p className="text-xs text-zinc-400">Sign in with email & password anytime</p>
          </div>
        </div>

        {success ? (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3 text-emerald-400 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>Password created successfully! You can now log in using either Google or Password.</span>
          </div>
        ) : (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              You signed in via Google (<span className="text-white font-medium">{user.email}</span>). Set a personal password so you can also sign in directly using email and password.
            </p>

            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-3 flex items-center gap-2.5 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl bg-[#202c33] border border-zinc-700/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#1E88C7] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat password"
                className="w-full rounded-xl bg-[#202c33] border border-zinc-700/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#1E88C7]"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Later
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#1E88C7] text-xs font-semibold text-white hover:bg-[#1E88C7]/90 transition-colors shadow-lg shadow-[#1E88C7]/20"
              >
                {loading ? "Saving..." : "Set Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
