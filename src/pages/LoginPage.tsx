import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { generateQRCodeSVG } from "../lib/qrcode";
import { Moon, Sun, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "qr">("login");
  const [pairingToken, setPairingToken] = useState("");

  useEffect(() => {
    if (activeTab === "qr" && !pairingToken) {
      setPairingToken(Math.random().toString(36).substring(2, 8).toUpperCase());
    }
  }, [activeTab, pairingToken]);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.classList.contains("dark") ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (activeTab !== "signup" || !username) {
      setUsernameStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const { data, error: err } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", username)
          .maybeSingle();
        if (err) throw err;
        setUsernameStatus(data ? "taken" : "available");
      } catch (e) {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, activeTab]);

  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) strength++;
    return Math.min(strength, 3);
  };

  const handleOAuthSignIn = async (provider: "google" | "github" | "azure" | "apple" | "facebook") => {
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      if (err) throw err;
    } catch (e: any) {
      setError({ form: `Failed to connect to ${provider}: ${e.message}` });
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) return;
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail);
      if (err) throw err;
      setResetSent(true);
    } catch (err: any) {
      setError({ reset: err.message || "Failed to send reset link." });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError({});
    setLoading(true);

    try {
      if (activeTab === "signup") {
        if (usernameStatus === "taken") {
          throw new Error("Username is already taken");
        }
        await signUp(email, password, username);
      } else {
        await signIn(email, password);
      }
      navigate("/");
    } catch (err: any) {
      const msg = err.message || "Authentication failed";
      if (msg.toLowerCase().includes("network") || msg.includes("Failed to fetch") || msg.includes("supabaseUrl")) {
        setError({ form: "No connection to database. Please check your network connection." });
      } else if (msg.includes("password")) {
        setError({ password: msg });
      } else {
        setError({ form: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b141a] text-white">
      {/* Left Banner */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#111b21] via-[#0b141a] to-[#1E88C7]/20 p-16 flex-col justify-between relative overflow-hidden border-r border-zinc-800/60">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-2xl bg-[#1E88C7] flex items-center justify-center font-bold text-white shadow-lg shadow-[#1E88C7]/30 text-xl">
              V
            </div>
            <span className="text-2xl font-bold tracking-tight">Varta</span>
          </div>

          <h1 className="text-5xl font-light tracking-tight leading-tight mb-6">
            Secure, Commercial <br />
            <span className="font-bold text-[#1E88C7]">Communication Platform</span>
          </h1>

          <p className="text-zinc-400 text-base max-w-md leading-relaxed">
            Connect instantly with HD voice & video calls, end-to-end encrypted messaging, and seamless multi-device synchronization.
          </p>
        </div>

        <div className="relative z-10 text-xs text-zinc-500 font-mono">
          Varta Platform Enterprise v2.4.0 · Production Suite
        </div>
      </div>

      {/* Right Login Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 relative">
        {/* Dark/Light mode toggle */}
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 p-2.5 rounded-full bg-zinc-800/60 text-zinc-400 hover:text-white transition-colors"
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome to Varta</h2>
            <p className="text-zinc-400 text-sm">Sign in to your account or create a new profile</p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex rounded-2xl bg-[#111b21] p-1 border border-zinc-800/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === "login" ? "bg-[#1E88C7] text-white shadow-md font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Email Login
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === "signup" ? "bg-[#1E88C7] text-white shadow-md font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("qr")}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === "qr" ? "bg-[#1E88C7] text-white shadow-md font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              QR Code
            </button>
          </div>

          {error.form && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error.form}</span>
            </div>
          )}

          {/* Tab 1 & 2: Email Login & Signup */}
          {(activeTab === "login" || activeTab === "signup") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === "signup" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="e.g. john_doe"
                      className="w-full rounded-2xl bg-[#111b21] border border-zinc-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1E88C7]/30"
                    />
                    {usernameStatus === "available" && (
                      <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
                    )}
                    {usernameStatus === "taken" && (
                      <XCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-red-400" />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full rounded-2xl bg-[#111b21] border border-zinc-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1E88C7]/30"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Password
                  </label>
                  {activeTab === "login" && (
                    <button
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-xs text-[#1E88C7] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-[#111b21] border border-zinc-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1E88C7]/30 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {activeTab === "signup" && password && (
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full ${
                          getPasswordStrength() >= level ? "bg-[#1E88C7]" : "bg-zinc-800"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#1E88C7] py-3.5 text-sm font-semibold text-white shadow-xl shadow-[#1E88C7]/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                {loading ? "Authenticating..." : activeTab === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
          )}

          {/* Tab 3: QR Code Scan Login — Real Scannable SVG QR Code */}
          {activeTab === "qr" && (
            <div className="flex flex-col items-center justify-center p-6 bg-[#111b21] rounded-3xl border border-zinc-800 text-center space-y-4">
              <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                <div
                  className="w-48 h-48 flex items-center justify-center"
                  dangerouslySetInnerHTML={{
                    __html: generateQRCodeSVG(
                      `${window.location.origin}/join?pair=${pairingToken || "varta_pair_token"}`,
                      { size: 220, fgColor: "#0b141a" }
                    ),
                  }}
                />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Scan to Sign In</h4>
                <p className="text-xs text-zinc-400 mt-1">Open Varta App on your phone → Settings → Linked Devices → Scan QR</p>
                <div className="mt-3 p-2 bg-[#202c33] rounded-xl border border-zinc-700/60 inline-block">
                  <p className="text-[11px] text-zinc-400 uppercase font-mono tracking-widest">
                    Pairing Code: <span className="text-[#1E88C7] font-bold text-xs">{pairingToken ? pairingToken.slice(0, 6).toUpperCase() : "849201"}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Social OAuth Buttons */}
          <div className="space-y-3 pt-4 border-t border-zinc-800/80">
            <p className="text-center text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Or Sign In With
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#111b21] border border-zinc-800 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                <span>Google</span>
              </button>
              <button
                type="button"
                onClick={() => handleOAuthSignIn("github")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#111b21] border border-zinc-800 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                <span>GitHub</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-white text-lg">Reset Password</h3>
            <p className="text-xs text-zinc-400">Enter your email to receive a password reset link.</p>

            {resetSent ? (
              <p className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 p-3 rounded-xl">
                Reset link sent to your email!
              </p>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl bg-[#0b141a] border border-zinc-800 px-4 py-3 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="w-full rounded-2xl bg-[#1E88C7] py-2.5 text-sm font-semibold text-white shadow-lg"
                >
                  Send Reset Link
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="w-full py-2 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
