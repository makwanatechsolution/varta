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
import { NotificationCenter } from "./components/ui/NotificationCenter";
import { SetPasswordPromptModal } from "./components/auth/SetPasswordPromptModal";

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, profile, loading, error, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-main">
      <div role="status" className="flex flex-col items-center gap-4 text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Connecting to Varta...</span>
      </div>
    </div>;
  }

  if (user && !profile) {
    return <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-main">
      <section className="w-full max-w-md rounded-2xl border border-border-subtle bg-sidebar p-6 space-y-4">
        <p className="font-semibold text-lg">Sign-in succeeded</p>
        <p className="text-sm text-muted">Varta could not finish connecting your account. You are still signed in.</p>
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-xs text-red-400 break-words">{error || "The server did not return an account profile. Please retry."}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={() => { refreshProfile(); }} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white">Retry connection</button>
          <button onClick={signOut} className="rounded-xl border border-border-subtle px-4 py-2 text-sm text-muted">Sign out</button>
        </div>
      </section>
    </div>;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireAdmin && !profile?.is_admin) return <Navigate to="/" replace />;
  
  if (location.pathname === "/pending") return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  usePresence();


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
      <NotificationCenter />
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
