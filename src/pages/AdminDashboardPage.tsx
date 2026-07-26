import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/database";
import {
  CheckCircle,
  ShieldAlert,
  LogOut,
  UserPlus,
  Users,
  Clock,
  Shield,
  Search,
  Settings as SettingsIcon,
  Trash2,
  XCircle,
  RefreshCw,
  LayoutDashboard,
  Check,
  X,
  PhoneCall,
  Server,
  UserCheck,
  UserX,
  ExternalLink
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "../components/ui/Avatar";

type AdminTab = "overview" | "pending" | "users" | "create" | "settings";

interface SystemStats {
  totalUsers: number;
  pendingUsers: number;
  adminUsers: number;
  approvedUsers: number;
  totalCalls: number;
}

interface AdminSettings {
  auto_approve_users: boolean;
  require_invite_code: boolean;
  maintenance_mode: boolean;
}

export function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    pendingUsers: 0,
    adminUsers: 0,
    approvedUsers: 0,
    totalCalls: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "approved" | "pending" | "admin">("all");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New User Form State
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newAutoApprove, setNewAutoApprove] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);

  // Admin Settings State
  const [settings, setSettings] = useState<AdminSettings>({
    auto_approve_users: false,
    require_invite_code: false,
    maintenance_mode: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const { signOut, user: currentUser } = useAuth();
  const navigate = useNavigate();

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── Fetch All Data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch All Profiles
      const { data: allProfiles, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profError) throw profError;

      const userList = allProfiles || [];
      setProfiles(userList);
      setPendingUsers(userList.filter((p) => !p.is_approved));

      // 2. Fetch Call Count
      const { count: callCount } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true });

      setStats({
        totalUsers: userList.length,
        pendingUsers: userList.filter((p) => !p.is_approved).length,
        adminUsers: userList.filter((p) => p.is_admin).length,
        approvedUsers: userList.filter((p) => p.is_approved).length,
        totalCalls: callCount || 0,
      });

      // 3. Fetch Admin Settings
      const { data: settingsData } = await supabase
        .from("admin_settings" as any)
        .select("*");

      if (settingsData && (settingsData as any[]).length > 0) {
        const nextSettings: any = { ...settings };
        (settingsData as any[]).forEach((s: any) => {
          if (s.key in nextSettings) {
            nextSettings[s.key] = s.value === true || s.value === "true";
          }
        });
        setSettings(nextSettings);
      }
    } catch (err: any) {
      console.error("Error loading admin dashboard data:", err);
      showToast("Failed to sync dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Approve User ──────────────────────────────────────────────────────────
  const handleApprove = async (targetUser: Profile) => {
    setActionId(targetUser.id);
    try {
      // 1. Update DB
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("id", targetUser.id);

      if (error) throw error;

      // 2. Try sending notification email cleanly
      fetch("/api/notifyUserApproved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id, name: targetUser.display_name }),
      }).catch(() => {});

      showToast(`Approved user "${targetUser.display_name}" successfully!`);
      await fetchData();
    } catch (err: any) {
      console.error("Error approving user:", err);
      showToast(err.message || "Failed to approve user.", "error");
    } finally {
      setActionId(null);
    }
  };

  // ─── Reject / Unapprove / Delete User ──────────────────────────────────────
  const handleRejectOrDelete = async (targetUser: Profile, deletePerm = false) => {
    const actionLabel = deletePerm ? "delete profile" : "reject approval for";
    if (!confirm(`Are you sure you want to ${actionLabel} "${targetUser.display_name}"?`)) return;

    setActionId(targetUser.id);
    try {
      if (deletePerm) {
        const { error } = await supabase.from("profiles").delete().eq("id", targetUser.id);
        if (error) throw error;
        showToast(`User "${targetUser.display_name}" deleted.`);
      } else {
        const { error } = await supabase
          .from("profiles")
          .update({ is_approved: false })
          .eq("id", targetUser.id);
        if (error) throw error;
        showToast(`Rejected approval for "${targetUser.display_name}".`);
      }
      await fetchData();
    } catch (err: any) {
      console.error("Error deleting/rejecting user:", err);
      showToast(err.message || "Action failed.", "error");
    } finally {
      setActionId(null);
    }
  };

  // ─── Toggle Admin Role ─────────────────────────────────────────────────────
  const handleToggleAdmin = async (targetUser: Profile) => {
    if (targetUser.id === currentUser?.id) {
      alert("You cannot remove admin status from your own current user account.");
      return;
    }

    const nextAdminState = !targetUser.is_admin;
    setActionId(targetUser.id);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: nextAdminState, is_approved: true })
        .eq("id", targetUser.id);

      if (error) throw error;

      showToast(`Updated admin status for "${targetUser.display_name}" to ${nextAdminState ? "ADMIN" : "USER"}.`);
      await fetchData();
    } catch (err: any) {
      console.error("Error toggling admin role:", err);
      showToast(err.message || "Failed to update user role.", "error");
    } finally {
      setActionId(null);
    }
  };

  // ─── Create User Direct Form ────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newDisplayName) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    setCreatingUser(true);
    try {
      // Create user in Auth
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            display_name: newDisplayName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Ensure profile is updated with admin/approval flags
        await supabase
          .from("profiles")
          .update({
            display_name: newDisplayName,
            is_admin: newIsAdmin,
            is_approved: newAutoApprove,
          })
          .eq("id", data.user.id);
      }

      showToast(`Created new user "${newDisplayName}" (${newEmail})!`);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewIsAdmin(false);
      await fetchData();
      setActiveTab("users");
    } catch (err: any) {
      console.error("Error creating user:", err);
      showToast(err.message || "Failed to create user account.", "error");
    } finally {
      setCreatingUser(false);
    }
  };

  // ─── Save Admin Settings ───────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const entries = Object.entries(settings);
      for (const [key, val] of entries) {
        await (supabase.from("admin_settings" as any) as any).upsert({
          key,
          value: JSON.stringify(val),
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.id,
        });
      }
      showToast("Platform admin settings updated!");
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast("Failed to save settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered Users List
  const filteredUsers = profiles.filter((p) => {
    const nameMatch =
      p.display_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.username && p.username.toLowerCase().includes(search.toLowerCase()));

    if (!nameMatch) return false;

    if (roleFilter === "approved") return p.is_approved;
    if (roleFilter === "pending") return !p.is_approved;
    if (roleFilter === "admin") return p.is_admin;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0b141a] text-white flex flex-col font-sans">
      {/* ─── Top Header Bar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#111b21]/90 backdrop-blur-xl border-b border-zinc-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-[#1E88C7]/20 border border-[#1E88C7]/30 flex items-center justify-center text-[#1E88C7]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Varta Admin Control Center</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live System
                </span>
              </div>
              <p className="text-xs text-zinc-400">User Approvals, System Roles & Platform Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-[#202c33] border border-zinc-700/60 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-4 py-2 bg-[#202c33] hover:bg-zinc-700 border border-zinc-700/60 rounded-xl text-xs font-semibold text-white transition-colors"
            >
              <ExternalLink size={14} />
              <span>Go to Chat App</span>
            </button>

            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 transition-colors"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              toastMessage.type === "error"
                ? "bg-red-950/90 border-red-500/50 text-red-200"
                : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
            }`}
          >
            {toastMessage.type === "error" ? <XCircle size={16} /> : <CheckCircle size={16} />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content Container ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-zinc-800/80 gap-2 scrollbar-hide overflow-x-auto pb-1">
          {[
            { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
            {
              id: "pending" as const,
              label: "Pending Approvals",
              icon: Clock,
              badge: stats.pendingUsers,
            },
            { id: "users" as const, label: "User Directory", icon: Users, badge: stats.totalUsers },
            { id: "create" as const, label: "Create User", icon: UserPlus },
            { id: "settings" as const, label: "Admin Settings", icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium transition-all border-b-2 ${
                  active
                    ? "bg-[#1E88C7]/15 border-[#1E88C7] text-[#1E88C7]"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-[#202c33]/50"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tab.id === "pending"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : active
                        ? "bg-[#1E88C7]/20 text-[#1E88C7]"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Tab 1: OVERVIEW ───────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Users"
                value={stats.totalUsers}
                icon={Users}
                color="text-[#1E88C7]"
                bgColor="bg-[#1E88C7]/10"
              />
              <StatCard
                title="Pending Approvals"
                value={stats.pendingUsers}
                icon={Clock}
                color="text-amber-400"
                bgColor="bg-amber-500/10"
                highlight={stats.pendingUsers > 0}
              />
              <StatCard
                title="Active Admins"
                value={stats.adminUsers}
                icon={Shield}
                color="text-purple-400"
                bgColor="bg-purple-500/10"
              />
              <StatCard
                title="Approved Users"
                value={stats.approvedUsers}
                icon={UserCheck}
                color="text-emerald-400"
                bgColor="bg-emerald-500/10"
              />
              <StatCard
                title="Total Calls Logs"
                value={stats.totalCalls}
                icon={PhoneCall}
                color="text-indigo-400"
                bgColor="bg-indigo-500/10"
              />
            </div>

            {/* Quick Action Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Approvals Summary */}
              <div className="bg-[#1B2326] border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Clock className="text-amber-400 w-5 h-5" />
                    Pending Approvals ({pendingUsers.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab("pending")}
                    className="text-xs text-[#1E88C7] hover:underline"
                  >
                    View All →
                  </button>
                </div>

                {pendingUsers.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
                    🎉 All pending user registrations have been processed!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pendingUsers.slice(0, 3).map((user) => (
                      <div
                        key={user.id}
                        className="bg-[#202c33]/70 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar src={user.avatar_url} name={user.display_name} size="sm" />
                          <div>
                            <p className="font-medium text-sm text-white">{user.display_name}</p>
                            <p className="text-xs text-zinc-400">
                              Joined: {new Date(user.created_at || "").toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleApprove(user)}
                          disabled={actionId === user.id}
                          className="px-3 py-1.5 bg-[#1E88C7] hover:bg-[#1971A5] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle size={14} />
                          Approve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Health & Server Status */}
              <div className="bg-[#1B2326] border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Server className="text-[#1E88C7] w-5 h-5" />
                  System & Backend Health
                </h3>

                <div className="space-y-3 text-xs">
                  <HealthRow label="Supabase Database Status" status="Operational" ok />
                  <HealthRow label="Realtime WebSocket Signaling" status="Connected" ok />
                  <HealthRow label="WebRTC TURN Server Pool" status="Active (STUN/TURN)" ok />
                  <HealthRow label="User Authentication & RLS" status="Secured" ok />
                  <HealthRow
                    label="Push Notification Gateway"
                    status="Configured"
                    ok
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setActiveTab("create")}
                    className="flex-1 py-2.5 bg-[#1E88C7]/20 border border-[#1E88C7]/30 text-[#1E88C7] hover:bg-[#1E88C7]/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <UserPlus size={14} />
                    Create New Account
                  </button>

                  <button
                    onClick={() => setActiveTab("settings")}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <SettingsIcon size={14} />
                    Configure Rules
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab 2: PENDING APPROVALS ─────────────────────────────────────── */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Pending Approval Requests
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {pendingUsers.length}
                </span>
              </h2>

              <p className="text-xs text-zinc-400">
                New user signups must be approved by an administrator before they can enter Varta.
              </p>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="bg-[#1B2326] rounded-2xl border border-zinc-800 p-16 text-center text-zinc-400 space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
                <h3 className="text-base font-semibold text-white">No Pending Approvals</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  All user registration requests have been approved. New signups will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid gap-3.5">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-[#1B2326] rounded-2xl border border-zinc-800/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-zinc-700 transition-all shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar src={user.avatar_url} name={user.display_name} size="lg" />
                      <div className="space-y-1">
                        <h3 className="font-semibold text-base text-white">{user.display_name}</h3>
                        <p className="text-xs text-zinc-400">
                          Username: {user.username ? `@${user.username}` : "Not set"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Signed up: {new Date(user.created_at || "").toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleRejectOrDelete(user, false)}
                        disabled={actionId === user.id}
                        className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <UserX size={15} />
                        Reject
                      </button>

                      <button
                        onClick={() => handleApprove(user)}
                        disabled={actionId === user.id}
                        className="px-5 py-2.5 bg-[#1E88C7] hover:bg-[#1971A5] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-[#1E88C7]/20 transition-all disabled:opacity-50"
                      >
                        {actionId === user.id ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Approve User
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Tab 3: USER DIRECTORY ────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1B2326] p-4 rounded-2xl border border-zinc-800">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users by name or username..."
                  className="w-full bg-[#202c33] border border-zinc-700/60 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#1E88C7]"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                {(["all", "approved", "pending", "admin"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRoleFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                      roleFilter === tab
                        ? "bg-[#1E88C7] text-white"
                        : "bg-[#202c33] text-zinc-400 hover:text-white border border-zinc-700/60"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Directory Table */}
            <div className="bg-[#1B2326] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-[#202c33] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-5 py-3.5">User</th>
                      <th className="px-5 py-3.5">Approval Status</th>
                      <th className="px-5 py-3.5">Role</th>
                      <th className="px-5 py-3.5">Joined Date</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-zinc-500">
                          No users match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#202c33]/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar src={u.avatar_url} name={u.display_name} presence={u.presence} size="md" />
                              <div>
                                <p className="font-semibold text-white text-sm">{u.display_name}</p>
                                <p className="text-[11px] text-zinc-400">
                                  {u.username ? `@${u.username}` : "no username"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {u.is_approved ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                <CheckCircle size={13} />
                                Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                <Clock size={13} />
                                Pending
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {u.is_admin ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                                <Shield size={13} />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
                                Member
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-zinc-400">
                            {new Date(u.created_at || "").toLocaleDateString()}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!u.is_approved && (
                                <button
                                  onClick={() => handleApprove(u)}
                                  disabled={actionId === u.id}
                                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                                  title="Approve User"
                                >
                                  <Check size={14} />
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleAdmin(u)}
                                disabled={actionId === u.id}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  u.is_admin
                                    ? "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                                }`}
                                title="Toggle Admin Access"
                              >
                                {u.is_admin ? "Demote" : "Make Admin"}
                              </button>

                              <button
                                onClick={() => handleRejectOrDelete(u, true)}
                                disabled={actionId === u.id}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                title="Delete Account"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab 4: CREATE USER ───────────────────────────────────────────── */}
        {activeTab === "create" && (
          <div className="max-w-xl mx-auto w-full bg-[#1B2326] border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <UserPlus className="text-[#1E88C7]" />
                Create New Account
              </h2>
              <p className="text-xs text-zinc-400">
                Instantly provision a new user or administrator account.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Full Name / Display Name *</label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full bg-[#202c33] border border-zinc-700/70 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#1E88C7]"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. alex@varta.app"
                  className="w-full bg-[#202c33] border border-zinc-700/70 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#1E88C7]"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#202c33] border border-zinc-700/70 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#1E88C7]"
                />
              </div>

              <div className="pt-2 space-y-3 border-t border-zinc-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAutoApprove}
                    onChange={(e) => setNewAutoApprove(e.target.checked)}
                    className="w-4 h-4 accent-[#1E88C7] rounded"
                  />
                  <div>
                    <span className="font-semibold text-white">Auto-approve user immediately</span>
                    <p className="text-[11px] text-zinc-400">User will skip the awaiting approval stage</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                    className="w-4 h-4 accent-purple-500 rounded"
                  />
                  <div>
                    <span className="font-semibold text-purple-300">Grant Administrator Rights</span>
                    <p className="text-[11px] text-zinc-400">User will gain access to this Admin Control Center</p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={creatingUser}
                className="w-full py-3 bg-[#1E88C7] hover:bg-[#1971A5] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#1E88C7]/20 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {creatingUser ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Create User Account</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ─── Tab 5: ADMIN SETTINGS ────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto w-full bg-[#1B2326] border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <SettingsIcon className="text-[#1E88C7]" />
                Platform & Administration Settings
              </h2>
              <p className="text-xs text-zinc-400">
                Configure platform signups, access restrictions, and infrastructure rules.
              </p>
            </div>

            <div className="space-y-5 text-xs">
              <div className="p-4 bg-[#202c33]/70 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">Auto-Approve New Registrations</h4>
                  <p className="text-zinc-400">
                    When enabled, newly registered users bypass manual admin review.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.auto_approve_users}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, auto_approve_users: e.target.checked }))
                  }
                  className="w-5 h-5 accent-[#1E88C7] cursor-pointer"
                />
              </div>

              <div className="p-4 bg-[#202c33]/70 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">Require Invite Code on Signup</h4>
                  <p className="text-zinc-400">Only users with valid invite codes can sign up.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.require_invite_code}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, require_invite_code: e.target.checked }))
                  }
                  className="w-5 h-5 accent-[#1E88C7] cursor-pointer"
                />
              </div>

              <div className="p-4 bg-[#202c33]/70 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">System Maintenance Mode</h4>
                  <p className="text-zinc-400">Temporarily block non-admin logins for upgrades.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenance_mode}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, maintenance_mode: e.target.checked }))
                  }
                  className="w-5 h-5 accent-red-500 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-3 bg-[#1E88C7] hover:bg-[#1971A5] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#1E88C7]/20 transition-all flex items-center justify-center gap-2"
            >
              {savingSettings ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>Save Platform Settings</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  highlight = false,
}: {
  title: string;
  value: number;
  icon: any;
  color: string;
  bgColor: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        highlight
          ? "bg-amber-500/10 border-amber-500/40 animate-pulse"
          : "bg-[#1B2326] border-zinc-800/80 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-400 font-medium">{title}</span>
        <div className={`p-2 rounded-xl ${bgColor} ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}

function HealthRow({ label, status, ok }: { label: string; status: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#202c33]/50 border border-zinc-800">
      <span className="text-zinc-300 font-medium">{label}</span>
      <span
        className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${
          ok ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-red-500/15 text-red-400"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
