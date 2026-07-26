import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Eye, Camera } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStories } from "../hooks/useStories";
import { Avatar } from "../components/ui/Avatar";
import { StoryViewer } from "../components/stories/StoryViewer";
import { supabase } from "../lib/supabase";
import type { StatusStory } from "../types/database";

const BG_COLORS = [
  "#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#0ea5e9",
];

export function StatusPage() {
  const { user } = useAuth();
  const { myStories, stories, postStory, markViewed, getViewers } = useStories();
  const [viewerStories, setViewerStories] = useState<StatusStory[] | null>(null);
  const [showTextForm, setShowTextForm] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]!);
  const [posting, setPosting] = useState(false);
  const [viewerList, setViewerList] = useState<{
    viewed_at: string;
    reaction_emoji: string | null;
    viewer: { id: string; display_name: string; avatar_url: string | null } | null;
  }[]>([]);
  const [showViewerList, setShowViewerList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group contact stories by user
  const grouped = stories.reduce<Record<string, StatusStory[]>>((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = [];
    acc[s.user_id].push(s);
    return acc;
  }, {});

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setPosting(true);
    const ext = file.name.split(".").pop();
    const path = `status/${user.id}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(data.path);
      await postStory({
        media_type: file.type.startsWith("video/") ? "video" : "photo",
        media_url: urlData.publicUrl,
      });
    }
    setPosting(false);
    e.target.value = "";
  };

  const handleTextPost = async () => {
    if (!textContent.trim()) return;
    setPosting(true);
    await postStory({ media_type: "text", text_content: textContent.trim(), background_color: bgColor });
    setTextContent("");
    setShowTextForm(false);
    setPosting(false);
  };

  const handleViewMyStory = async (story: StatusStory) => {
    const viewers = await getViewers(story.id);
    setViewerList(viewers as typeof viewerList);
    setShowViewerList(true);
    setViewerStories(myStories);
  };

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ height: "100dvh", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}
    >
      <header
        className="flex items-center gap-4 px-4 py-3 border-b shadow-sm"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
        }}
      >
        <Link to="/" className="md:hidden transition-colors hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 font-semibold text-lg" style={{ color: "var(--text-main)" }}>Status</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* My status */}
        <section className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar
              name={user?.email ?? "You"}
              storyUnseen={myStories.length > 0}
              size="lg"
              onClick={() => myStories.length > 0 && handleViewMyStory(myStories[0]!)}
            />
            <div className="flex-1">
              <p className="font-medium" style={{ color: "var(--text-main)" }}>My Status</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {myStories.length > 0
                  ? `${myStories.length} update${myStories.length > 1 ? "s" : ""}`
                  : "Tap to add status update"}
              </p>
            </div>
            {myStories.length > 0 && (
              <button
                type="button"
                onClick={() => handleViewMyStory(myStories[0]!)}
                className="rounded-full p-2 hover:bg-surface"
                style={{ color: "var(--text-muted)" }}
              >
                <Eye className="h-5 w-5" />
              </button>
            )}
          </div>
        </section>

        {/* Recent updates */}
        {Object.keys(grouped).length > 0 && (
          <section>
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Recent updates
            </p>
            {Object.entries(grouped).map(([userId, userStories]) => {
              const unseen = userStories.some((s) => !s.viewed);
              const latest = userStories[0];
              return (
                <button
                  key={userId}
                  type="button"
                  onClick={() => setViewerStories(userStories)}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface transition-colors border-b"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <Avatar
                    src={latest?.profile?.avatar_url}
                    name={latest?.profile?.display_name ?? "?"}
                    presence={latest?.profile?.presence}
                    size="lg"
                    storyUnseen={unseen}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium" style={{ color: "var(--text-main)" }}>{latest?.profile?.display_name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {userStories.length} update{userStories.length > 1 ? "s" : ""}
                      {unseen ? " · New" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {Object.keys(grouped).length === 0 && myStories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: "var(--text-muted)" }}>
            <Camera className="mb-4 h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">No status updates</p>
            <p className="mt-1 text-xs opacity-70">Post your first status below</p>
          </div>
        )}
      </div>

      {/* Text status form */}
      {showTextForm && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: bgColor }}>
          <div className="flex items-center gap-3 p-4">
            <button type="button" onClick={() => setShowTextForm(false)} className="text-white/80">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <span className="text-white font-medium">Text status</span>
          </div>

          <div className="flex flex-1 items-center justify-center p-8">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              autoFocus
              placeholder="What's on your mind?"
              className="w-full bg-transparent text-center text-3xl font-bold text-white outline-none resize-none placeholder:text-white/50"
              rows={3}
            />
          </div>

          {/* Color palette */}
          <div className="flex justify-center gap-2 pb-4">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBgColor(c)}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: bgColor === c ? "white" : "transparent",
                }}
              />
            ))}
          </div>

          <div className="p-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}>
            <button
              type="button"
              onClick={handleTextPost}
              disabled={!textContent.trim() || posting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 py-3 font-semibold text-white disabled:opacity-40 hover:bg-white/30 transition-colors"
            >
              {posting ? "Posting..." : "Post status"}
            </button>
          </div>
        </div>
      )}

      {/* Viewer list modal */}
      {showViewerList && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setShowViewerList(false)}>
          <div
            className="w-full max-h-[60vh] overflow-y-auto rounded-t-2xl p-4 border-t"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: "var(--text-main)" }}>Viewed by {viewerList.length}</h3>
              <button type="button" onClick={() => setShowViewerList(false)} style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            {viewerList.length === 0 && (
              <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No views yet</p>
            )}
            {viewerList.map((v, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Avatar
                  src={v.viewer?.avatar_url}
                  name={v.viewer?.display_name ?? "?"}
                  size="sm"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>{v.viewer?.display_name}</p>
                </div>
                {v.reaction_emoji && (
                  <span className="text-xl">{v.reaction_emoji}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Story viewer */}
      {viewerStories && (
        <StoryViewer
          stories={viewerStories}
          onClose={() => setViewerStories(null)}
          onView={markViewed}
        />
      )}

      {/* FABs — positioned above mobile bottom bar */}
      <div
        className="fixed bottom-20 md:bottom-6 right-6 flex flex-col items-end gap-3 z-20"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handlePhotoUpload} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={posting}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-subtle)" }}
          title="Photo status"
        >
          <Camera className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowTextForm(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105"
          style={{ backgroundColor: "var(--color-primary)" }}
          title="Text status"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
