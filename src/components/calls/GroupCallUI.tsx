import { useState } from "react";
import { Mic, MicOff, Hand, UserX, Crown } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import type { Profile } from "../../types/database";

export interface GroupParticipant {
  id: string;
  profile: Profile;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isHost?: boolean;
  stream?: MediaStream | null;
}

export function GroupCallGrid({
  participants,
  currentUserId,
  onMuteParticipant,
  onRemoveParticipant,
}: {
  participants: GroupParticipant[];
  currentUserId: string;
  onMuteParticipant?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getGridCols = () => {
    const len = participants.length;
    if (len <= 1) return "grid-cols-1";
    if (len <= 4) return "grid-cols-2";
    if (len <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className={`grid ${getGridCols()} gap-4 w-full h-full p-4`}>
      {participants.map((p) => {
        const isSelf = p.profile.id === currentUserId;

        return (
          <div
            key={p.profile.id}
            onMouseEnter={() => setHoveredId(p.profile.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="relative flex items-center justify-center bg-card/80 border border-border-subtle rounded-3xl overflow-hidden shadow-xl min-h-[200px]"
          >
            {/* Video stream or Avatar fallback */}
            {!p.isVideoOff && p.stream ? (
              <video
                ref={(el) => {
                  if (el) el.srcObject = p.stream ?? null;
                }}
                autoPlay
                playsInline
                muted={isSelf}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Avatar
                  src={p.profile.avatar_url}
                  name={p.profile.display_name}
                  presence={p.profile.presence}
                  size="lg"
                />
                <span className="text-sm font-semibold text-white">{p.profile.display_name}</span>
              </div>
            )}

            {/* Badges Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {p.isHost && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                  <Crown className="h-3 w-3" />
                  <span>Host</span>
                </span>
              )}
              {p.isHandRaised && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/30 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-200 border border-amber-500/40 animate-pulse">
                  <Hand className="h-3.5 w-3.5" />
                  <span>Raised Hand</span>
                </span>
              )}
            </div>

            {/* Mute status bottom-right */}
            <div className="absolute bottom-3 right-3 rounded-full bg-black/60 p-2 backdrop-blur-md">
              {p.isMuted ? (
                <MicOff className="h-4 w-4 text-red-400" />
              ) : (
                <Mic className="h-4 w-4 text-emerald-400" />
              )}
            </div>

            {/* Name tag bottom-left */}
            <div className="absolute bottom-3 left-3 rounded-xl bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md border border-white/10">
              {p.profile.display_name} {isSelf && "(You)"}
            </div>

            {/* Host Controls Hover Overlay */}
            {!isSelf && hoveredId === p.profile.id && (onMuteParticipant || onRemoveParticipant) && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center gap-4 transition-opacity">
                {onMuteParticipant && (
                  <button
                    type="button"
                    onClick={() => onMuteParticipant(p.profile.id)}
                    className="flex flex-col items-center gap-1 text-white hover:text-red-400 transition-colors"
                  >
                    <div className="p-3 rounded-full bg-white/10 hover:bg-white/20">
                      <MicOff className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium">Mute</span>
                  </button>
                )}
                {onRemoveParticipant && (
                  <button
                    type="button"
                    onClick={() => onRemoveParticipant(p.profile.id)}
                    className="flex flex-col items-center gap-1 text-white hover:text-red-400 transition-colors"
                  >
                    <div className="p-3 rounded-full bg-red-600/30 text-red-400 hover:bg-red-600 hover:text-white">
                      <UserX className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium">Remove</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
