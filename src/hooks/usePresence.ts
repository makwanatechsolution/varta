import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { PresenceStatus } from "../types/database";

const HEARTBEAT_MS = 30_000;
const AWAY_THRESHOLD_MS = 5 * 60_000; // 5 minutes idle → away

// ── Manual status persistence ─────────────────────────────────────────────────
// When a user sets "Busy", "DND", "Meeting" etc. the heartbeat must NOT
// overwrite it back to "online". We store the manual choice in localStorage.
const MANUAL_STATUS_KEY = "varta_manual_status";

function getManualStatus(): PresenceStatus | null {
  return (localStorage.getItem(MANUAL_STATUS_KEY) as PresenceStatus | null) ?? null;
}

function saveManualStatus(status: PresenceStatus | null) {
  if (status === null) localStorage.removeItem(MANUAL_STATUS_KEY);
  else localStorage.setItem(MANUAL_STATUS_KEY, status);
}

// Statuses that the auto-heartbeat should never override
const LOCK_STATUSES: PresenceStatus[] = ["busy", "dnd", "meeting", "presentation", "focused", "invisible"];

// ── Main hook ─────────────────────────────────────────────────────────────────

export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const currentPresenceRef = useRef<PresenceStatus>("online");

  const updatePresence = useCallback(
    async (presence: PresenceStatus) => {
      if (!user) return;
      currentPresenceRef.current = presence;
      await supabase
        .from("profiles")
        .update({ presence, last_seen: new Date().toISOString() })
        .eq("id", user.id);
    },
    [user]
  );

  /**
   * Call this from SettingsPage when user manually picks a status.
   * Persists the choice so the heartbeat won't overwrite it.
   */
  const setManualStatus = useCallback(
    async (status: PresenceStatus) => {
      // "online" and "away" are auto-managed — clear the manual lock
      if (status === "online" || status === "away") {
        saveManualStatus(null);
      } else {
        saveManualStatus(status);
      }
      await updatePresence(status);
    },
    [updatePresence]
  );

  useEffect(() => {
    if (!user) return;

    // Activity tracking
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });

    // Restore manual status if set, else go online
    const manual = getManualStatus();
    if (manual && LOCK_STATUSES.includes(manual)) {
      updatePresence(manual);
    } else {
      updatePresence("online");
    }

    // Heartbeat: only auto-switch between online/away, never override locked statuses
    intervalRef.current = window.setInterval(() => {
      const locked = getManualStatus();
      if (locked && LOCK_STATUSES.includes(locked)) {
        // Keep broadcasting the locked status so DB stays current
        updatePresence(locked);
        return;
      }
      const idleMs = Date.now() - lastActivityRef.current;
      updatePresence(idleMs > AWAY_THRESHOLD_MS ? "away" : "online");
    }, HEARTBEAT_MS);

    // Supabase Realtime presence for own session tracking
    const channel = supabase.channel(`presence:${user.id}`, {
      config: { presence: { key: user.id } },
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    // Page visibility: tab hidden → away, tab shown → restore
    const handleVisibility = () => {
      if (document.hidden) {
        const locked = getManualStatus();
        if (!locked || !LOCK_STATUSES.includes(locked)) {
          updatePresence("away");
        }
      } else {
        lastActivityRef.current = Date.now();
        const locked = getManualStatus();
        if (locked && LOCK_STATUSES.includes(locked)) {
          updatePresence(locked);
        } else {
          updatePresence("online");
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Cleanup: mark offline on unmount
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
      // Only mark offline if not in a "locked" status (e.g. DND user goes offline)
      const locked = getManualStatus();
      if (!locked || !LOCK_STATUSES.includes(locked)) {
        updatePresence("offline");
      } else {
        updatePresence("offline"); // Always go offline on tab close regardless
      }
    };
  }, [user, updatePresence]);

  return { updatePresence, setManualStatus };
}

// ── Per-user presence channel (used by contact list avatars) ─────────────────
// NOTE: This creates 1 channel per contact — only use for small lists (< 10).
// For larger contact lists, rely on postgres_changes on the profiles table.
import { useState } from "react";

export function usePresenceChannel(userIds: string[]) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userIds.length) return;

    const channels = userIds.map((uid) => {
      const ch = supabase.channel(`presence:${uid}`);
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (Object.keys(state).length > 0) next.add(uid);
          else next.delete(uid);
          return next;
        });
      });
      ch.subscribe();
      return ch;
    });

    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [userIds.join(",")]); // eslint-disable-line

  return onlineUsers;
}
