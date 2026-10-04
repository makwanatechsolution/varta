import { useEffect, useState, useCallback } from "react";
import { statusesApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { StatusStory } from "../types/database";

export function useStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StatusStory[]>([]);
  const [myStories, setMyStories] = useState<StatusStory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: allStories } = await statusesApi.list();

    const enriched = (allStories ?? []).map((s: any) => ({
      ...(s as object),
      viewed: s.viewed ?? false,
    })) as StatusStory[];

    setStories(enriched.filter((s) => s.user_id !== user.uid));
    setMyStories(enriched.filter((s) => s.user_id === user.uid));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const postStory = async (opts: {
    media_type: StatusStory["media_type"];
    media_url?: string;
    text_content?: string;
    background_color?: string;
  }) => {
    if (!user) return;
    await statusesApi.create({
      ...opts,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await load();
  };

  const markViewed = async (statusId: string, reactionEmoji?: string) => {
    if (!user) return;
    await statusesApi.markViewed(statusId, reactionEmoji);
    await load();
  };

  const getViewers = async (statusId: string) => {
    const { data } = await import("../lib/api").then((m) =>
      m.api.get<any[]>(`/api/statuses/${statusId}/views`),
    );
    return data ?? [];
  };

  return { stories, myStories, loading, postStory, markViewed, getViewers, reload: load };
}
