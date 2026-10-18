import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { StatusStory } from "../../types/database";
import { Avatar } from "../ui/Avatar";
import { formatDistanceToNow } from "date-fns";

interface StoryViewerProps {
  stories: StatusStory[];
  initialIndex?: number;
  onClose: () => void;
  onView: (id: string) => void;
}

export function StoryViewer({ stories, initialIndex = 0, onClose, onView }: StoryViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(5000);
  const [mediaError, setMediaError] = useState(false);
  const elapsed = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const viewCallback = useRef(onView);
  viewCallback.current = onView;
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const story = stories[index];
  const advance = () => { if (index < stories.length - 1) setIndex(index + 1); else closeCallback.current(); };
  const goBack = () => { if (index > 0) setIndex(index - 1); };

  useEffect(() => {
    if (!story) return;
    elapsed.current = 0; setProgress(0); setPaused(false); setMediaError(false);
    setDuration(story.media_type === "video" ? 60000 : 5000);
    viewCallback.current(story.id);
  }, [story?.id]);

  useEffect(() => {
    if (!story || paused) return;
    let previous = performance.now();
    let raf: number;
    const tick = (now: number) => {
      elapsed.current += now - previous;
      previous = now;
      const percent = Math.min(elapsed.current / duration * 100, 100);
      setProgress(percent);
      if (percent < 100) raf = requestAnimationFrame(tick);
      else advance();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused, duration]);

  useEffect(() => {
    if (!video.current) return;
    if (paused) video.current.pause();
    else video.current.play().catch(() => setPaused(true));
  }, [paused, story?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCallback.current();
      if (event.key === "ArrowRight") advance();
      if (event.key === "ArrowLeft") goBack();
      if (event.code === "Space") { event.preventDefault(); setPaused(value => !value); }
    };
    const visibility = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", visibility); };
  }, [index, stories.length]);

  if (!story) return null;
  return <div role="dialog" aria-modal="true" aria-label="Status viewer" className="fixed inset-0 z-[70] flex flex-col bg-[#070d12]">
    <div className="w-full max-w-3xl mx-auto flex flex-1 min-h-0 flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex gap-1 px-4 pt-4" aria-hidden="true">{stories.map((item, position) => <div key={item.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-white" style={{ width: position < index ? "100%" : position === index ? `${progress}%` : "0%" }} /></div>)}</div>
      <header className="flex items-center gap-3 p-4">
        <Avatar src={story.profile?.avatar_url} name={story.profile?.display_name || "You"} size="sm" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{story.profile?.display_name || "Your status"}</p><p className="mt-1 text-xs text-white/50">{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</p></div>
        <button aria-label={paused ? "Play status" : "Pause status"} onClick={() => setPaused(value => !value)} className="p-2 text-white/80">{paused ? <Play size={20} /> : <Pause size={20} />}</button>
        <button aria-label="Close status" onClick={onClose} className="p-2 text-white/80"><X size={22} /></button>
      </header>
      <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden md:rounded-2xl md:mb-6">
        <button aria-label="Previous status" disabled={index === 0} className="absolute left-0 z-10 h-full w-1/4 flex items-center disabled:opacity-0" onClick={goBack}><ChevronLeft className="ml-3 h-7 w-7 text-white/40" /></button>
        {mediaError ? <p role="alert" className="p-8 text-sm text-white/70">This media could not load. Try opening the status again.</p> : story.media_type === "text" ? <div className="flex h-full w-full items-center justify-center p-10 text-center text-3xl font-semibold leading-relaxed text-white whitespace-pre-wrap break-words" style={{ backgroundColor: story.background_color || "#165d74" }}>{story.text_content}</div> : story.media_url ? story.media_type === "video" ? <video key={story.id} ref={video} src={story.media_url} autoPlay playsInline onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration * 1000); }} onEnded={advance} onError={() => setMediaError(true)} className="max-h-full max-w-full object-contain" /> : <img src={story.media_url} alt="Status update" onError={() => setMediaError(true)} className="max-h-full max-w-full object-contain" /> : null}
        <button aria-label="Next status" className="absolute right-0 z-10 h-full w-1/4 flex items-center justify-end" onClick={advance}><ChevronRight className="mr-3 h-7 w-7 text-white/40" /></button>
      </div>
    </div>
  </div>;
}

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
