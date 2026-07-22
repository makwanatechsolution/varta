import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { StatusStory } from "../../types/database";
import { Avatar } from "../ui/Avatar";
import { formatDistanceToNow } from "date-fns";

// ─── StoryViewer ──────────────────────────────────────────────────────────────

interface StoryViewerProps {
  stories: StatusStory[];
  initialIndex?: number;
  onClose: () => void;
  onView: (id: string) => void;
}

const STORY_DURATION_MS = 5000;

export function StoryViewer({ stories, initialIndex = 0, onClose, onView }: StoryViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  const story = stories[index];

  // Auto-advance timer
  useEffect(() => {
    if (!story) return;
    onView(story.id);
    setProgress(0);

    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / STORY_DURATION_MS) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        advance();
      }
    };

    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const advance = () => {
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  };

  const goBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Progress bars */}
      <div className="flex gap-1 p-2 pt-safe">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
            <div
              className="h-full bg-white transition-none"
              style={{
                width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2">
        <Avatar src={story.profile?.avatar_url} name={story.profile?.display_name ?? "?"} size="sm" />
        <div>
          <span className="text-sm font-semibold text-white">{story.profile?.display_name}</span>
          <p className="text-xs text-white/60">
            {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
          </p>
        </div>
        <button type="button" onClick={onClose} className="ml-auto text-white/80 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Back zone */}
        <button type="button" className="absolute left-0 z-10 h-full w-1/3" onClick={goBack}>
          {index > 0 && <ChevronLeft className="ml-2 h-8 w-8 text-white/40" />}
        </button>

        {story.media_type === "text" ? (
          <div
            className="flex h-full w-full items-center justify-center p-10 text-center text-3xl font-bold leading-tight text-white"
            style={{ backgroundColor: story.background_color }}
          >
            {story.text_content}
          </div>
        ) : story.media_url ? (
          story.media_type === "video" ? (
            <video
              src={story.media_url}
              autoPlay
              playsInline
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <img
              src={story.media_url}
              alt="Story"
              className="max-h-full max-w-full object-contain"
            />
          )
        ) : null}

        {/* Forward zone */}
        <button type="button" className="absolute right-0 z-10 h-full w-1/3 flex items-center justify-end" onClick={advance}>
          <ChevronRight className="mr-2 h-8 w-8 text-white/40" />
        </button>
      </div>
    </div>
  );
}

// ─── StoryBar ─────────────────────────────────────────────────────────────────

interface StoryBarProps {
  myStories: StatusStory[];
  contactStories: StatusStory[];
  /** Called with the flat list of stories for that user */
  onOpenStory: (stories: StatusStory[]) => void;
  onAddStory: () => void;
}

export function StoryBar({ myStories, contactStories, onOpenStory, onAddStory }: StoryBarProps) {
  const grouped = contactStories.reduce<Record<string, StatusStory[]>>((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = [];
    acc[s.user_id].push(s);
    return acc;
  }, {});

  if (myStories.length === 0 && contactStories.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto border-b border-zinc-800 px-4 py-3 scrollbar-hide">
      {/* My story bubble */}
      <button type="button" onClick={myStories.length > 0 ? () => onOpenStory(myStories) : onAddStory} className="flex shrink-0 flex-col items-center gap-1">
        <Avatar
          name="You"
          size="lg"
          storyUnseen={myStories.length > 0}
          onClick={() => {}}
        />
        <span className="text-xs text-zinc-400 max-w-[56px] truncate">My story</span>
      </button>

      {Object.entries(grouped).map(([userId, userStories]) => {
        const unseen = userStories.some((s) => !s.viewed);
        return (
          <button
            key={userId}
            type="button"
            onClick={() => onOpenStory(userStories)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <Avatar
              src={userStories[0]?.profile?.avatar_url}
              name={userStories[0]?.profile?.display_name ?? "?"}
              size="lg"
              storyUnseen={unseen}
            />
            <span className="max-w-[56px] truncate text-xs text-zinc-400">
              {userStories[0]?.profile?.display_name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
