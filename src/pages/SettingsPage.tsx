import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Monitor, Shield, MessageCircle, Bell, Phone, Lock, 
  CircleDot, HardDrive, Laptop, Keyboard, Info, CheckCircle2, ChevronRight, Settings as SettingsIcon
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
import clsx from "clsx";

type SettingsTab = 
  | "general" | "account" | "profile" | "chats" | "notifications" 
  | "calls" | "privacy" | "status" | "storage" | "devices" | "security" 
  | "accessibility" | "shortcuts" | "advanced" | "about";

const TABS_WITH_FIXED_ICON: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "general", label: "General", icon: Monitor },
  { id: "account", label: "Account", icon: User },
  { id: "profile", label: "Profile", icon: User },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "status", label: "Status", icon: CircleDot },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "devices", label: "Linked Devices", icon: Laptop },
  { id: "security", label: "Security", icon: Lock },
  { id: "accessibility", label: "Accessibility", icon: User },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
  { id: "advanced", label: "Advanced", icon: SettingsIcon },
  { id: "about", label: "About", icon: Info },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const { profile } = useAuth();

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* ─── Settings Sidebar ──────────────────────────────────────────────── */}
      <div className="w-[340px] flex-shrink-0 border-r border-border-subtle bg-surface/50 flex flex-col h-full z-10">
        <header className="px-6 py-6 border-b border-border-subtle bg-surface/80 backdrop-blur-md">
          <h1 className="text-2xl font-bold tracking-tight text-main">Settings</h1>
        </header>

        {/* Profile Card Summary */}
        <div className="px-4 py-4 border-b border-border-subtle">
          <div 
            onClick={() => setActiveTab("profile")}
            className={clsx(
              "flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all",
              activeTab === "profile" ? "bg-primary text-white shadow-md shadow-primary/20" : "hover:bg-card"
            )}
          >
            <Avatar 
              src={profile?.avatar_url} 
              name={profile?.display_name || "User"} 
              size="lg" 
              showRing={activeTab !== "profile"} 
              presence={profile?.presence}
            />
            <div className="flex-1 min-w-0">
              <h2 className={clsx("font-semibold truncate text-[15px]", activeTab === "profile" ? "text-white" : "text-main")}>
                {profile?.display_name}
              </h2>
              <p className={clsx("text-[13px] truncate", activeTab === "profile" ? "text-white/80" : "text-muted")}>
                {profile?.custom_status || "Available"}
              </p>
            </div>
            <ChevronRight className={clsx("w-5 h-5", activeTab === "profile" ? "text-white/70" : "text-muted")} />
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-3">
          <div className="space-y-0.5">
            {TABS_WITH_FIXED_ICON.filter(t => t.id !== "profile").map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                    isActive 
                      ? "bg-primary/10 text-primary font-semibold" 
                      : "text-main hover:bg-card hover:text-main"
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "text-primary stroke-[2.5px]" : "text-muted stroke-[2px]")} />
                  <span className="text-[14px]">{tab.label}</span>
                  {isActive && <motion.div layoutId="settings-active" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Settings Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overflow-y-auto scrollbar-hide"
          >
            {activeTab === "profile" && <ProfileSettingsPane />}
            {activeTab === "status" && <StatusSettingsPane />}
            
            {activeTab !== "profile" && activeTab !== "status" && (
              <div className="flex h-full items-center justify-center flex-col text-muted">
                <SettingsIcon className="w-16 h-16 opacity-20 mb-4" />
                <h3 className="text-xl font-medium text-main mb-2">
                  {TABS_WITH_FIXED_ICON.find(t => t.id === activeTab)?.label}
                </h3>
                <p className="text-sm">This settings pane is currently under construction.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Profile Settings Pane ──────────────────────────────────────────────────

function ProfileSettingsPane() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(""); // Missing from DB type but requested in spec
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await supabase.from("profiles").update({ display_name: displayName, username }).eq("id", profile!.id);
    await refreshProfile();
    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-10 py-12">
      <h2 className="text-3xl font-semibold mb-8 text-main">Profile Settings</h2>
      
      <div className="flex items-center gap-8 mb-10">
        <div className="relative group cursor-pointer">
          <Avatar src={profile?.avatar_url} name={displayName || "U"} size="lg" />
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-xs font-medium">CHANGE</span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-medium text-main">Profile Photo</h3>
          <p className="text-sm text-muted mb-3">Recommended size 256x256px.</p>
          <div className="flex gap-3">
            <button className="px-4 py-1.5 rounded-lg bg-surface hover:bg-card border border-border-subtle text-sm font-medium transition-colors">
              Upload New
            </button>
            <button className="px-4 py-1.5 rounded-lg text-error hover:bg-error/10 text-sm font-medium transition-colors">
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-surface border border-border-subtle px-4 py-3 text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl bg-surface border border-border-subtle py-3 pl-8 pr-4 text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A little bit about yourself..."
            rows={3}
            className="w-full rounded-xl bg-surface border border-border-subtle px-4 py-3 text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full rounded-xl bg-surface border border-border-subtle px-4 py-3 text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              className="w-full rounded-xl bg-surface border border-border-subtle px-4 py-3 text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-end gap-4 border-t border-border-subtle pt-6">
        <button className="px-6 py-2.5 rounded-xl font-medium text-main hover:bg-surface transition-colors">
          Discard Changes
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={clsx(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md",
            isSaved ? "bg-green-500 shadow-green-500/20" : "bg-primary shadow-primary/20 hover:opacity-90 active:scale-95"
          )}
        >
          {isSaving ? "Saving..." : isSaved ? <><CheckCircle2 className="w-5 h-5" /> Saved</> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Status Settings Pane ───────────────────────────────────────────────────

function StatusSettingsPane() {
  const { profile, refreshProfile } = useAuth();
  const [customStatus, setCustomStatus] = useState(profile?.custom_status ?? "");
  const [presence, setPresence] = useState(profile?.presence ?? "online");
  const [isSaved, setIsSaved] = useState(false);

  const PRESENCE_OPTIONS = [
    { value: "online", label: "Online", color: "#1E88C7", desc: "Available for calls and chats" },
    { value: "away", label: "Away", color: "#f59e0b", desc: "Temporarily stepped away" },
    { value: "busy", label: "Busy", color: "#ef4444", desc: "Focusing, notifications silenced" },
    { value: "dnd", label: "Do Not Disturb", color: "#dc2626", desc: "No notifications or calls" },
    { value: "offline", label: "Invisible", color: "#52525b", desc: "Appear offline to everyone" },
  ] as const;

  const handleSave = async () => {
    await supabase
      .from("profiles")
      .update({ custom_status: customStatus || null, presence })
      .eq("id", profile!.id);
    await refreshProfile();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-10 py-12">
      <h2 className="text-3xl font-semibold mb-8 text-main">Status & Activity</h2>
      
      <div className="space-y-8">
        <div className="space-y-4">
          <label className="text-base font-semibold text-main">Custom Status Message</label>
          <p className="text-sm text-muted">Set a custom status message that your contacts can see.</p>
          <div className="relative">
            <input
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What's your status?"
              maxLength={100}
              className="w-full rounded-2xl bg-surface border border-border-subtle px-5 py-4 text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-lg"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
              {customStatus.length}/100
            </span>
          </div>
          
          <div className="flex gap-2">
            {["In a meeting", "Commuting", "Out sick", "Vacationing"].map(preset => (
              <button 
                key={preset}
                onClick={() => setCustomStatus(preset)}
                className="px-3 py-1.5 rounded-full bg-surface hover:bg-card border border-border-subtle text-xs font-medium transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-border-subtle space-y-4">
          <label className="text-base font-semibold text-main">Online Presence</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRESENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPresence(opt.value)}
                className={clsx(
                  "flex items-start gap-4 p-4 rounded-2xl border transition-all text-left",
                  presence === opt.value
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                    : "border-border-subtle bg-surface hover:border-primary/30"
                )}
              >
                <div className="mt-1">
                  <span 
                    className={clsx("block h-3.5 w-3.5 rounded-full", presence === opt.value ? "ring-4 ring-primary/20" : "")} 
                    style={{ backgroundColor: opt.color }} 
                  />
                </div>
                <div>
                  <div className="font-semibold text-main mb-0.5">{opt.label}</div>
                  <div className="text-xs text-muted">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 flex items-center justify-end border-t border-border-subtle pt-6">
          <button
            onClick={handleSave}
            className={clsx(
              "flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white transition-all shadow-md",
              isSaved ? "bg-green-500 shadow-green-500/20" : "bg-primary shadow-primary/20 hover:opacity-90 active:scale-95"
            )}
          >
            {isSaved ? <><CheckCircle2 className="w-5 h-5" /> Saved</> : "Save Status"}
          </button>
        </div>
      </div>
    </div>
  );
}
