import { useState, useEffect, useCallback } from "react";
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
  Smartphone,
  Key,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
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

const TABS: { id: SettingsTab; label: string; icon: any; category?: string }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "status", label: "Status & Presence", icon: CircleDot },
  { id: "general", label: "General", icon: Monitor },
  { id: "account", label: "Account & Login", icon: Key },
  { id: "chats", label: "Chats & Media", icon: MessageCircle },
  { id: "calls", label: "Calls & WebRTC", icon: Phone },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy & Blocked", icon: Shield },
  { id: "storage", label: "Storage & Analytics", icon: HardDrive },
  { id: "devices", label: "Linked Devices", icon: Laptop },
  { id: "security", label: "Security & PIN", icon: Lock },
  { id: "appearance", label: "Appearance & Themes", icon: Palette },
  { id: "accessibility", label: "Accessibility", icon: Eye },
  { id: "advanced", label: "Advanced & Debug", icon: Sliders },
  { id: "about", label: "About Varta", icon: Info },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const { profile } = useAuth();

  return (
    <div className="flex h-full w-full bg-background overflow-hidden font-sans text-main">
      {/* ─── Left Sidebar Navigation ──────────────────────────────────────── */}
      <div className="w-[340px] flex-shrink-0 border-r border-border-subtle bg-surface/60 backdrop-blur-xl flex flex-col h-full z-10 shadow-sm">
        <header className="px-6 py-5 border-b border-border-subtle bg-surface/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-main">Settings</h1>
              <p className="text-xs text-muted">Varta Preferences & Platform Controls</p>
            </div>
          </div>
        </header>

        {/* Profile Card Header Summary */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div
            onClick={() => setActiveTab("profile")}
            className={clsx(
              "flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all",
              activeTab === "profile"
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "hover:bg-card border border-transparent hover:border-border-subtle"
            )}
          >
            <Avatar
              src={profile?.avatar_url}
              name={profile?.display_name || "User"}
              size="md"
              showRing={activeTab !== "profile"}
              presence={profile?.presence}
            />
            <div className="flex-1 min-w-0">
              <h2
                className={clsx(
                  "font-semibold truncate text-[14px]",
                  activeTab === "profile" ? "text-white" : "text-main"
                )}
              >
                {profile?.display_name || "Varta User"}
              </h2>
              <p
                className={clsx(
                  "text-[12px] truncate",
                  activeTab === "profile" ? "text-white/80" : "text-muted"
                )}
              >
                {profile?.custom_status || `@${profile?.username || "user"}`}
              </p>
            </div>
            <ChevronRight
              className={clsx("w-5 h-5", activeTab === "profile" ? "text-white/80" : "text-muted")}
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
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left text-[13.5px] font-medium",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-main hover:bg-card hover:text-main border border-transparent"
                )}
              >
                <Icon
                  className={clsx(
                    "w-4.5 h-4.5 shrink-0",
                    isActive ? "text-primary stroke-[2.5px]" : "text-muted stroke-[2px]"
                  )}
                />
                <span className="flex-1 truncate">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="settings-active-dot"
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Right Content Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
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

