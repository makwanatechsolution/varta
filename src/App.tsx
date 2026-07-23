import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage, SettingsPage } from "./pages/LoginPage";
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
import { useEffect } from "react";
import { requestPushPermission } from "./lib/firebase";

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { session, profile, loading } = useAuth();
  if (loading || (!profile && session)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b141a]">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#1E88C7]" />
          <span className="text-sm">Loading Varta...</span>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (requireAdmin && !profile?.is_admin) return <Navigate to="/" replace />;
  
  // If not approved and trying to access anything other than /pending, redirect to /pending
  if (!profile?.is_approved && window.location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  // If approved and trying to access /pending, redirect to /
  if (profile?.is_approved && window.location.pathname === '/pending') {
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
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<JoinPage />} />

      {/* Protected: main layout (sidebar) */}
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      
      {/* Pending Approval */}
      <Route path="/pending" element={<ProtectedRoute><AwaitingApprovalPage /></ProtectedRoute>} />

      {/* Admin Dashboard */}
      <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />

      {/* Protected: full-screen pages */}
      <Route path="/chat/:id" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />
      <Route path="/new-chat" element={<ProtectedRoute><NewChatPage /></ProtectedRoute>} />
      <Route path="/calls" element={<ProtectedRoute><CallsPage /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
      <Route path="/status" element={<ProtectedRoute><StatusPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/invite" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
      <Route path="/starred" element={<ProtectedRoute><StarredPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
