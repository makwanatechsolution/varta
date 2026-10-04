import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { vartaWS } from "../lib/ws";
import { generateQRCodeSVG } from "../lib/qrcode";
import { signInWithGoogleRedirect, signInWithGooglePopup, handleFirebaseGoogleRedirect } from "../lib/firebase";
import { Moon, Sun, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { profilesApi } from "../lib/api";

export function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "qr">("login");
  const [pairingToken, setPairingToken] = useState("");
  const [qrStatusText, setQrStatusText] = useState("Waiting for QR scan...");
  const [qrSvgMarkup, setQrSvgMarkup] = useState("");

  useEffect(() => {
    if (activeTab === "qr" && !pairingToken) {
      setPairingToken(Math.random().toString(36).substring(2, 8).toUpperCase());
    }
  }, [activeTab, pairingToken]);

  useEffect(() => {
    if (activeTab !== "qr" || !pairingToken) return;

    let cancelled = false;
    const payload = `${window.location.origin}/login?pair=${pairingToken}`;
    generateQRCodeSVG(payload, { size: 220, fgColor: "#0b141a" }).then((svg) => {
      if (!cancelled) setQrSvgMarkup(svg);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, pairingToken]);

  // Realtime Broadcast channel listener for QR Code Login via VartaWS
  useEffect(() => {
    if (activeTab !== "qr" || !pairingToken) return;

    setQrStatusText("Waiting for QR scan...");
    const channelName = `varta-qr-login-${pairingToken}`;
    
    // Subscribe to WS channel for QR login
    const unsub = vartaWS.on(channelName, "auth-session", async (payload: any) => {
      if (payload?.token) {
        setQrStatusText("Device Authenticated! Redirecting...");
        setLoading(true);
        // Normally we'd use Firebase signInWithCustomToken here, but for now just tell user it's WIP
        setQrStatusText("QR Login is currently disabled during GCP migration.");
        setLoading(false);
      }
    });

    // Make sure we subscribe to this channel
    (vartaWS as any).send?.({ type: "subscribe", channel: channelName });

    return () => {
      unsub();
      (vartaWS as any).send?.({ type: "unsubscribe", channel: channelName });
    };
  }, [activeTab, pairingToken, navigate]);

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
        const { data } = await profilesApi.search(username);
        // Very basic check, normally would need an exact match API endpoint
        const isTaken = Array.isArray(data) && data.some(p => p.username === username);
        setUsernameStatus(isTaken ? "taken" : "available");
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

  useEffect(() => {
    handleFirebaseGoogleRedirect()
      .then((res) => {
        if (res?.user) {
          navigate("/", { replace: true });
        }
      })
      .catch((err) => {
        console.warn("Firebase Google redirect result:", err);
      });
  }, [navigate]);

  const handleOAuthSignIn = async (provider: "google") => {
    setError({});
    setLoading(true);
    try {
      if (provider === "google") {
        try {
          await signInWithGoogleRedirect();
          return;
        } catch (redirectErr) {
          console.warn("Firebase redirect failed, attempting popup:", redirectErr);
          try {
            const res = await signInWithGooglePopup();
            if (res?.user) {
              navigate("/", { replace: true });
              return;
            }
          } catch (popupErr: any) {
            console.warn("Firebase popup failed:", popupErr);
            throw popupErr;
          }
        }
      }
    } catch (e: any) {
      setError({ form: `Failed to connect to ${provider}: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) return;
    setLoading(true);
    try {
      await resetPassword(resetEmail);
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
      if (msg.toLowerCase().includes("network") || msg.includes("Failed to fetch")) {
        setError({ form: "No connection to server. Please check your network connection." });
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
      <div className="flex-1 flex flex-col justify-center items-center p-8 relative animate-fade-in-up">
        {/* Dark/Light mode toggle */}
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 p-2.5 rounded-full bg-zinc-800/60 text-zinc-400 hover:text-white transition-colors"
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-[32px] animate-fade-in-up-delay-1">
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
                      className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-white outline-none"
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
                  className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-white outline-none"
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
                    className="w-full rounded-2xl glass-input px-4 py-3 text-sm text-white outline-none pr-12"
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
                className="w-full rounded-2xl bg-[#1E88C7] py-3.5 text-sm font-semibold text-white btn-primary-glow"
              >
                {loading ? "Authenticating..." : activeTab === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
          )}

          {/* Tab 3: QR Code Scan Login — Real Scannable SVG QR Code */}
          {activeTab === "qr" && (
            <div className="flex flex-col items-center justify-center p-6 bg-[#111b21] rounded-3xl border border-zinc-800 text-center space-y-4">
              <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center relative">
                <div
                  className="w-48 h-48 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Scan to Sign In</h4>
                <p className="text-xs text-zinc-400 mt-1">Open Varta App on your phone → Settings → Linked Devices → Scan QR</p>
                <div className="mt-3 p-2 bg-[#202c33] rounded-xl border border-zinc-700/60 inline-block">
                  <p className="text-[11px] text-zinc-400 uppercase font-mono tracking-widest">
                    Pairing Code: <span className="text-[#1E88C7] font-bold text-xs">{pairingToken}</span>
                  </p>
                </div>
                <p className="text-xs font-semibold text-[#1E88C7] mt-3 animate-pulse">
                  {qrStatusText}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPairingToken(Math.random().toString(36).substring(2, 8).toUpperCase())}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white underline pt-1"
              >
                Refresh QR Code
              </button>
            </div>
          )}

          {/* Social OAuth Buttons */}
          <div className="space-y-3 pt-4 border-t border-zinc-800/80 animate-fade-in-up-delay-2">
            <p className="text-center text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Or Sign In With
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                className="flex items-center justify-center gap-3 rounded-2xl glass-input py-3 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
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
