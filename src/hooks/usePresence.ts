import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { PresenceStatus } from "../types/database";

const HEARTBEAT_MS = 30_000;
const AWAY_THRESHOLD_MS = 5 * 60_000;

export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());

  const updatePresence = useCallback(
    async (presence: PresenceStatus) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ presence, last_seen: new Date().toISOString() })
        .eq("id", user.id);
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);

    updatePresence("online");

    intervalRef.current = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      updatePresence(idle > AWAY_THRESHOLD_MS ? "away" : "online");
    }, HEARTBEAT_MS);

    const channel = supabase.channel(`presence:${user.id}`, {
      config: { presence: { key: user.id } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    const handleVisibility = () => {
      if (document.hidden) updatePresence("away");
      else {
        lastActivityRef.current = Date.now();
        updatePresence("online");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
      updatePresence("offline");
    };
  }, [user, updatePresence]);

  return { updatePresence };
}

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

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userIds.join(",")]);

  return onlineUsers;
}
