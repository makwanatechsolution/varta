import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CallingProvider } from "./contexts/CallingContext";
import { GlobalCallOverlay } from "./components/calls/CallUI";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ChatRoomPage } from "./pages/ChatRoomPage";
import { NewChatPage } from "./pages/NewChatPage";
import { CallsPage } from "./pages/CallsPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { StatusPage } from "./pages/StatusPage";
import { SearchPage } from "./pages/SearchPage";
import { InvitePage } from "./pages/InvitePage";
import { JoinPage } from "./pages/JoinPage";
import { StarredPage } from "./pages/StarredPage";
import { AwaitingApprovalPage } from "./pages/AwaitingApprovalPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { usePresence } from "./hooks/usePresence";
import { useEffect, useState } from "react";
import { requestPushPermission } from "./lib/firebase";
import { SetPasswordPromptModal } from "./components/auth/SetPasswordPromptModal";

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [profileTimeout, setProfileTimeout] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (user && !profile) {
      const timer = setTimeout(() => setProfileTimeout(true), 8000);
      return () => clearTimeout(timer);
    } else {
      setProfileTimeout(false);
    }
  }, [user, profile]);

  if (loading || (!profile && user && !profileTimeout)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-main)" }}>
        <div className="flex flex-col items-center gap-4" style={{ color: "var(--text-muted)" }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
          <span className="text-sm">Connecting to Varta...</span>
        </div>
      </div>
    );
  }

  if (user && !profile && profileTimeout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}>
        <div className="max-w-md p-6 rounded-2xl bg-[#111b21] border border-zinc-800 space-y-4">
          <p className="font-semibold text-lg text-white">Connecting to Varta Server</p>
          <p className="text-xs text-zinc-400">Server is starting up on Render (free instance waking up). Please wait a few seconds and click Retry.</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => { setProfileTimeout(false); refreshProfile(); }}
              className="px-4 py-2 rounded-xl bg-[#1E88C7] text-white text-xs font-semibold hover:bg-[#1E88C7]/80"
            >
              Retry Connection
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireAdmin && !profile?.is_admin) return <Navigate to="/" replace />;
  
  const isApprovedOrAdmin = profile?.is_approved || profile?.is_admin;

  if (!isApprovedOrAdmin && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  if (isApprovedOrAdmin && location.pathname === '/pending') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  usePresence();

  useEffect(() => {
    if (user) requestPushPermission(user.id).catch(console.warn);
  }, [user]);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join" element={<JoinPage />} />

        {/* Protected: main layout (split pane) */}
        <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="chat/:id" element={<ChatRoomPage />} />
          <Route path="new-chat" element={<NewChatPage />} />
          <Route path="calls" element={<CallsPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="status" element={<StatusPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="invite" element={<InvitePage />} />
          <Route path="starred" element={<StarredPage />} />
        </Route>
        
        {/* Pending Approval */}
        <Route path="/pending" element={<ProtectedRoute><AwaitingApprovalPage /></ProtectedRoute>} />

        {/* Admin Dashboard */}
        <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <GlobalCallOverlay />
      <SetPasswordPromptModal />
    </>
  );
}

import { SettingsProvider } from "./contexts/SettingsContext";

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <CallingProvider>
            <AppRoutes />
          </CallingProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
