import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Calendar, Clock, Users, Video, X, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, isPast, isFuture } from "date-fns";
import type { Meeting } from "../types/database";

function useMeetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .or(`host_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: true });
    setMeetings((data as Meeting[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  return { meetings, loading, reload: load };
}

export function MeetingsPage() {
  const { user } = useAuth();
  const { meetings, loading, reload } = useMeetings();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const upcoming = meetings.filter((m) => m.status !== "cancelled" && isFuture(new Date(m.scheduled_at)));
  const past = meetings.filter((m) => m.status !== "cancelled" && isPast(new Date(m.scheduled_at)));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !scheduledAt) return;
    setCreating(true);

    await supabase.from("meetings").insert({
      host_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_at: scheduledAt,
      waiting_room_enabled: waitingRoom,
      status: "scheduled",
    });

    setTitle("");
    setDescription("");
    setScheduledAt("");
    setShowForm(false);
    setCreating(false);
    reload();
  };

  const cancelMeeting = async (id: string) => {
    await supabase.from("meetings").update({ status: "cancelled" }).eq("id", id);
    reload();
  };

  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/meet/${link}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const MeetingCard = ({ meeting }: { meeting: Meeting }) => (
    <div className="rounded-xl border border-zinc-800 bg-[#111b21] p-4 transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="truncate font-semibold text-white">{meeting.title}</h3>
          {meeting.description && (
            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{meeting.description}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          meeting.status === "live"
            ? "bg-red-500/20 text-red-400"
            : meeting.status === "ended"
            ? "bg-zinc-800 text-zinc-500"
            : "bg-[#1E88C7]/20 text-[#1E88C7]"
        }`}>
          {meeting.status === "live" ? "● LIVE" : meeting.status.toUpperCase()}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(meeting.scheduled_at), "MMM d, yyyy")}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {format(new Date(meeting.scheduled_at), "h:mm a")}
        </span>
        {meeting.waiting_room_enabled && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Waiting room
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {meeting.status !== "ended" && meeting.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => copyLink(meeting.join_link, meeting.id)}
            className="flex items-center gap-1.5 rounded-lg bg-[#1E88C7]/20 px-3 py-1.5 text-xs font-medium text-[#1E88C7] hover:bg-[#1E88C7]/30 transition-colors"
          >
            {copiedId === meeting.id ? <Check className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            {copiedId === meeting.id ? "Copied!" : "Copy join link"}
          </button>
        )}
        {meeting.host_id === user?.id && meeting.status === "scheduled" && (
          <button
            type="button"
            onClick={() => cancelMeeting(meeting.id)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:border-red-500 hover:text-red-400 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white">
      <header className="flex items-center gap-4 bg-[#111b21] px-4 py-3">
        <Link to="/" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 font-semibold text-lg">Meetings</h1>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#1E88C7] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1971A5] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Schedule
        </button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Loading meetings...</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Upcoming
                </h2>
                <div className="space-y-3">
                  {upcoming.map((m) => <MeetingCard key={m.id} meeting={m} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Past
                </h2>
                <div className="space-y-3">
                  {past.slice(0, 5).map((m) => <MeetingCard key={m.id} meeting={m} />)}
                </div>
              </section>
            )}

            {upcoming.length === 0 && past.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Calendar className="mb-4 h-12 w-12 opacity-30" />
                <p className="text-sm">No meetings yet</p>
                <p className="mt-1 text-xs opacity-70">Schedule one to get started</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Schedule form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111b21] shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="font-semibold text-white">Schedule Meeting</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Meeting title *</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Weekly sync, Design review..."
                  className="mt-1 w-full rounded-lg bg-[#202c33] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-[#1E88C7]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Description (optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Agenda, notes..."
                  className="mt-1 w-full rounded-lg bg-[#202c33] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 resize-none focus:ring-1 focus:ring-[#1E88C7]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Date & Time *</span>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-1 w-full rounded-lg bg-[#202c33] px-4 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:ring-1 focus:ring-[#1E88C7]"
                />
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative h-6 w-10 rounded-full transition-colors ${waitingRoom ? "bg-[#1E88C7]" : "bg-zinc-700"}`}
                  onClick={() => setWaitingRoom((v) => !v)}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${waitingRoom ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-sm text-zinc-300">Waiting room</span>
              </label>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !title.trim() || !scheduledAt}
                  className="flex-1 rounded-xl bg-[#1E88C7] py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#1971A5] transition-colors"
                >
                  {creating ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
