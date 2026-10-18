import { useEffect, useState } from 'react';
import { Bell, X, ArrowUpRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { callAudio } from '../../lib/audio';
import { useAuth } from '../../contexts/AuthContext';
import { onForegroundMessage, requestPushPermission } from '../../lib/firebase';

export function NotificationCenter() {
  const { user, profile } = useAuth();
  const { soundAlerts } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{ title: string; body: string; path: string } | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    const sync = () => {
      if (!document.hidden) requestPushPermission(user.id, false).catch(console.warn);
    };
    sync();
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [user, profile?.id]);

  useEffect(() => {
    if (!user) { setNotice(null); return; }
    return onForegroundMessage(payload => {
      const data = payload.data || {};
      const path = data.conversationId ? `/chat/${encodeURIComponent(data.conversationId)}` : '/settings';
      if (data.type === 'message' && location.pathname === path && !document.hidden) return;
      if (soundAlerts && data.type === "message") callAudio.playMessageSound();
      setNotice({ title: data.title || payload.notification?.title || 'Varta', body: data.body || payload.notification?.body || 'You have a new update', path });
    });
  }, [user, location.pathname, soundAlerts]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice || !user) return null;
  return (
    <aside role="status" className="notification-toast">
      <span className="notification-toast-icon"><Bell size={20} /></span>
      <button className="min-w-0 flex-1 text-left" onClick={() => { navigate(notice.path); setNotice(null); }}>
        <span className="block text-sm font-semibold truncate">{notice.title}</span>
        <span className="block text-xs text-muted mt-1 line-clamp-2">{notice.body}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">Open <ArrowUpRight size={12} /></span>
      </button>
      <button aria-label="Dismiss notification" onClick={() => setNotice(null)} className="p-1 text-muted"><X size={18} /></button>
    </aside>
  );
}
