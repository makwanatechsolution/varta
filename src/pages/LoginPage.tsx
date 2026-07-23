import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Moon, Sun, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") || 
             (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
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
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", username)
          .maybeSingle();
        if (error) throw error;
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

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
    } catch (e) {
      setError({ form: "Failed to connect to Google." });
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
        setError({ form: "No connection to database. Please add your real Supabase credentials to the .env file." });
      } else if (msg.includes("password")) {
        setError({ password: msg });
      } else if (msg.toLowerCase().includes("user") || msg.toLowerCase().includes("email") || msg.toLowerCase().includes("invalid login")) {
        setError({ email: msg });
      } else {
        setError({ form: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();
  const strengthBars = [
    strength > 0 ? (strength === 1 ? 'bg-[#C1502E] dark:bg-[#E17A56]' : strength === 2 ? 'bg-[#6EC6F0]' : 'bg-[#3E7C59] dark:bg-[#5FAE84]') : 'bg-[#E7E0D3] dark:bg-[#2E393C]',
    strength > 1 ? (strength === 2 ? 'bg-[#6EC6F0]' : 'bg-[#3E7C59] dark:bg-[#5FAE84]') : 'bg-[#E7E0D3] dark:bg-[#2E393C]',
    strength > 2 ? 'bg-[#3E7C59] dark:bg-[#5FAE84]' : 'bg-[#E7E0D3] dark:bg-[#2E393C]'
  ];

  return (
    <div className="flex min-h-screen bg-[#FBF6EE] dark:bg-[#12181A] transition-colors duration-200">
      {/* Left Panel - Storytelling */}
      <div className="hidden lg:flex flex-col justify-center items-center w-[55%] relative overflow-hidden bg-[#FBF6EE] dark:bg-[#12181A]">
        {/* Abstract Background Pattern */}
        <div className="absolute inset-0 opacity-10 dark:opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #1E88C7 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex flex-col items-center">
          <img src="/logo.svg" alt="Varta" className="w-80 h-auto" />
        </div>
      </div>

      {/* Right Panel - Auth Card */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 relative bg-[#FBF6EE] dark:bg-[#12181A]">
        
        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 lg:top-8 lg:right-8 p-2 rounded-full text-[#8A8175] dark:text-[#7E8A8C] hover:text-[#6EC6F0] dark:hover:text-[#6EC6F0] transition-colors z-20"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>

        <div className="w-full max-w-md z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img src="/logo.svg" alt="Varta" className="w-64 h-auto" />
          </div>

          {/* Auth Card */}
          <div className="bg-[#FFFFFF] dark:bg-[#1B2326] rounded-2xl shadow-[0_8px_30px_rgba(11,85,99,0.10)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-[#EFE6D6] dark:border-[#2A3438] p-8 sm:p-10 w-full">
            
            {/* Tabs */}
            <div className="flex relative border-b border-[#E7E0D3] dark:border-[#2E393C] mb-8">
              <button 
                type="button"
                className={`flex-1 pb-3 text-lg font-medium transition-colors ${activeTab === "login" ? "text-[#26211B] dark:text-[#F2ECDF]" : "text-[#8A8175] dark:text-[#7E8A8C] hover:text-[#26211B] dark:hover:text-[#F2ECDF]"}`}
                onClick={() => { setActiveTab("login"); setError({}); }}
              >
                Log in
              </button>
              <button 
                type="button"
                className={`flex-1 pb-3 text-lg font-medium transition-colors ${activeTab === "signup" ? "text-[#26211B] dark:text-[#F2ECDF]" : "text-[#8A8175] dark:text-[#7E8A8C] hover:text-[#26211B] dark:hover:text-[#F2ECDF]"}`}
                onClick={() => { setActiveTab("signup"); setError({}); }}
              >
                Sign up
              </button>
              <div 
                className="absolute bottom-[-1px] h-[2px] bg-[#6EC6F0] transition-all duration-300 ease-out w-1/2" 
                style={{ transform: activeTab === "login" ? "translateX(0)" : "translateX(100%)" }}
              />
            </div>

            {error.form && (
              <div className="mb-6 flex items-start gap-2 p-3 bg-[#C1502E]/10 dark:bg-[#E17A56]/10 rounded-lg border border-[#C1502E]/20 dark:border-[#E17A56]/20">
                <AlertCircle className="w-5 h-5 text-[#C1502E] dark:text-[#E17A56] shrink-0" />
                <span className="text-sm text-[#C1502E] dark:text-[#E17A56] leading-relaxed">{error.form}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="relative group">
                <input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  required
                  className={`peer w-full rounded-xl bg-transparent border ${error.email ? 'border-[#C1502E] dark:border-[#E17A56]' : 'border-[#E7E0D3] dark:border-[#2E393C]'} px-4 py-3.5 text-[#26211B] dark:text-[#F2ECDF] outline-none transition-all duration-150 focus:border-[#6EC6F0] focus:shadow-[0_0_0_2px_rgba(244,164,40,0.2)]`}
                />
                <label htmlFor="email" className={`absolute left-4 top-3.5 text-[#8A8175] dark:text-[#7E8A8C] transition-all duration-150 pointer-events-none bg-[#FFFFFF] dark:bg-[#1B2326] px-1 peer-focus:-translate-y-6 peer-focus:scale-[0.85] peer-focus:-translate-x-1 peer-focus:text-[#6EC6F0] ${email ? '-translate-y-6 scale-[0.85] -translate-x-1' : ''}`}>
                  {activeTab === "login" ? "Email or Username" : "Email address"}
                </label>
                {error.email && (
                  <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[#C1502E] dark:text-[#E17A56] text-xs">
                    <AlertCircle size={12} /> {error.email}
                  </div>
                )}
              </div>

              {activeTab === "signup" && (
                <div className="relative group">
                  <input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder=" "
                    required
                    className={`peer w-full rounded-xl bg-transparent border ${error.username ? 'border-[#C1502E] dark:border-[#E17A56]' : 'border-[#E7E0D3] dark:border-[#2E393C]'} px-4 py-3.5 text-[#26211B] dark:text-[#F2ECDF] outline-none transition-all duration-150 focus:border-[#6EC6F0] focus:shadow-[0_0_0_2px_rgba(244,164,40,0.2)]`}
                  />
                  <label htmlFor="username" className={`absolute left-4 top-3.5 text-[#8A8175] dark:text-[#7E8A8C] transition-all duration-150 pointer-events-none bg-[#FFFFFF] dark:bg-[#1B2326] px-1 peer-focus:-translate-y-6 peer-focus:scale-[0.85] peer-focus:-translate-x-1 peer-focus:text-[#6EC6F0] ${username ? '-translate-y-6 scale-[0.85] -translate-x-1' : ''}`}>
                    Username
                  </label>
                  
                  {/* Status Indicator */}
                  <div className="absolute right-4 top-3.5 flex items-center">
                    {usernameStatus === "checking" && <Loader2 className="w-5 h-5 text-[#6EC6F0] animate-spin" />}
                    {usernameStatus === "available" && <CheckCircle2 className="w-5 h-5 text-[#3E7C59] dark:text-[#5FAE84]" />}
                    {usernameStatus === "taken" && <XCircle className="w-5 h-5 text-[#C1502E] dark:text-[#E17A56]" />}
                  </div>

                  {error.username && (
                    <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[#C1502E] dark:text-[#E17A56] text-xs">
                      <AlertCircle size={12} /> {error.username}
                    </div>
                  )}
                  {usernameStatus === "taken" && !error.username && (
                    <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[#C1502E] dark:text-[#E17A56] text-xs">
                      <AlertCircle size={12} /> Username is already taken
                    </div>
                  )}
                </div>
              )}
              
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=" "
                  required
                  minLength={6}
                  className={`peer w-full rounded-xl bg-transparent border ${error.password ? 'border-[#C1502E] dark:border-[#E17A56]' : 'border-[#E7E0D3] dark:border-[#2E393C]'} px-4 py-3.5 pr-12 text-[#26211B] dark:text-[#F2ECDF] outline-none transition-all duration-150 focus:border-[#6EC6F0] focus:shadow-[0_0_0_2px_rgba(244,164,40,0.2)]`}
                />
                <label htmlFor="password" className={`absolute left-4 top-3.5 text-[#8A8175] dark:text-[#7E8A8C] transition-all duration-150 pointer-events-none bg-[#FFFFFF] dark:bg-[#1B2326] px-1 peer-focus:-translate-y-6 peer-focus:scale-[0.85] peer-focus:-translate-x-1 peer-focus:text-[#6EC6F0] ${password ? '-translate-y-6 scale-[0.85] -translate-x-1' : ''}`}>
                  Password
                </label>
                
                <button 
                  type="button" 
                  className="absolute right-4 top-3.5 text-[#8A8175] dark:text-[#7E8A8C] hover:text-[#6EC6F0] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>

                {error.password && (
                  <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[#C1502E] dark:text-[#E17A56] text-xs">
                    <AlertCircle size={12} /> {error.password}
                  </div>
                )}
                
                {activeTab === "signup" && password && (
                  <div className="absolute -bottom-4 left-1 w-[calc(100%-8px)] flex gap-1 h-1">
                    <div className={`flex-1 rounded-full transition-colors duration-300 ${strengthBars[0]}`} />
                    <div className={`flex-1 rounded-full transition-colors duration-300 ${strengthBars[1]}`} />
                    <div className={`flex-1 rounded-full transition-colors duration-300 ${strengthBars[2]}`} />
                  </div>
                )}
              </div>
              
              {activeTab === "login" && (
                <div className="flex justify-end pt-1">
                  <button type="button" className="text-sm font-medium text-[#173B4D] dark:text-[#6EC6F0] hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (activeTab === "signup" && usernameStatus === "taken")}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#173B4D] dark:bg-[#6EC6F0] py-4 text-[#FFFFFF] dark:text-[#1B2326] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{activeTab === "signup" ? "Signing up..." : "Signing in..."}</span>
                  </>
                ) : (
                  <span>{activeTab === "signup" ? "Create account" : "Log in"}</span>
                )}
              </button>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex-1 h-[1px] bg-[#E7E0D3] dark:bg-[#2E393C]" />
                <span className="text-sm text-[#8A8175] dark:text-[#7E8A8C]">or</span>
                <div className="flex-1 h-[1px] bg-[#E7E0D3] dark:bg-[#2E393C]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-transparent border border-[#E7E0D3] dark:border-[#2E393C] py-3.5 text-[#26211B] dark:text-[#F2ECDF] font-medium transition-colors hover:bg-gray-50 dark:hover:bg-[#2E393C]/30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </form>
            
            {activeTab === "login" && (
              <div className="mt-8 text-center hidden">
                <button
                  type="button"
                  onClick={() => { setActiveTab("signup"); setError({}); }}
                  className="text-sm font-medium text-[#8A8175] dark:text-[#7E8A8C] hover:text-[#173B4D] dark:hover:text-[#6EC6F0] transition-colors"
                >
                  Don't have an account? Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


