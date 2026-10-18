import { useEffect, useState, useCallback, useRef } from "react";
import { vartaWS } from "../lib/ws";
import { statusesApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { StatusStory } from "../types/database";

export function useStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StatusStory[]>([]);
  const [myStories, setMyStories] = useState<StatusStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    const currentRequest = ++requestId.current;
    setError(null);
    const { data: allStories, error: loadError } = await statusesApi.list();
    if (currentRequest !== requestId.current) return;
    if (loadError) { setError(loadError); setLoading(false); return; }

    const enriched = (allStories ?? []).map((s: any) => ({
      ...(s as object),
      viewed: s.viewed ?? false,
    })) as StatusStory[];

    setStories(enriched.filter((s) => s.user_id !== user.uid));
    setMyStories(enriched.filter((s) => s.user_id === user.uid));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, 60000);
    const offStatus = vartaWS.on("statuses", "updated", load);
    const offConnect = vartaWS.on("connection", "connected", load);
    const refresh = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", refresh);
    return () => { ++requestId.current; clearInterval(timer); offStatus(); offConnect(); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const postStory = async (opts: {
    media_type: StatusStory["media_type"];
    media_url?: string;
    text_content?: string;
    background_color?: string;
  }) => {
    if (!user) return;
    const { error } = await statusesApi.create({
      ...opts,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error);
    await load();
  };

  const markViewed = async (statusId: string, reactionEmoji?: string) => {
    if (!user) return;
    if (myStories.some(story => story.id === statusId)) return;
    const { error } = await statusesApi.markViewed(statusId, reactionEmoji);
    if (!error) setStories(previous => previous.map(story => story.id === statusId ? { ...story, viewed: true } : story));
  };

  const getViewers = async (statusId: string) => {
    const { data, error } = await import("../lib/api").then((m) =>
      m.api.get<any[]>(`/api/statuses/${statusId}/views`),
    );
    if (error) throw new Error(error);
    return data ?? [];
  };

  const deleteStory = async (id: string) => {
    const { error } = await statusesApi.delete(id);
    if (error) throw new Error(error);
    await load();
  };

  return { stories, myStories, loading, error, deleteStory, postStory, markViewed, getViewers, reload: load };
}
