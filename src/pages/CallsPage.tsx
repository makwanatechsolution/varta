import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import type { Call, Profile } from "../types/database";

interface CallEntry extends Call {
  initiator?: Profile;
  direction: "outgoing" | "incoming";
}

function formatDuration(secs: number | null) {
  if (!secs) return null;
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function CallsPage() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // Get calls where I'm the initiator
      const { data: initiated } = await supabase
        .from("calls")
        .select("*, initiator:profiles!initiator_id(id, display_name, avatar_url, presence)")
        .eq("initiator_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);

      // Get calls where I'm a participant (incoming)
      const { data: participated } = await supabase
        .from("call_participants")
        .select("call:calls(*, initiator:profiles!initiator_id(id, display_name, avatar_url, presence))")
        .eq("user_id", user.id)
        .limit(50);

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
    load();
  }, [user]);

  const StatusIcon = ({ call }: { call: CallEntry }) => {
    if (call.status === "missed") return <PhoneMissed className="h-4 w-4 text-red-400" />;
    if (call.direction === "incoming") return <PhoneIncoming className="h-4 w-4 text-[#25D366]" />;
    return <PhoneOutgoing className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white">
      <header className="flex items-center gap-4 bg-[#111b21] px-4 py-3">
        <Link to="/" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold text-lg">Calls</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="py-8 text-center text-sm text-zinc-500">Loading call history...</p>}
        {!loading && calls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Phone className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-sm">No calls yet</p>
            <p className="mt-1 text-xs opacity-70">Start a call from any chat</p>
          </div>
        )}

        {calls.map((call) => (
          <div
            key={call.id}
            className="flex items-center gap-3 border-b border-zinc-800/50 px-4 py-3 hover:bg-[#111b21]"
          >
            <Avatar
              src={call.initiator?.avatar_url}
              name={call.initiator?.display_name ?? "Unknown"}
              presence={call.initiator?.presence}
              showRing
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{call.initiator?.display_name ?? "Unknown"}</p>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                <StatusIcon call={call} />
                <span className={call.status === "missed" ? "text-red-400" : ""}>
                  {call.status === "missed" ? "Missed" : call.direction === "incoming" ? "Incoming" : "Outgoing"}
                </span>
                {call.duration_seconds && (
                  <>
                    <span>·</span>
                    <span>{formatDuration(call.duration_seconds)}</span>
                  </>
                )}
                <span>·</span>
                <span>
                  {call.started_at
                    ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true })
                    : "Unknown time"}
                </span>
              </div>
            </div>

            {/* Call back button */}
            {call.conversation_id && (
              <Link
                to={`/chat/${call.conversation_id}`}
                state={{ startCall: call.type }}
                className={`rounded-full p-2 hover:bg-zinc-800 ${call.type === "video" ? "text-[#25D366]" : "text-[#25D366]"}`}
                title={`Call back (${call.type})`}
              >
                {call.type === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
