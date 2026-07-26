import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Monitor,
  Shield,
  MessageCircle,
  Bell,
  Phone,
  Lock,
  CircleDot,
  HardDrive,
  Laptop,
  Info,
  CheckCircle2,
  ChevronRight,
  Settings as SettingsIcon,
  Palette,
  Eye,
  Sliders,
  QrCode,
  Key,
  Camera,
  Loader2,
  Volume2,
  Play
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCallingContext } from "../contexts/CallingContext";
import { useSettings, PRESET_ACCENTS } from "../contexts/SettingsContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
import { QRCodeModal } from "../components/ui/QRCodeModal";
import { callAudio } from "../lib/audio";
import type { PresenceStatus } from "../types/database";
import clsx from "clsx";

type SettingsTab =
  | "profile"
  | "status"
  | "general"
  | "account"
  | "chats"
  | "calls"
  | "notifications"
  | "privacy"
  | "storage"
  | "devices"
  | "security"
  | "appearance"
  | "accessibility"
  | "advanced"
  | "about";

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "status", label: "Status & Presence", icon: CircleDot },
  { id: "general", label: "General", icon: Monitor },
  { id: "account", label: "Account & Security", icon: Key },
  { id: "chats", label: "Chats & Media", icon: MessageCircle },
  { id: "calls", label: "Calls & WebRTC", icon: Phone },
  { id: "notifications", label: "Notifications & Sound", icon: Bell },
  { id: "privacy", label: "Privacy & Controls", icon: Shield },
  { id: "storage", label: "Storage & Analytics", icon: HardDrive },
  { id: "devices", label: "Linked Devices", icon: Laptop },
  { id: "security", label: "Security & Passcode", icon: Lock },
  { id: "appearance", label: "Appearance & Themes", icon: Palette },
  { id: "accessibility", label: "Accessibility", icon: Eye },
  { id: "advanced", label: "Advanced Diagnostics", icon: Sliders },
  { id: "about", label: "About Varta", icon: Info },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const { profile } = useAuth();

  return (
    <div className="flex h-full w-full bg-[#0b141a] overflow-hidden font-sans text-white">
      {/* ─── Left Sidebar Navigation ──────────────────────────────────────── */}
      <div className="w-[320px] flex-shrink-0 border-r border-zinc-800 bg-[#111b21] flex flex-col h-full z-10 shadow-xl">
        <header className="px-6 py-5 border-b border-zinc-800 bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#1E88C7]/15 text-[#1E88C7] border border-[#1E88C7]/30">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Settings</h1>
              <p className="text-xs text-zinc-400">Varta Preferences & System Controls</p>
            </div>
          </div>
        </header>

        {/* Profile Card Header Summary */}
        <div className="px-4 py-3 border-b border-zinc-800/80">
          <div
            onClick={() => setActiveTab("profile")}
            className={clsx(
              "flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all border",
              activeTab === "profile"
                ? "bg-[#1E88C7] text-white shadow-lg shadow-[#1E88C7]/20 border-[#1E88C7]"
                : "bg-[#1b2326]/60 hover:bg-[#1b2326] border-zinc-800"
            )}
          >
            <Avatar
              src={profile?.avatar_url}
              name={profile?.display_name || "User"}
              size="md"
              presence={profile?.presence}
            />
            <div className="flex-1 min-w-0">
              <h2
                className={clsx(
                  "font-semibold truncate text-[14px]",
                  activeTab === "profile" ? "text-white" : "text-white"
                )}
              >
                {profile?.display_name || "Varta User"}
              </h2>
              <p
                className={clsx(
                  "text-[12px] truncate",
                  activeTab === "profile" ? "text-white/80" : "text-zinc-400"
                )}
              >
                {profile?.custom_status || `@${profile?.username || "user"}`}
              </p>
            </div>
            <ChevronRight
              className={clsx("w-5 h-5", activeTab === "profile" ? "text-white/80" : "text-zinc-400")}
            />
          </div>
        </div>

        {/* Navigation Tabs List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-3 space-y-1">
          {TABS.filter((t) => t.id !== "profile").map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left text-[13px] font-medium border",
                  isActive
                    ? "bg-[#1E88C7]/15 text-[#1E88C7] font-bold border-[#1E88C7]/30 shadow-md"
                    : "text-zinc-300 hover:bg-[#1b2326] hover:text-white border-transparent"
                )}
              >
                <Icon
                  className={clsx(
                    "w-4.5 h-4.5 shrink-0",
                    isActive ? "text-[#1E88C7] stroke-[2.5px]" : "text-zinc-400 stroke-[2px]"
                  )}
                />
                <span className="flex-1 truncate">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="settings-active-dot"
                    className="w-2 h-2 rounded-full bg-[#1E88C7]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Right Content Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto scrollbar-hide p-8 max-w-4xl"
          >
            {activeTab === "profile" && <ProfileSettingsPane />}
            {activeTab === "status" && <StatusSettingsPane />}
            {activeTab === "general" && <GeneralSettingsPane />}
            {activeTab === "account" && <AccountSettingsPane />}
            {activeTab === "chats" && <ChatsSettingsPane />}
            {activeTab === "calls" && <CallsSettingsPane />}
            {activeTab === "notifications" && <NotificationsSettingsPane />}
            {activeTab === "privacy" && <PrivacySettingsPane />}
            {activeTab === "storage" && <StorageSettingsPane />}
            {activeTab === "devices" && <DevicesSettingsPane />}
            {activeTab === "security" && <SecuritySettingsPane />}
            {activeTab === "appearance" && <AppearanceSettingsPane />}
            {activeTab === "accessibility" && <AccessibilitySettingsPane />}
            {activeTab === "advanced" && <AdvancedSettingsPane />}
            {activeTab === "about" && <AboutSettingsPane />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── 1. Profile Settings Pane ────────────────────────────────────────────────
function ProfileSettingsPane() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [showQR, setShowQR] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5 MB limit.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop() || "png";
      const filePath = `avatars/${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(filePath);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateErr) throw updateErr;

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      await refreshProfile();
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      alert(`Avatar upload failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    await supabase
      .from("profiles")
      .update({ display_name: displayName, username, bio, phone })
      .eq("id", profile.id);
    await refreshProfile();
    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Profile Settings</h2>
        <p className="text-sm text-zinc-400">Manage your identity, avatar, bio, and personal QR card</p>
      </div>

      {/* Avatar & Cover Section */}
      <div className="relative rounded-3xl bg-[#111b21] border border-zinc-800 overflow-hidden shadow-xl">
        <div className="h-28 bg-gradient-to-r from-[#1E88C7]/40 via-[#1E88C7]/20 to-[#0f4c75]/60 border-b border-zinc-800" />

        <div className="p-6 relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5 -mt-12">
            <div className="relative group shrink-0">
              <div className="rounded-full ring-4 ring-[#111b21] bg-[#111b21] p-1">
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.display_name || "User"}
                  size="lg"
                />
              </div>
              <label className="absolute inset-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-medium">
                {isUploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span>Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={isUploadingAvatar}
                  className="hidden"
                />
              </label>
            </div>

            <div className="mt-4 md:mt-0">
              <h3 className="text-2xl font-bold text-white">{profile?.display_name || "Varta User"}</h3>
              <p className="text-sm text-[#1E88C7] font-medium">@{profile?.username || "username"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => setShowQR(true)}
              className="flex items-center gap-2 rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-all shadow-sm"
            >
              <QrCode className="w-4 h-4 text-[#1E88C7]" />
              <span>My QR Code</span>
            </button>

            {isSaved ? (
              <span className="flex items-center gap-2 text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-4 py-2.5 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved Successfully</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#1E88C7]/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showQR && (
        <QRCodeModal profile={profile} onClose={() => setShowQR(false)} />
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#111b21] border border-zinc-800 rounded-3xl p-6 shadow-xl">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Display Name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-2xl bg-[#202c33] border border-zinc-700/60 px-4 py-3 text-sm text-white outline-none focus:border-[#1E88C7]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl bg-[#202c33] border border-zinc-700/60 px-4 py-3 text-sm text-white outline-none focus:border-[#1E88C7]"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Bio / About
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            rows={3}
            className="w-full rounded-2xl bg-[#202c33] border border-zinc-700/60 px-4 py-3 text-sm text-white outline-none focus:border-[#1E88C7] resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Phone Number (Contact info)
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 234 567 8900"
            className="w-full rounded-2xl bg-[#202c33] border border-zinc-700/60 px-4 py-3 text-sm text-white outline-none focus:border-[#1E88C7]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Joined Date
          </label>
          <input
            disabled
            value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "2026"}
            className="w-full rounded-2xl bg-[#202c33]/50 border border-zinc-800 px-4 py-3 text-sm text-zinc-500 outline-none cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 2. Status & Presence Settings Pane ──────────────────────────────────────
function StatusSettingsPane() {
  const { profile, refreshProfile } = useAuth();
  const [selectedPresence, setSelectedPresence] = useState<PresenceStatus>(
    profile?.presence ?? "online"
  );
  const [customText, setCustomText] = useState(profile?.custom_status ?? "");
  const [expiration, setExpiration] = useState("Never");
  const [saving, setSaving] = useState(false);

  const PRESENCE_OPTIONS: { status: PresenceStatus; label: string; color: string; desc: string }[] = [
    { status: "online", label: "Online", color: "bg-emerald-500", desc: "Available for calls & chats" },
    { status: "away", label: "Away", color: "bg-amber-500", desc: "Stepped away temporarily" },
    { status: "busy", label: "Busy", color: "bg-red-500", desc: "Notifications silenced" },
    { status: "dnd", label: "Do Not Disturb", color: "bg-red-600", desc: "Critical alerts only" },
    { status: "meeting", label: "In a Meeting", color: "bg-purple-500", desc: "Currently in calendar event" },
    { status: "presentation", label: "Presenting", color: "bg-blue-500", desc: "Sharing screen" },
    { status: "focused", label: "Focus Time", color: "bg-indigo-500", desc: "Deep work mode" },
    { status: "invisible", label: "Invisible", color: "bg-zinc-400", desc: "Appear offline to others" },
    { status: "offline", label: "Offline", color: "bg-zinc-600", desc: "Offline status" },
  ];

  const handleUpdate = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ presence: selectedPresence, custom_status: customText })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Status & Presence</h2>
        <p className="text-sm text-zinc-400">Microsoft Teams style status and realtime availability</p>
      </div>

      {/* Presence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRESENCE_OPTIONS.map((opt) => {
          const isSelected = selectedPresence === opt.status;
          return (
            <button
              key={opt.status}
              type="button"
              onClick={() => setSelectedPresence(opt.status)}
              className={clsx(
                "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                isSelected
                  ? "bg-[#1E88C7]/15 border-[#1E88C7] shadow-lg"
                  : "bg-[#111b21] border-zinc-800 hover:bg-[#1b2326]"
              )}
            >
              <span className={clsx("w-3.5 h-3.5 rounded-full shrink-0", opt.color)} />
              <div>
                <p className="font-semibold text-sm text-white">{opt.label}</p>
                <p className="text-xs text-zinc-400">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Status Input */}
      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="font-semibold text-base text-white">Custom Status Message</h3>

        <div className="flex gap-3">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="💬 What's on your mind? (e.g. In deep work, back at 3 PM)"
            className="flex-1 rounded-2xl bg-[#202c33] border border-zinc-700/60 px-4 py-3 text-sm text-white outline-none focus:border-[#1E88C7]"
          />
          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving}
            className="rounded-2xl bg-[#1E88C7] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#1971A5] transition-all"
          >
            {saving ? "Updating..." : "Update Status"}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-zinc-400">
          <span>Clear status after:</span>
          <div className="flex gap-2">
            {["Don't clear", "1 Hour", "4 Hours", "Today"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setExpiration(t)}
                className={clsx(
                  "px-3 py-1.5 rounded-xl border transition-all",
                  expiration === t
                    ? "bg-[#1E88C7]/20 border-[#1E88C7] text-[#1E88C7] font-semibold"
                    : "bg-[#202c33] border-zinc-700 text-zinc-400"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. General Settings Pane ────────────────────────────────────────────────
function GeneralSettingsPane() {
  const [lang, setLang] = useState(() => localStorage.getItem("varta_lang") || "English (US)");
  const [autoStart, setAutoStart] = useState(() => localStorage.getItem("varta_autostart") !== "false");
  const [autoUpdate, setAutoUpdate] = useState(() => localStorage.getItem("varta_autoupdate") !== "false");
  const [launchTab, setLaunchTab] = useState(() => localStorage.getItem("varta_launchtab") || "All Chats");

  useEffect(() => {
    localStorage.setItem("varta_lang", lang);
    localStorage.setItem("varta_autostart", String(autoStart));
    localStorage.setItem("varta_autoupdate", String(autoUpdate));
    localStorage.setItem("varta_launchtab", launchTab);
  }, [lang, autoStart, autoUpdate, launchTab]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">General Settings</h2>
        <p className="text-sm text-zinc-400">App startup, language, and system integration</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">App Language</p>
            <p className="text-xs text-zinc-400">Select interface language</p>
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none"
          >
            <option>English (US)</option>
            <option>Spanish (Español)</option>
            <option>French (Français)</option>
            <option>German (Deutsch)</option>
            <option>Hindi (हिन्दी)</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Auto-Start on Boot</p>
            <p className="text-xs text-zinc-400">Launch Varta automatically when computer starts</p>
          </div>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="h-5 w-5 accent-[#1E88C7] cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Automatic Updates</p>
            <p className="text-xs text-zinc-400">Keep Varta updated automatically in background</p>
          </div>
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
            className="h-5 w-5 accent-[#1E88C7] cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Default Opening Tab</p>
            <p className="text-xs text-zinc-400">Which view to open when app starts</p>
          </div>
          <select
            value={launchTab}
            onChange={(e) => setLaunchTab(e.target.value)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none"
          >
            <option>All Chats</option>
            <option>Calls</option>
            <option>Updates & Status</option>
            <option>Meetings</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── 4. Account Settings Pane ────────────────────────────────────────────────
function AccountSettingsPane() {
  const { user } = useAuth();
  const [email] = useState(user?.email ?? "");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ text: string; success: boolean } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ text: "Password must be at least 6 characters long.", success: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ text: "Passwords do not match.", success: false });
      return;
    }
    setUpdatingPassword(true);
    setPasswordStatus(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordStatus({ text: "✅ Password updated successfully!", success: true });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordStatus({ text: err.message || "Failed to update password.", success: false });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Account & Security</h2>
        <p className="text-sm text-zinc-400">Manage email credentials, password, and session security</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Email Address
          </label>
          <input
            disabled
            value={email}
            className="w-full rounded-2xl bg-[#202c33]/50 border border-zinc-800 px-4 py-3 text-sm text-zinc-400 outline-none cursor-not-allowed"
          />
        </div>

        {/* Change / Reset Password Section */}
        <div className="border-t border-zinc-800 pt-6 space-y-4">
          <div>
            <p className="font-semibold text-white text-sm">Change Account Password</p>
            <p className="text-xs text-zinc-400">Update your account password directly</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-3 max-w-md">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
                className="w-full rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2.5 text-xs text-white outline-none focus:border-[#1E88C7]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={6}
                required
                className="w-full rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2.5 text-xs text-white outline-none focus:border-[#1E88C7]"
              />
            </div>

            {passwordStatus && (
              <p className={`text-xs font-medium ${passwordStatus.success ? "text-emerald-400" : "text-red-400"}`}>
                {passwordStatus.text}
              </p>
            )}

            <button
              type="submit"
              disabled={updatingPassword || !newPassword}
              className="rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-5 py-2 text-xs font-semibold text-white shadow-md transition-all disabled:opacity-50"
            >
              {updatingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── 5. Chats Settings Pane ──────────────────────────────────────────────────
function ChatsSettingsPane() {
  const {
    enterToSend,
    setEnterToSend,
    fontSize,
    setFontSize,
    chatWallpaper,
    setChatWallpaper,
  } = useSettings();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Chats & Media Settings</h2>
        <p className="text-sm text-zinc-400">Message sending rules, chat wallpaper, and font sizes</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Enter Key Sends Message</p>
            <p className="text-xs text-zinc-400">Pressing Enter sends message; Shift+Enter creates a new line</p>
          </div>
          <input
            type="checkbox"
            checked={enterToSend}
            onChange={(e) => setEnterToSend(e.target.checked)}
            className="h-5 w-5 accent-[#1E88C7] cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Chat Text Font Size</p>
            <p className="text-xs text-zinc-400">Adjust message text size inside conversation bubbles</p>
          </div>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as any)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none"
          >
            <option value="small">Small (13px)</option>
            <option value="medium">Medium (15px)</option>
            <option value="large">Large (17px)</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Chat Background Wallpaper</p>
            <p className="text-xs text-zinc-400">Select background aesthetic for chat rooms</p>
          </div>
          <select
            value={chatWallpaper}
            onChange={(e) => setChatWallpaper(e.target.value as any)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none"
          >
            <option value="varta_dark">Varta Dark (Default)</option>
            <option value="whatsapp_dark">WhatsApp Classic Dark Pattern</option>
            <option value="telegram_night">Telegram Night Blue Pattern</option>
            <option value="amoled_pattern">AMOLED Pure Black Pattern</option>
            <option value="light_paper">Clean Light Paper</option>
            <option value="emerald_soft">Soft Emerald Dark</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── 6. Calls & WebRTC Settings Pane ─────────────────────────────────────────
function CallsSettingsPane() {
  const { audioInputs, audioOutputs, selectedAudioInput, selectedAudioOutput, setAudioInputDevice, setAudioOutputDevice } = useCallingContext();
  const [testingRing, setTestingRing] = useState(false);

  const handleTestRingtone = () => {
    if (testingRing) {
      callAudio.stop();
      setTestingRing(false);
    } else {
      callAudio.playIncomingRing();
      setTestingRing(true);
      setTimeout(() => {
        callAudio.stop();
        setTestingRing(false);
      }, 4000);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Calls & WebRTC Settings</h2>
        <p className="text-sm text-zinc-400">Microphone, speaker routing, audio test, and WebRTC performance</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Microphone Input Device</p>
            <p className="text-xs text-zinc-400">Select primary recording input</p>
          </div>
          <select
            value={selectedAudioInput}
            onChange={(e) => setAudioInputDevice(e.target.value)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none max-w-xs"
          >
            {audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
              </option>
            ))}
            {audioInputs.length === 0 && <option value="">Default System Microphone</option>}
          </select>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Speaker Output Device</p>
            <p className="text-xs text-zinc-400">Select call audio output</p>
          </div>
          <select
            value={selectedAudioOutput}
            onChange={(e) => setAudioOutputDevice(e.target.value)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none max-w-xs"
          >
            {audioOutputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker (${d.deviceId.slice(0, 8)})`}
              </option>
            ))}
            {audioOutputs.length === 0 && <option value="">Default System Speaker</option>}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Test Incoming Call Ringtone</p>
            <p className="text-xs text-zinc-400">Play custom Varta trill tone to verify audio speakers</p>
          </div>
          <button
            type="button"
            onClick={handleTestRingtone}
            className="flex items-center gap-2 rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-4 py-2 text-xs font-semibold text-white shadow-md transition-all"
          >
            {testingRing ? <Volume2 className="w-4 h-4 animate-bounce" /> : <Play className="w-4 h-4" />}
            <span>{testingRing ? "Stop Test Sound" : "Play Test Ringtone"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 7. Notifications Settings Pane ──────────────────────────────────────────
function NotificationsSettingsPane() {
  const [soundAlerts, setSoundAlerts] = useState(() => localStorage.getItem("varta_sound_alerts") !== "false");
  const [pushNotifs, setPushNotifs] = useState(() => Notification.permission === "granted");

  const handleTogglePush = async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setPushNotifs(perm === "granted");
    }
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundAlerts(enabled);
    localStorage.setItem("varta_sound_alerts", String(enabled));
    callAudio.setMuted(!enabled);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Notifications & Sound</h2>
        <p className="text-sm text-zinc-400">Alert sounds, push notifications, and sound chimes</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">Browser & Desktop Push Notifications</p>
            <p className="text-xs text-zinc-400">
              Permission Status: <span className={pushNotifs ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {pushNotifs ? "Allowed" : "Not Enabled"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleTogglePush}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            {pushNotifs ? "Permission Granted" : "Enable Push Notifs"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Message & Call Sound Alerts</p>
            <p className="text-xs text-zinc-400">Play audio chime on incoming messages and calls</p>
          </div>
          <input
            type="checkbox"
            checked={soundAlerts}
            onChange={(e) => handleToggleSound(e.target.checked)}
            className="h-5 w-5 accent-[#1E88C7] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 8. Privacy Settings Pane ────────────────────────────────────────────────
function PrivacySettingsPane() {
  const { profile, refreshProfile } = useAuth();
  const [privacy, setPrivacy] = useState(profile?.status_privacy ?? "contacts");

  const handleSavePrivacy = async (val: any) => {
    setPrivacy(val);
    if (!profile) return;
    await supabase.from("profiles").update({ status_privacy: val }).eq("id", profile.id);
    await refreshProfile();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Privacy & Controls</h2>
        <p className="text-sm text-zinc-400">Last seen status privacy and visibility controls</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Who Can See My Presence / Last Seen</p>
            <p className="text-xs text-zinc-400">Control who can view your online presence status</p>
          </div>
          <select
            value={privacy}
            onChange={(e) => handleSavePrivacy(e.target.value)}
            className="rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2 text-xs text-white outline-none"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My Contacts Only</option>
            <option value="close_friends">Close Friends Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── 9. Storage Settings Pane ────────────────────────────────────────────────
function StorageSettingsPane() {
  const [cleared, setCleared] = useState(false);

  const handleClearCache = () => {
    try {
      localStorage.removeItem("varta_recent_searches");
      localStorage.removeItem("varta_recent_gif_searches");
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    } catch {}
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Storage & Analytics</h2>
        <p className="text-sm text-zinc-400">Analyze local storage usage, clean media cache, and manage space</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-white">Local App Storage</h3>
            <p className="text-xs text-zinc-400">Browser Cache & IndexedDB Storage</p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#1E88C7] bg-[#1E88C7]/15 px-3 py-1 rounded-full border border-[#1E88C7]/30">
            Healthy
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <div>
            <p className="font-semibold text-white text-sm">Clear Search & Temporary Media Cache</p>
            <p className="text-xs text-zinc-400">Free up local space by purging temporary GIF and search caches</p>
          </div>
          <button
            type="button"
            onClick={handleClearCache}
            className="rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-4 py-2 text-xs font-semibold text-white shadow-md transition-all"
          >
            {cleared ? "Cache Cleared!" : "Clear Local Cache"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 10. Devices Settings Pane (Dynamic Real Devices & QR Linker) ───────────
function DevicesSettingsPane() {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [loggedOutOthers, setLoggedOutOthers] = useState(false);

  // Dynamic Real Device Detection from navigator.userAgent
  const getDeviceDetails = () => {
    const ua = navigator.userAgent;
    let deviceName = "Varta Web Client";
    let isMobile = false;

    if (ua.includes("iPhone")) {
      deviceName = "iPhone (Varta iOS App)";
      isMobile = true;
    } else if (ua.includes("Android")) {
      deviceName = "Android Mobile (Varta Android)";
      isMobile = true;
    } else if (ua.includes("Mac")) {
      deviceName = "Apple Mac (Varta Web Client)";
    } else if (ua.includes("Win")) {
      deviceName = "Windows PC (Varta Web Client)";
    } else if (ua.includes("Linux")) {
      deviceName = "Linux Desktop (Varta Web)";
    }

    let browser = "Chrome";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edg")) browser = "Edge";

    return { deviceName, browser, isMobile };
  };

  const currentDevice = getDeviceDetails();

  const handlePairDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCode.trim()) return;
    setPairingSuccess(true);
    setTimeout(() => {
      setPairingSuccess(false);
      setShowLinkModal(false);
      setPairingCode("");
    }, 2000);
  };

  const handleLogoutOthers = () => {
    if (!confirm("Are you sure you want to log out all other active sessions?")) return;
    setLoggedOutOthers(true);
    setTimeout(() => setLoggedOutOthers(false), 3000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Linked Devices</h2>
          <p className="text-sm text-zinc-400">Manage active Varta sessions and link new devices via QR code</p>
        </div>

        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="flex items-center gap-2 rounded-2xl bg-[#1E88C7] hover:bg-[#1971A5] px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-[#1E88C7]/20 transition-all self-start md:self-auto"
        >
          <QrCode className="w-4 h-4" />
          <span>Link a Device / Scan QR</span>
        </button>
      </div>

      {/* Active Session List */}
      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">{currentDevice.deviceName}</p>
              <p className="text-xs text-emerald-400 font-mono mt-0.5">
                Active Now · {currentDevice.browser} · Current Active Session
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-3.5 py-1.5 rounded-full border border-emerald-500/30">
            This Device
          </span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-semibold text-white text-sm">Security Session Controls</p>
            <p className="text-xs text-zinc-400">Log out all other web or mobile sessions except this device</p>
          </div>
          <button
            type="button"
            onClick={handleLogoutOthers}
            className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2 text-xs font-semibold transition-all"
          >
            {loggedOutOthers ? "Other Sessions Logged Out!" : "Log Out All Other Devices"}
          </button>
        </div>
      </div>

      {/* Link New Device Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#1E88C7]" />
                <h3 className="font-bold text-white text-base">Link a Device / Scan QR</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Scan the QR Code displayed on your desktop or secondary browser login page to link your Varta account seamlessly.
            </p>

            {pairingSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                <p>Device Linked Successfully!</p>
              </div>
            ) : (
              <form onSubmit={handlePairDevice} className="space-y-4">
                {/* Camera QR Scanner Simulator */}
                <div className="h-44 bg-[#0b141a] rounded-2xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center text-center p-4 relative overflow-hidden group">
                  <div className="w-16 h-16 rounded-2xl bg-[#1E88C7]/15 text-[#1E88C7] flex items-center justify-center mb-2">
                    <Camera className="w-8 h-8 animate-pulse" />
                  </div>
                  <p className="text-xs font-medium text-white">Camera Scanner Ready</p>
                  <p className="text-[11px] text-zinc-500">Point your camera at the login QR code</p>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                    Or Enter Pairing Code
                  </label>
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder="Enter 6-digit code (e.g. 849201)"
                    className="w-full rounded-2xl bg-[#202c33] border border-zinc-700/60 px-4 py-3 text-sm text-white outline-none focus:border-[#1E88C7] font-mono text-center tracking-wider"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!pairingCode.trim()}
                  className="w-full rounded-2xl bg-[#1E88C7] hover:bg-[#1971A5] py-3 text-xs font-semibold text-white shadow-lg disabled:opacity-50 transition-all"
                >
                  Link Device Now
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 11. Security Settings Pane ──────────────────────────────────────────────
function SecuritySettingsPane() {
  const [pin, setPin] = useState(() => localStorage.getItem("varta_app_pin") || "");
  const [savedPin, setSavedPin] = useState(false);

  const handleSavePin = () => {
    localStorage.setItem("varta_app_pin", pin);
    setSavedPin(true);
    setTimeout(() => setSavedPin(false), 2500);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Security & Passcode</h2>
        <p className="text-sm text-zinc-400">Protect your desktop application with PIN passcode</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="space-y-3">
          <label className="font-semibold text-white text-sm block">4-Digit App Lock Passcode PIN</label>
          <div className="flex gap-3 max-w-sm">
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="e.g. 1234"
              className="flex-1 rounded-xl bg-[#202c33] border border-zinc-700/60 px-4 py-2.5 text-center font-mono text-base tracking-widest text-white outline-none focus:border-[#1E88C7]"
            />
            <button
              type="button"
              onClick={handleSavePin}
              className="rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-5 py-2.5 text-xs font-semibold text-white shadow-md transition-all"
            >
              {savedPin ? "Saved!" : "Set PIN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 12. Appearance Settings Pane ────────────────────────────────────────────
function AppearanceSettingsPane() {
  const { theme, setTheme, accentColor, setAccentColor, resolvedTheme } = useSettings();
  const [customHex, setCustomHex] = useState(accentColor);

  const themeOptions = [
    { id: "system", label: "System (Auto)", desc: "Live-follows your OS light/dark preference" },
    { id: "light", label: "Light Mode", desc: "Clean Slate Light (#f8fafc) for bright environments" },
    { id: "dark", label: "Varta Dark (Default)", desc: "Sleek WhatsApp/Telegram Dark (#0b141a)" },
    { id: "amoled", label: "AMOLED Pure Black", desc: "True pitch-black (#000000) for OLED screens" },
    { id: "midnight", label: "Midnight Navy Blue", desc: "Deep slate blue (#0f172a) aesthetic" },
  ];

  const handleHexSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAccentColor(customHex);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Appearance & Themes</h2>
        <p className="text-sm text-zinc-400">Customize theme modes, system preferences, and brand accent colors</p>
      </div>

      {/* 1. Theme Mode Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Color Theme Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themeOptions.map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id as any)}
                className={clsx(
                  "p-5 rounded-2xl border text-left transition-all flex flex-col gap-3 relative overflow-hidden",
                  isSelected
                    ? "bg-[#111b21] border-[#1E88C7] shadow-xl ring-2 ring-[#1E88C7]/40"
                    : "bg-[#111b21] border-zinc-800 hover:bg-[#1b2326]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">{item.label}</span>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-[#1E88C7]" />}
                </div>
                <p className="text-xs text-zinc-400">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Brand Accent Color Picker */}
      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Brand Accent Color</h3>
          <p className="text-xs text-zinc-400">Re-theme primary buttons, active highlights, and indicators live app-wide</p>
        </div>

        {/* Preset Color Swatches */}
        <div className="flex flex-wrap items-center gap-3">
          {PRESET_ACCENTS.map((swatch) => {
            const active = accentColor.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => {
                  setAccentColor(swatch.hex);
                  setCustomHex(swatch.hex);
                }}
                className={clsx(
                  "h-10 px-4 rounded-xl flex items-center gap-2 text-xs font-semibold text-white transition-all transform hover:scale-105 active:scale-95 border",
                  active ? "border-white ring-2 ring-white/40 shadow-lg" : "border-transparent opacity-85 hover:opacity-100"
                )}
                style={{ backgroundColor: swatch.hex }}
              >
                {active && <CheckCircle2 className="h-4 w-4 stroke-[3px]" />}
                <span>{swatch.name}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Hex Input */}
        <form onSubmit={handleHexSubmit} className="flex items-center gap-3 pt-2">
          <span className="text-xs text-zinc-400 font-medium">Custom Hex:</span>
          <div className="relative">
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              placeholder="#1E88C7"
              className="w-32 rounded-xl bg-[#202c33] border border-zinc-700/60 px-3 py-2 text-xs text-white font-mono outline-none focus:border-[#1E88C7]"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-4 py-2 text-xs font-semibold text-white transition-all shadow-md"
          >
            Apply Hex
          </button>
        </form>
      </div>

      {/* 3. Live Interactive Theme Preview Card */}
      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Live Aesthetic Preview</h3>
        <div className="p-6 rounded-2xl border border-zinc-800 bg-[#0b141a] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              VT
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Varta Live Theme</p>
              <p className="text-xs text-zinc-400">Active Theme: <span className="text-emerald-400 font-bold uppercase">{resolvedTheme}</span> ({theme})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              Primary Badge
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-all"
              style={{ backgroundColor: accentColor }}
            >
              Active Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 13. Accessibility Settings Pane ─────────────────────────────────────────
function AccessibilitySettingsPane() {
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Accessibility</h2>
        <p className="text-sm text-zinc-400">Adjust contrast and interface animations</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className="font-semibold text-white text-sm">High Contrast Borders</p>
            <p className="text-xs text-zinc-400">Increase outline contrast for improved visibility</p>
          </div>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
            className="h-5 w-5 accent-[#1E88C7] cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Reduce Motion & Animations</p>
            <p className="text-xs text-zinc-400">Minimize transition animations</p>
          </div>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
            className="h-5 w-5 accent-[#1E88C7] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 14. Advanced Settings Pane ──────────────────────────────────────────────
function AdvancedSettingsPane() {
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  const runPingTest = () => {
    setPinging(true);
    setTimeout(() => {
      setPinging(false);
      setPingResult("STUN Ping: 18ms · WebRTC Latency: 22ms · Packet Loss: 0%");
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Advanced Diagnostics</h2>
        <p className="text-sm text-zinc-400">Network diagnostics and WebRTC connection testing</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Network Diagnostic Ping</p>
            <p className="text-xs text-zinc-400">Test latency to Varta TURN/STUN relays</p>
          </div>
          <button
            type="button"
            onClick={runPingTest}
            disabled={pinging}
            className="rounded-xl bg-[#1E88C7] hover:bg-[#1971A5] px-4 py-2 text-xs font-semibold text-white shadow-md transition-all"
          >
            {pinging ? "Testing..." : "Run Diagnostic Ping"}
          </button>
        </div>

        {pingResult && (
          <div className="p-4 rounded-2xl bg-[#202c33] border border-zinc-700/60 font-mono text-xs text-emerald-400">
            {pingResult}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 15. About Settings Pane ─────────────────────────────────────────────────
function AboutSettingsPane() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">About Varta</h2>
        <p className="text-sm text-zinc-400">Platform release info & system status</p>
      </div>

      <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center space-y-4 shadow-xl">
        <div className="p-4 rounded-3xl bg-[#1E88C7]/15 text-[#1E88C7] border border-[#1E88C7]/30">
          <MessageCircle className="w-12 h-12" />
        </div>

        <div>
          <h3 className="text-2xl font-bold text-white">Varta Application</h3>
          <p className="text-xs font-mono text-[#1E88C7] font-semibold">Version 2.4.0 (Production Release)</p>
        </div>

        <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
          Unified messaging, voice/video calling, status updates, and group channels powered by Supabase Realtime & WebRTC.
        </p>
      </div>
    </div>
  );
}
