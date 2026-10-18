import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Camera, Check, CircleDot, Clock3, Eye, ImagePlus, Loader2, Plus, RefreshCw, Send, Trash2, Type, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import { useStories } from "../hooks/useStories";
import { Avatar } from "../components/ui/Avatar";
import { StoryViewer } from "../components/stories/StoryViewer";
import { messagesApi } from "../lib/api";
import type { StatusStory } from "../types/database";

const BG_COLORS = ["#165d74", "#344c8a", "#755196", "#af4567", "#95632e", "#2b715c", "#334155", "#111827"];
type Viewer = { viewed_at: string; reaction_emoji: string | null; viewer: { id: string; display_name: string; avatar_url: string | null } | null };

export function StatusPage() {
  const { user, profile } = useAuth();
  const { myStories, stories, loading, error, postStory, markViewed, getViewers, deleteStory, reload } = useStories();
  const [viewerStories, setViewerStories] = useState<StatusStory[] | null>(null);
  const [showComposer, setShowComposer] = useState(() => new URLSearchParams(window.location.search).get("create") === "1");
  const [textContent, setTextContent] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]!);
  const [posting, setPosting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [viewerList, setViewerList] = useState<Viewer[]>([]);
  const [viewersFor, setViewersFor] = useState<string | null>(null);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !posting) { setShowComposer(false); setViewersFor(null); setDeleteId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [posting]);

  const grouped = Object.values(stories.reduce<Record<string, StatusStory[]>>((groups, story) => {
    (groups[story.user_id] ||= []).push(story); return groups;
  }, {}));
  const recent = grouped.filter(group => group.some(story => !story.viewed));
  const viewed = grouped.filter(group => group.every(story => story.viewed));
  const openComposer = () => { setFile(null); setTextContent(""); setActionError(""); setShowComposer(true); };
  const chooseMedia = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!selected.type.startsWith("image/") && !selected.type.startsWith("video/")) { setActionError("Choose an image or video."); return; }
    if (selected.size > 50 * 1024 * 1024) { setActionError("Choose a file smaller than 50 MB."); return; }
    setFile(selected); setActionError(""); setShowComposer(true);
  };
  const publish = async () => {
    if (posting || (!file && !textContent.trim()) || !user) return;
    setPosting(true); setActionError("");
    try {
      if (file) {
        const url = await messagesApi.uploadMedia(file, file.name);
        if (!url) throw new Error("Upload failed. Please try again.");
        await postStory({ media_type: file.type.startsWith("video/") ? "video" : "photo", media_url: url });
      } else await postStory({ media_type: "text", text_content: textContent.trim(), background_color: bgColor });
      setShowComposer(false); setFile(null); setTextContent(""); setFeedback("Your status is live for 24 hours.");
    } catch (error) { setActionError(error instanceof Error ? error.message : "Could not publish your status."); }
    finally { setPosting(false); }
  };
  const showViewers = async (id: string) => {
    setViewersFor(id); setViewerList([]); setViewersError(""); setViewersLoading(true);
    try { setViewerList(await getViewers(id)); }
    catch { setViewersError("Could not load views. Close this panel and try again."); }
    finally { setViewersLoading(false); }
  };
  const removeStory = async () => {
    if (!deleteId || posting) return;
    setPosting(true);
    try { await deleteStory(deleteId); setDeleteId(null); setFeedback("Status deleted."); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Could not delete status."); }
    finally { setPosting(false); }
  };
  const renderGroup = (group: StatusStory[]) => {
    const latest = group[0]!;
    const unseen = group.some(story => !story.viewed);
    return <button key={latest.user_id} className="status-person" onClick={() => setViewerStories(group)}>
      <Avatar src={latest.profile?.avatar_url} name={latest.profile?.display_name || "Contact"} size="lg" storyUnseen={unseen} />
      <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{latest.profile?.display_name || "Contact"}</span><span className="mt-1 block text-xs text-muted">{formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })} &middot; {group.length} {group.length === 1 ? "update" : "updates"}</span></span>
      {unseen ? <span className="status-new-dot" /> : <Check size={16} className="text-muted" />}<ArrowUpRight size={16} className="text-muted" />
    </button>;
  };

  return <div className="status-page">
    <header className="status-header">
      <Link to="/" aria-label="Back to chats" className="md:hidden status-icon-button"><ArrowLeft size={20} /></Link>
      <span className="status-header-icon"><CircleDot size={22} /></span>
      <div className="flex-1"><h1 className="text-lg font-semibold tracking-tight">Status</h1><p className="text-xs text-muted">Little moments. Closer connections.</p></div>
      <button aria-label="Refresh statuses" onClick={reload} className="status-icon-button"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
      <button onClick={openComposer} className="status-primary-button"><Plus size={17} /><span className="hidden sm:inline">Create status</span><span className="sm:hidden">Create</span></button>
    </header>
    <div className="status-scroll">
      <div className="status-container">
        {feedback && <div role="status" className="status-success"><Check size={16} />{feedback}</div>}
        {(error || (actionError && !showComposer)) && <div role="alert" className="status-error">{error || actionError}<button onClick={() => { setActionError(""); reload(); }}>Retry</button></div>}
        <section className="status-hero">
          <div className="status-eyebrow"><span className="status-new-dot" /> YOUR DAILY SPACE</div>
          <h2>Share a moment.</h2><p>A thought, a photo, a glimpse of your day.<br className="hidden sm:block" /> Updates disappear after 24 hours.</p>
          <div className="flex flex-wrap gap-3 mt-6"><button className="status-primary-button" onClick={openComposer}><Type size={17} />Write an update</button><button className="status-secondary-button" onClick={() => fileInputRef.current?.click()} disabled={posting}><ImagePlus size={17} />Photo or video</button></div>
          <div className="status-hero-decoration" aria-hidden="true"><CircleDot /><span /><span /></div>
        </section>
        <section className="status-mine">
          <button onClick={() => myStories.length ? setViewerStories(myStories) : openComposer()} className="flex items-center gap-3 min-w-0 text-left flex-1">
            <span className="relative"><Avatar src={profile?.avatar_url} name={profile?.display_name || "You"} size="lg" storyUnseen={myStories.length > 0} /><span className="status-avatar-plus"><Plus size={11} /></span></span>
            <span><span className="block text-sm font-semibold">My status</span><span className="text-xs text-muted">{myStories.length ? `${myStories.length} active ${myStories.length === 1 ? "update" : "updates"}` : "Your story starts here"}</span></span>
          </button>
          <span className="status-expiry"><Clock3 size={13} />24 hours</span>
        </section>
        {myStories.length > 0 && <div className="status-own-grid">{myStories.map(story => <article key={story.id} className="status-own-card">
          <button className="status-thumbnail" style={{ backgroundColor: story.background_color || "var(--bg-card)" }} onClick={() => setViewerStories([story])} aria-label="View your status">
            {story.media_type === "text" ? <span>{story.text_content}</span> : story.media_type === "video" ? <video src={story.media_url || undefined} muted preload="metadata" /> : <img src={story.media_url || undefined} alt="Your status" />}
          </button>
          <div className="flex items-center justify-between px-3 py-2"><button className="inline-flex items-center gap-1.5 text-xs text-muted" onClick={() => showViewers(story.id)}><Eye size={14} />Views</button><button aria-label="Delete status" className="status-icon-button" onClick={() => setDeleteId(story.id)}><Trash2 size={14} /></button></div>
        </article>)}</div>}
        {loading && !stories.length && !myStories.length ? <div className="status-loading" role="status"><Loader2 className="animate-spin" size={22} />Loading updates...</div> : <>
          {recent.length > 0 && <section className="status-group"><div className="status-section-label"><h2>Recent updates</h2><span>{recent.length} new</span></div><div className="status-people">{recent.map(renderGroup)}</div></section>}
          {viewed.length > 0 && <section className="status-group"><div className="status-section-label"><h2>Already seen</h2><Check size={14} /></div><div className="status-people">{viewed.map(renderGroup)}</div></section>}
          {!grouped.length && !error && <section className="status-empty"><span><Camera size={24} /></span><h3>Make room for everyday moments</h3><p>Your contacts' updates will appear here.<br />Share something to get the conversation started.</p><button onClick={() => fileInputRef.current?.click()} className="status-text-button">Share your first photo <ArrowUpRight size={14} /></button></section>}
        </>}
        <p className="status-footer"><Clock3 size={12} />A fresh start, every 24 hours</p>
      </div>
    </div>
    <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={chooseMedia} />
    {showComposer && <div className="status-modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="status-composer-title" className="status-composer">
      <header><div><h2 id="status-composer-title">Create a status</h2><p>Share a moment for the next 24 hours</p></div><button disabled={posting} aria-label="Close composer" className="status-icon-button" onClick={() => setShowComposer(false)}><X size={20} /></button></header>
      <div className="status-compose-preview" style={{ backgroundColor: file ? "#111827" : bgColor }}>
        {file ? file.type.startsWith("video/") ? <video src={preview} controls playsInline /> : <img src={preview} alt="Preview before publishing" /> : <textarea autoFocus value={textContent} maxLength={700} onChange={event => setTextContent(event.target.value)} placeholder="What's on your mind?" aria-label="Status text" />}
      </div>
      {!file && <div className="status-palette">{BG_COLORS.map((color, index) => <button key={color} aria-label={`Background color ${index + 1}`} aria-pressed={bgColor === color} onClick={() => setBgColor(color)} style={{ backgroundColor: color }} className={bgColor === color ? "selected" : ""}>{bgColor === color && <Check size={14} />}</button>)}<span>{textContent.length}/700</span></div>}
      {actionError && <div className="status-error mx-5" role="alert">{actionError}</div>}
      <footer><button disabled={posting} className="status-secondary-button" onClick={() => fileInputRef.current?.click()}><ImagePlus size={16} />{file ? "Change media" : "Add media"}</button><button disabled={posting || (!file && !textContent.trim())} className="status-primary-button" onClick={publish}>{posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{posting ? "Publishing..." : "Publish status"}</button></footer>
    </section></div>}
    {viewersFor && <div className="status-modal-backdrop" onClick={() => setViewersFor(null)}><section role="dialog" aria-modal="true" aria-labelledby="status-views-title" className="status-dialog" onClick={event => event.stopPropagation()}><header><h2 id="status-views-title">Status views</h2><button aria-label="Close viewers" onClick={() => setViewersFor(null)} className="status-icon-button"><X size={20} /></button></header>{viewersError ? <p role="alert" className="status-error">{viewersError}</p> : viewersLoading ? <p className="status-loading"><Loader2 className="animate-spin" />Loading views...</p> : viewerList.length ? viewerList.map(view => <div key={view.viewer?.id || view.viewed_at} className="flex items-center gap-3 py-3"><Avatar src={view.viewer?.avatar_url} name={view.viewer?.display_name || "Contact"} size="sm" /><div className="flex-1"><p className="text-sm font-medium">{view.viewer?.display_name || "Contact"}</p><p className="text-xs text-muted">{formatDistanceToNow(new Date(view.viewed_at), { addSuffix: true })}</p></div>{view.reaction_emoji}</div>) : <div className="status-empty"><Eye size={24} /><h3>No views yet</h3><p>See who stops by as your contacts catch up.</p></div>}</section></div>}
    {deleteId && <div className="status-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="delete-status-title" className="status-dialog"><h2 id="delete-status-title" className="font-semibold text-lg">Delete this status?</h2><p className="text-sm text-muted mt-2 mb-6">This update will be removed from your status.</p>{actionError && <p role="alert" className="status-error">{actionError}</p>}<div className="flex justify-end gap-3"><button disabled={posting} className="status-secondary-button" onClick={() => setDeleteId(null)}>Keep status</button><button disabled={posting} className="status-primary-button" onClick={removeStory}>{posting ? "Deleting..." : "Delete status"}</button></div></section></div>}
    {viewerStories && <StoryViewer stories={viewerStories} onClose={() => setViewerStories(null)} onView={markViewed} />}
  </div>;
}
