import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
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

    const now = new Date().toISOString();

    const { data: allStories } = await supabase
      .from("statuses")
      .select(`
        *,
        profile:profiles(id, display_name, avatar_url)
      `)
      .eq("is_deleted", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    const { data: views } = await supabase
      .from("status_views")
      .select("status_id")
      .eq("viewer_id", user.id);

    const viewedIds = new Set(views?.map((v: any) => v.status_id) ?? []);

    const enriched = (allStories ?? []).map((s: any) => ({
      ...(s as object),
      viewed: viewedIds.has(s.id),
    })) as StatusStory[];

    setStories(enriched.filter((s) => s.user_id !== user.id));
    setMyStories(enriched.filter((s) => s.user_id === user.id));
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
    await supabase.from("statuses").insert({
      user_id: user.id,
      ...opts,
    });
    await load();
  };

  const markViewed = async (statusId: string) => {
    if (!user) return;
    await supabase.from("status_views").upsert({
      status_id: statusId,
      viewer_id: user.id,
    });
    await load();
  };

  const getViewers = async (statusId: string) => {
    const { data } = await supabase
      .from("status_views")
      .select(`
        viewed_at,
        reaction_emoji,
        viewer:profiles(id, display_name, avatar_url)
      `)
      .eq("status_id", statusId)
      .order("viewed_at", { ascending: true });
    return data ?? [];
  };

  return { stories, myStories, loading, postStory, markViewed, getViewers, reload: load };
}
