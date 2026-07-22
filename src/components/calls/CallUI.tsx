import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff } from "lucide-react";
import type { Call } from "../../types/database";

// ─── Incoming call screen ─────────────────────────────────────────────────────

interface IncomingCallScreenProps {
  call: Call;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallScreen({ call, callerName, onAccept, onDecline }: IncomingCallScreenProps) {
  const [ring, setRing] = useState(0);

  // Animated ring pulse
  useEffect(() => {
    const t = setInterval(() => setRing((r) => (r + 1) % 3), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#111b21]/95 backdrop-blur-sm py-16">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {call.type === "video" ? "Incoming video call" : "Incoming voice call"}
        </p>
        <h2 className="text-3xl font-semibold text-white">{callerName}</h2>

        {/* Pulsing rings */}
        <div className="relative mt-4 flex h-32 w-32 items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border border-[#25D366] transition-all duration-700"
              style={{
                width: `${80 + i * 24}px`,
                height: `${80 + i * 24}px`,
                opacity: ring === i ? 0.6 : 0.15,
              }}
            />
          ))}
          <div className="h-20 w-20 rounded-full bg-[#25D366]/20 flex items-center justify-center">
            {call.type === "video" ? (
              <Video className="h-8 w-8 text-[#25D366]" />
            ) : (
              <Phone className="h-8 w-8 text-[#25D366]" />
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-16">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="h-7 w-7" />
          </button>
          <span className="text-xs text-zinc-400">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#1da855] transition-colors animate-bounce"
          >
            {call.type === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
          </button>
          <span className="text-xs text-zinc-400">Accept</span>
        </div>
      </div>
    </div>
  );
}

// ─── Active call overlay ──────────────────────────────────────────────────────

interface ActiveCallOverlayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEnd: () => void;
  isVideo: boolean;
  callerName?: string;
  duration?: Date;
}

export function ActiveCallOverlay({
  localStream, remoteStream, isMuted, isVideoOff,
  onToggleMute, onToggleVideo, onEnd, isVideo, callerName, duration,
}: ActiveCallOverlayProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState("0:00");

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  // Call duration timer
  useEffect(() => {
    if (!duration) return;
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - duration.getTime()) / 1000);
      const m = Math.floor(secs / 60);
      const s = String(secs % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(t);
  }, [duration]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b141a]">
      {/* Video area */}
      <div className="relative flex-1 bg-black">
        {isVideo && remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-4">
            <div className="h-32 w-32 rounded-full bg-zinc-800 flex items-center justify-center text-5xl">
              {callerName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <p className="text-xl font-medium text-white">{callerName}</p>
            <p className="text-sm text-zinc-500">{elapsed}</p>
          </div>
        )}

        {/* Local video PiP */}
        {isVideo && localStream && !isVideoOff && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-36 w-28 rounded-xl object-cover ring-2 ring-[#25D366]/30 shadow-xl"
          />
        )}

        {/* Duration overlay for video */}
        {isVideo && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1 text-sm text-white backdrop-blur-sm">
            {elapsed}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 bg-[#111b21] py-8">
        <CallButton onClick={onToggleMute} active={isMuted} danger={false} label={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </CallButton>

        {isVideo && (
          <CallButton onClick={onToggleVideo} active={isVideoOff} danger={false} label={isVideoOff ? "Show cam" : "Hide cam"}>
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </CallButton>
        )}

        <CallButton onClick={onEnd} active danger label="End call">
          <PhoneOff className="h-7 w-7" />
        </CallButton>
      </div>
    </div>
  );
}

function CallButton({
  onClick, active, danger, label, children,
}: {
  onClick: () => void;
  active: boolean;
  danger: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-white transition-all hover:scale-105 ${
          danger ? "bg-red-500 hover:bg-red-600" : active ? "bg-zinc-600" : "bg-zinc-800 hover:bg-zinc-700"
        }`}
      >
        {children}
      </button>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
