import { useEffect, useRef, useCallback, useState } from "react";
import { vartaWS } from "../lib/ws";
import { profilesApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { PresenceStatus } from "../types/database";

const HEARTBEAT_MS = 30_000;
const AWAY_THRESHOLD_MS = 5 * 60_000; // 5 minutes idle → away

// ── Manual status persistence ─────────────────────────────────────────────────
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
      await profilesApi.updatePresence(presence);
    },
    [user],
  );

  /**
   * Call this from SettingsPage when user manually picks a status.
   */
  const setManualStatus = useCallback(
    async (status: PresenceStatus) => {
      if (status === "online" || status === "away") {
        saveManualStatus(null);
      } else {
        saveManualStatus(status);
      }
      await updatePresence(status);
    },
    [updatePresence],
  );

  useEffect(() => {
    if (!user) return;

    // Activity tracking
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
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

    // Heartbeat
    intervalRef.current = window.setInterval(() => {
      const locked = getManualStatus();
      if (locked && LOCK_STATUSES.includes(locked)) {
        updatePresence(locked);
        return;
      }
      const idleMs = Date.now() - lastActivityRef.current;
      updatePresence(idleMs > AWAY_THRESHOLD_MS ? "away" : "online");
    }, HEARTBEAT_MS);

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
      updatePresence("offline");
    };
  }, [user, updatePresence]);

  return { updatePresence, setManualStatus };
}

// ── Per-user presence tracking via WebSocket ──────────────────────────────────

export function usePresenceChannel(userIds: string[]) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userIds.length) return;

    const unsubs: (() => void)[] = [];

    for (const uid of userIds) {
      const unsub = vartaWS.on(`presence:${uid}`, "presence_update", (payload: any) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (payload?.presence && payload.presence !== "offline") {
            next.add(uid);
          } else {
            next.delete(uid);
          }
          return next;
        });
      });
      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [userIds.join(",")]); // eslint-disable-line

  return onlineUsers;
}
