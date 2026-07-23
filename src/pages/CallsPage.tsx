import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Video,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  Trash2,
  PhoneCall,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCallingContext } from "../contexts/CallingContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import type { Call, Profile } from "../types/database";

interface CallEntry extends Call {
  initiator?: Profile;
  direction: "outgoing" | "incoming";
}

function formatDuration(secs: number | null) {
  if (!secs || secs <= 0) return null;
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

type FilterTab = "all" | "missed" | "voice" | "video";

export function CallsPage() {
  const { user } = useAuth();
  const { startCall } = useCallingContext();
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const loadCalls = async () => {
    if (!user) return;
    setLoading(true);

    const { data: initiated } = await supabase
      .from("calls")
      .select("*, initiator:profiles!initiator_id(id, display_name, avatar_url, presence)")
      .eq("initiator_id", user.id)
      .order("started_at", { ascending: false })
      .limit(100);

    const { data: participated } = await supabase
      .from("call_participants")
      .select("call:calls(*, initiator:profiles!initiator_id(id, display_name, avatar_url, presence))")
      .eq("user_id", user.id)
      .limit(100);

    const inbound = (participated ?? [])
      .map((p) => (p as any).call)
      .filter((c) => c && c.initiator_id !== user.id)
      .map((c) => ({ ...(c as object), direction: "incoming" as const }));

    const outbound = (initiated ?? []).map((c) => ({
      ...(c as object),
      direction: "outgoing" as const,
    }));

    const all = [...outbound, ...inbound].sort(
      (a: any, b: any) => new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime(),
    );

    setCalls(all as CallEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    loadCalls();
  }, [user]);

  const handleDeleteCall = async (callId: string) => {
    if (!confirm("Remove this call log from history?")) return;
    await supabase.from("calls").delete().eq("id", callId);
    setCalls((prev) => prev.filter((c) => c.id !== callId));
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear all call history?")) return;
    if (!user) return;
    await supabase.from("calls").delete().eq("initiator_id", user.id);
    setCalls([]);
  };

  const filteredCalls = calls.filter((c) => {
    const callerName = c.initiator?.display_name?.toLowerCase() || "";
    const matchesSearch = callerName.includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "missed") return c.status === "missed";
    if (activeTab === "voice") return c.type === "voice";
    if (activeTab === "video") return c.type === "video";
    return true;
  });

  const StatusIcon = ({ call }: { call: CallEntry }) => {
    if (call.status === "missed") return <PhoneMissed className="h-4 w-4 text-red-400" />;
    if (call.status === "declined") return <PhoneOffIcon className="h-4 w-4 text-red-400" />;
    if (call.direction === "incoming") return <PhoneIncoming className="h-4 w-4 text-emerald-400" />;
    return <PhoneOutgoing className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="flex h-screen flex-col bg-background text-main overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between bg-surface/90 backdrop-blur-xl px-5 py-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="md:hidden text-muted hover:text-main transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-main">Call History</h1>
        </div>

        {calls.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear History</span>
          </button>
        )}
      </header>

      {/* Search & Tabs */}
      <div className="px-4 pt-4 pb-2 border-b border-border-subtle bg-surface/50 shrink-0 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calls by name..."
            className="w-full rounded-2xl bg-card border border-border-subtle py-2.5 pl-11 pr-4 text-sm text-main outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["all", "missed", "voice", "video"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-card text-muted hover:text-main hover:bg-surface border border-border-subtle"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
        {loading && <p className="py-12 text-center text-sm text-muted">Loading call history...</p>}

        {!loading && filteredCalls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-muted space-y-3">
            <div className="h-16 w-16 rounded-full bg-card border border-border-subtle flex items-center justify-center">
              <PhoneCall className="h-8 w-8 text-primary/60" />
            </div>
            <p className="text-sm font-medium">No calls found</p>
            <p className="text-xs opacity-70">Calls made or received will appear here</p>
          </div>
        )}

        {filteredCalls.map((call) => (
          <div
            key={call.id}
            className="group flex items-center gap-3.5 rounded-2xl bg-card/60 hover:bg-card border border-border-subtle/50 px-4 py-3.5 transition-all"
          >
            <Avatar
              src={call.initiator?.avatar_url}
              name={call.initiator?.display_name ?? "Unknown"}
              presence={call.initiator?.presence}
              showRing
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-main text-sm">
                {call.initiator?.display_name ?? "Unknown"}
              </p>

              <div className="flex items-center gap-2 text-xs text-muted mt-1">
                <StatusIcon call={call} />
                <span
                  className={
                    call.status === "missed"
                      ? "text-red-400 font-medium"
                      : call.status === "declined"
                      ? "text-amber-400 font-medium"
                      : "text-main"
                  }
                >
                  {call.status === "missed"
                    ? "Missed Call"
                    : call.status === "declined"
                    ? "Declined"
                    : call.direction === "incoming"
                    ? "Incoming"
                    : "Outgoing"}
                </span>

                {/* Duration shown only if call was actually connected */}
                {call.duration_seconds && call.duration_seconds > 0 ? (
                  <>
                    <span>·</span>
                    <span className="font-mono text-emerald-400">
                      {formatDuration(call.duration_seconds)}
                    </span>
                  </>
                ) : null}

                <span>·</span>
                <span>
                  {call.started_at
                    ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true })
                    : "Recently"}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {call.conversation_id && (
                <button
                  type="button"
                  onClick={() => {
                    startCall(call.conversation_id!, call.type, call.initiator);
                  }}
                  className="rounded-full p-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                  title={`Call back (${call.type})`}
                >
                  {call.type === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteCall(call.id)}
                className="opacity-0 group-hover:opacity-100 rounded-full p-2 text-muted hover:text-red-400 hover:bg-surface transition-all"
                title="Delete log"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneOffIcon(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.28 3H5z" />
    </svg>
  );
}