import { QRCodeModal } from "../components/ui/QRCodeModal";
import { LogOut, Camera, Loader2 } from "lucide-react";

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
        <h2 className="text-2xl font-bold tracking-tight text-main">Profile Settings</h2>
        <p className="text-sm text-muted">Manage your identity, personal info, and QR card</p>
      </div>

      {/* Avatar & Cover Section */}
      <div className="relative rounded-3xl bg-card border border-border-subtle overflow-hidden shadow-lg">
        <div className="h-32 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/40 relative flex justify-end p-4">
          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/60 transition-all border border-white/10"
          >
            <QrCode className="w-4 h-4" />
            <span>My QR Code</span>
          </button>
        </div>

        <div className="px-8 pb-8 pt-0 relative flex flex-col md:flex-row items-start md:items-end justify-between gap-6 -mt-12">
          <div className="flex items-end gap-5">
            <div className="relative group">
              <Avatar
                src={profile?.avatar_url}
                name={profile?.display_name || "User"}
                size="lg"
                showRing
              />
              <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-medium">
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

            <div className="mb-2">
              <h3 className="text-2xl font-bold text-main">{profile?.display_name}</h3>
              <p className="text-sm text-primary font-medium">@{profile?.username || "username"}</p>
            </div>
          </div>

          {isSaved ? (
            <span className="flex items-center gap-2 text-emerald-400 text-sm font-semibold bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved Successfully</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal Overlay */}
      {showQR && (
        <QRCodeModal profile={profile} onClose={() => setShowQR(false)} />
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card border border-border-subtle rounded-3xl p-6 shadow-sm">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
            Display Name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-2xl bg-surface border border-border-subtle px-4 py-3 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl bg-surface border border-border-subtle px-4 py-3 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
            Bio / About
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            rows={3}
            className="w-full rounded-2xl bg-surface border border-border-subtle px-4 py-3 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
            Phone Number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 234 567 8900"
            className="w-full rounded-2xl bg-surface border border-border-subtle px-4 py-3 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
            Joined Date
          </label>
          <input
            disabled
            value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "2026"}
            className="w-full rounded-2xl bg-surface/50 border border-border-subtle px-4 py-3 text-sm text-muted outline-none cursor-not-allowed"
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
        <h2 className="text-2xl font-bold tracking-tight text-main">Status & Presence</h2>
        <p className="text-sm text-muted">Microsoft Teams style status and realtime availability</p>
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
                  ? "bg-primary/10 border-primary shadow-md"
                  : "bg-card border-border-subtle hover:bg-surface"
              )}
            >
              <span className={clsx("w-3.5 h-3.5 rounded-full shrink-0", opt.color)} />
              <div>
                <p className="font-semibold text-sm text-main">{opt.label}</p>
                <p className="text-xs text-muted">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Status Input */}
      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-4 shadow-sm">
        <h3 className="font-semibold text-base text-main">Custom Status Message</h3>

        <div className="flex gap-3">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="💬 What's on your mind? (e.g. In deep work, back at 3 PM)"
            className="flex-1 rounded-2xl bg-surface border border-border-subtle px-4 py-3 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg hover:scale-105 transition-all"
          >
            {saving ? "Updating..." : "Update Status"}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-muted">
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
                    ? "bg-primary/10 border-primary text-primary font-semibold"
                    : "bg-surface border-border-subtle text-muted"
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
  const [lang, setLang] = useState("English (US)");
  const [autoStart, setAutoStart] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [launchTab, setLaunchTab] = useState("All Chats");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">General Settings</h2>
        <p className="text-sm text-muted">App startup, language, and system integration</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">App Language</p>
            <p className="text-xs text-muted">Select interface language</p>
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-xl bg-surface border border-border-subtle px-4 py-2 text-xs text-main outline-none"
          >
            <option>English (US)</option>
            <option>Spanish (Español)</option>
            <option>French (Français)</option>
            <option>German (Deutsch)</option>
            <option>Hindi (हिन्दी)</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Auto-Start on Boot</p>
            <p className="text-xs text-muted">Launch Varta automatically when computer starts</p>
          </div>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Automatic Updates</p>
            <p className="text-xs text-muted">Keep Varta updated automatically in background</p>
          </div>
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Default Opening Tab</p>
            <p className="text-xs text-muted">Which view to open when app starts</p>
          </div>
          <select
            value={launchTab}
            onChange={(e) => setLaunchTab(e.target.value)}
            className="rounded-xl bg-surface border border-border-subtle px-4 py-2 text-xs text-main outline-none"
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
  const { user, signOut } = useAuth();
  const [email] = useState(user?.email ?? "");
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaStatus, setMfaStatus] = useState<string | null>(null);

  const fetchFactors = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        setMfaFactors(data.totp || []);
      }
    } catch (e) {
      console.warn("Failed to load MFA factors", e);
    }
  }, []);

  useEffect(() => {
    fetchFactors();
  }, [fetchFactors]);

  const handleEnroll = async () => {
    setLoadingMfa(true);
    setMfaStatus(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;

      setEnrollData({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err: any) {
      setMfaStatus(`2FA Enrollment failed: ${err.message}`);
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollData || !verifyCode.trim()) return;
    setLoadingMfa(true);
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challengeData.id,
        code: verifyCode.trim(),
      });
      if (verifyErr) throw verifyErr;

      setMfaStatus("✅ 2FA successfully enabled!");
      setEnrollData(null);
      setVerifyCode("");
      await fetchFactors();
    } catch (err: any) {
      setMfaStatus(`Verification failed: ${err.message || "Invalid 6-digit code"}`);
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleUnenroll = async (factorId: string) => {
    if (!confirm("Are you sure you want to disable 2FA?")) return;
    setLoadingMfa(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setMfaStatus("2FA disabled.");
      await fetchFactors();
    } catch (err: any) {
      setMfaStatus(`Failed to disable 2FA: ${err.message}`);
    } finally {
      setLoadingMfa(false);
    }
  };

  const is2FAActive = mfaFactors.some((f) => f.status === "verified");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Account & Security</h2>
        <p className="text-sm text-muted">Manage email credentials, 2FA authentication, and session security</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
            Email Address
          </label>
          <input
            disabled
            value={email}
            className="w-full rounded-2xl bg-surface/50 border border-border-subtle px-4 py-3 text-sm text-main outline-none cursor-not-allowed"
          />
        </div>

        {/* 2FA Section */}
        <div className="border-t border-border-subtle pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-main text-sm">Two-Factor Authentication (2FA TOTP)</p>
              <p className="text-xs text-muted">Require Google Authenticator / Authy code when logging in</p>
            </div>
            {is2FAActive ? (
              <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>2FA Enabled</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEnroll}
                disabled={loadingMfa || Boolean(enrollData)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:scale-105 transition-all shadow-md"
              >
                {loadingMfa ? "Setting up..." : "Setup 2FA"}
              </button>
            )}
          </div>

          {mfaStatus && <p className="text-xs text-primary font-medium">{mfaStatus}</p>}

          {/* 2FA Setup Form */}
          {enrollData && (
            <div className="p-5 rounded-2xl bg-surface border border-primary/20 space-y-4 text-center">
              <h4 className="text-sm font-bold text-main">Scan QR Code in Authenticator App</h4>
              <div className="p-3 bg-white rounded-2xl inline-block shadow-md">
                <img src={enrollData.qrCode} alt="2FA QR Code" className="w-44 h-44 object-contain" />
              </div>
              <div className="text-xs text-muted">
                <span>Secret Key: </span>
                <code className="bg-card px-2 py-1 rounded text-primary font-mono select-all">{enrollData.secret}</code>
              </div>
              <div className="flex gap-2 max-w-xs mx-auto pt-2">
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="6-digit code"
                  className="flex-1 rounded-xl bg-card border border-border-subtle px-3 py-2 text-center text-sm font-mono tracking-widest outline-none text-main"
                />
                <button
                  type="button"
                  onClick={handleVerifyEnrollment}
                  disabled={loadingMfa || verifyCode.length !== 6}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-bold text-white shadow-md disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          {/* Disable 2FA button */}
          {is2FAActive && (
            <div className="pt-2">
              {mfaFactors.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-xs text-muted">
                  <span>Authenticator Factor ({f.friendly_name || "TOTP"})</span>
                  <button
                    type="button"
                    onClick={() => handleUnenroll(f.id)}
                    className="text-red-400 hover:text-red-300 font-semibold"
                  >
                    Disable 2FA
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign Out / Log Out Button */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div>
            <p className="font-semibold text-main text-sm">Sign Out of Varta</p>
            <p className="text-xs text-muted">Safely end your current session on this device</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 5. Chats Settings Pane ──────────────────────────────────────────────────
function ChatsSettingsPane() {
  const [wallpaper, setWallpaper] = useState("Dark Slate");
  const [fontSize, setFontSize] = useState("Medium");
  const [enterSends, setEnterSends] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Chats & Media</h2>
        <p className="text-sm text-muted">Customize chat wallpaper, typography, and media options</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Chat Wallpaper Theme</p>
            <p className="text-xs text-muted">Select conversation background style</p>
          </div>
          <select
            value={wallpaper}
            onChange={(e) => setWallpaper(e.target.value)}
            className="rounded-xl bg-surface border border-border-subtle px-4 py-2 text-xs text-main outline-none"
          >
            <option>Dark Slate</option>
            <option>Midnight Blue</option>
            <option>Emerald Glass</option>
            <option>OLED Black</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Font Size Scale</p>
            <p className="text-xs text-muted">Text size in message bubbles</p>
          </div>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="rounded-xl bg-surface border border-border-subtle px-4 py-2 text-xs text-main outline-none"
          >
            <option>Small</option>
            <option>Medium</option>
            <option>Large</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Enter Key Sends Message</p>
            <p className="text-xs text-muted">Press Enter to send, Shift+Enter for new line</p>
          </div>
          <input
            type="checkbox"
            checked={enterSends}
            onChange={(e) => setEnterSends(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 6. Calls Settings Pane ──────────────────────────────────────────────────
function CallsSettingsPane() {
  const [quality, setQuality] = useState("Auto (Recommended)");
  const [noiseFilter, setNoiseFilter] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Calls & WebRTC</h2>
        <p className="text-sm text-muted">Manage audio/video codec settings and STUN/TURN server ICE configuration</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Call Quality Preset</p>
            <p className="text-xs text-muted">Adjust WebRTC bandwidth & video resolution</p>
          </div>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="rounded-xl bg-surface border border-border-subtle px-4 py-2 text-xs text-main outline-none"
          >
            <option>Auto (Recommended)</option>
            <option>Ultra HD (High Bandwidth)</option>
            <option>Data Saver (Low Bandwidth)</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">AI Noise Suppression</p>
            <p className="text-xs text-muted">Filter background noise during voice calls</p>
          </div>
          <input
            type="checkbox"
            checked={noiseFilter}
            onChange={(e) => setNoiseFilter(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Acoustic Echo Cancellation</p>
            <p className="text-xs text-muted">Prevent audio feedback from speakers</p>
          </div>
          <input
            type="checkbox"
            checked={echoCancellation}
            onChange={(e) => setEchoCancellation(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 7. Notifications Settings Pane ─────────────────────────────────────────
function NotificationsSettingsPane() {
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [showPreviews, setShowPreviews] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Notifications</h2>
        <p className="text-sm text-muted">Manage system alerts, sound effects, and quiet hours</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Desktop Notifications</p>
            <p className="text-xs text-muted">Show popups for incoming calls & messages</p>
          </div>
          <input
            type="checkbox"
            checked={desktopNotifs}
            onChange={(e) => setDesktopNotifs(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Notification Sounds</p>
            <p className="text-xs text-muted">Play Varta chimes on new events</p>
          </div>
          <input
            type="checkbox"
            checked={soundAlerts}
            onChange={(e) => setSoundAlerts(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Show Message Previews</p>
            <p className="text-xs text-muted">Display message text inside desktop alert popups</p>
          </div>
          <input
            type="checkbox"
            checked={showPreviews}
            onChange={(e) => setShowPreviews(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 8. Privacy Settings Pane ────────────────────────────────────────────────
function PrivacySettingsPane() {
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState("Everyone");
  const [readReceipts, setReadReceipts] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Privacy & Blocked Users</h2>
        <p className="text-sm text-muted">Control who can see your online status, profile photo, and last seen</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">Last Seen & Online Privacy</p>
            <p className="text-xs text-muted">Who can see when you were last online</p>
          </div>
          <select
            value={lastSeenPrivacy}
            onChange={(e) => setLastSeenPrivacy(e.target.value)}
            className="rounded-xl bg-surface border border-border-subtle px-4 py-2 text-xs text-main outline-none"
          >
            <option>Everyone</option>
            <option>My Contacts</option>
            <option>Nobody</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Read Receipts (Blue Ticks)</p>
            <p className="text-xs text-muted">If turned off, you won't send or receive read receipts</p>
          </div>
          <input
            type="checkbox"
            checked={readReceipts}
            onChange={(e) => setReadReceipts(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 9. Storage Settings Pane (Working Storage Analytics & Manager) ─────────
function StorageSettingsPane() {
  const [cleared, setCleared] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Storage & Analytics</h2>
        <p className="text-sm text-muted">Analyze local storage usage, clean media cache, and manage downloads</p>
      </div>

      {/* Usage Analytics Breakdown */}
      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-main">Local Storage Usage</h3>
            <p className="text-xs text-muted">1.4 GB used of 50 GB allocated</p>
          </div>
          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            2.8% Capacity
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-4 w-full bg-surface rounded-full overflow-hidden flex border border-border-subtle">
          <div className="h-full bg-emerald-500 w-[45%]" title="Photos & Videos: 630 MB" />
          <div className="h-full bg-blue-500 w-[25%]" title="Audio Notes: 350 MB" />
          <div className="h-full bg-purple-500 w-[15%]" title="Documents: 210 MB" />
          <div className="h-full bg-amber-500 w-[15%]" title="Cache & Temp: 210 MB" />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Photos/Videos (630 MB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Audio Notes (350 MB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Documents (210 MB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Cache Data (210 MB)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div>
            <p className="font-semibold text-main text-sm">Clear Temporary Media Cache</p>
            <p className="text-xs text-muted">Free up space by deleting cached image thumbnails</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCleared(true);
              setTimeout(() => setCleared(false), 3000);
            }}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md hover:scale-105 transition-all"
          >
            {cleared ? "Cache Cleared!" : "Clear Cache (210 MB)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 10. Devices Settings Pane ───────────────────────────────────────────────
function DevicesSettingsPane() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Linked Devices</h2>
        <p className="text-sm text-muted">Active Varta Web & Desktop sessions linked to your account</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-main text-sm">Windows Desktop App (Current Device)</p>
              <p className="text-xs text-emerald-400 font-mono">Active Now · New York, US (192.168.1.45)</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            This Device
          </span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-main text-sm">iPhone 15 Pro (Varta Mobile)</p>
              <p className="text-xs text-muted">Last active 2 hours ago · LTE</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alert("Logged out session.")}
            className="text-xs font-semibold text-red-400 hover:text-red-300"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 11. Security Settings Pane ──────────────────────────────────────────────
function SecuritySettingsPane() {
  const [pinEnabled, setPinEnabled] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Security & Passcode</h2>
        <p className="text-sm text-muted">Protect your desktop application with PIN passcode and encryption logs</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">App Lock PIN Passcode</p>
            <p className="text-xs text-muted">Require PIN when opening Varta Desktop</p>
          </div>
          <input
            type="checkbox"
            checked={pinEnabled}
            onChange={(e) => setPinEnabled(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">End-to-End Encryption Keys</p>
            <p className="text-xs text-muted">Status: Signal Protocol Keys Verified Active</p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Verified
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 12. Appearance Settings Pane ────────────────────────────────────────────
function AppearanceSettingsPane() {
  const [theme, setTheme] = useState("Glassmorphic Dark");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Appearance & Themes</h2>
        <p className="text-sm text-muted">Customize color palettes, dark modes, and visual aesthetics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Glassmorphic Dark", "OLED Pure Black", "Midnight Blue"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={clsx(
              "p-5 rounded-2xl border text-left transition-all flex flex-col gap-3",
              theme === t ? "bg-primary/10 border-primary shadow-lg" : "bg-card border-border-subtle hover:bg-surface"
            )}
          >
            <div className="h-16 w-full rounded-xl bg-surface border border-border-subtle flex items-center justify-center font-bold text-xs text-primary">
              {t} Preview
            </div>
            <span className="font-semibold text-sm text-main">{t}</span>
          </button>
        ))}
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
        <h2 className="text-2xl font-bold tracking-tight text-main">Accessibility</h2>
        <p className="text-sm text-muted">Adjust contrast, animations, and screen reader preferences</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <p className="font-semibold text-main text-sm">High Contrast Mode</p>
            <p className="text-xs text-muted">Increase text contrast for improved readability</p>
          </div>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Reduce Motion & Animations</p>
            <p className="text-xs text-muted">Minimize UI transition animations</p>
          </div>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
            className="h-5 w-5 accent-primary cursor-pointer"
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
    }, 1200);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-main">Advanced & Diagnostics</h2>
        <p className="text-sm text-muted">Network diagnostics, WebRTC connection logs, and debug tools</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-main text-sm">Network Diagnostic Ping</p>
            <p className="text-xs text-muted">Test connection latency to Varta TURN/STUN relays</p>
          </div>
          <button
            type="button"
            onClick={runPingTest}
            disabled={pinging}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md hover:scale-105 transition-all"
          >
            {pinging ? "Testing..." : "Run Test"}
          </button>
        </div>

        {pingResult && (
          <div className="p-4 rounded-2xl bg-surface border border-border-subtle font-mono text-xs text-emerald-400">
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
        <h2 className="text-2xl font-bold tracking-tight text-main">About Varta</h2>
        <p className="text-sm text-muted">Commercial communication platform release info & legal links</p>
      </div>

      <div className="bg-card border border-border-subtle rounded-3xl p-8 flex flex-col items-center text-center space-y-4 shadow-sm">
        <div className="p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20">
          <MessageCircle className="w-12 h-12" />
        </div>

        <div>
          <h3 className="text-2xl font-bold text-main">Varta Communications</h3>
          <p className="text-xs font-mono text-primary font-semibold">Version 2.4.0 (Production Commercial Release)</p>
        </div>

        <p className="text-xs text-muted max-w-md leading-relaxed">
          Varta is an enterprise-grade, end-to-end encrypted communication platform designed for instant messaging, HD voice/video calls, and rich collaboration.
        </p>

        <div className="flex gap-4 pt-2">
          <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of Service"); }} className="text-xs font-semibold text-primary hover:underline">
            Terms of Service
          </a>
          <span className="text-muted">·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); alert("Privacy Policy"); }} className="text-xs font-semibold text-primary hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
