import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/database";
import { CheckCircle, ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function AdminDashboardPage() {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", false)
      .order("created_at", { ascending: false });
    
    if (data && !error) {
      setPendingUsers(data);
    }
  };

  const handleApprove = async (user: Profile) => {
    setLoadingId(user.id);
    try {
      // 1. Approve in DB
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("id", user.id);

      if (error) throw error;

      // 2. Trigger email notification via API (which uses Service Role to get email)
      await fetch("/api/notifyUserApproved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: user.display_name }),
      });

      // Remove from list
      setPendingUsers(prev => prev.filter(p => p.id !== user.id));
    } catch (err) {
      console.error("Error approving user:", err);
      alert("Failed to approve user.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#12181A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-[#1E88C7] w-8 h-8" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate("/")} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Go to Chat
            </button>
            <button onClick={signOut} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <LogOut size={18} />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </header>

        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          Pending Approvals
          <span className="bg-[#1E88C7]/20 text-[#1E88C7] text-xs px-2 py-1 rounded-full">{pendingUsers.length}</span>
        </h2>

        {pendingUsers.length === 0 ? (
          <div className="bg-[#1B2326] rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">
            No pending users waiting for approval.
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map(user => (
              <div key={user.id} className="bg-[#1B2326] rounded-xl border border-zinc-800 p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-medium">
                      {user.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{user.display_name}</h3>
                    <p className="text-sm text-zinc-400">Joined: {new Date(user.created_at || '').toLocaleDateString()}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleApprove(user)}
                  disabled={loadingId === user.id}
                  className="flex items-center gap-2 bg-[#1E88C7] hover:bg-[#1971A5] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {loadingId === user.id ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={18} />
                  )}
                  Approve User
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
