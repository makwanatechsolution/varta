import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff } from "lucide-react";
import type { Call } from "../../types/database";
import { motion } from "framer-motion";

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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 backdrop-blur-3xl py-20"
    >
      <div className="flex flex-col items-center gap-4 mt-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {call.type === "video" ? "Incoming video call" : "Incoming voice call"}
        </p>
        <h2 className="text-4xl font-light tracking-tight text-main">{callerName}</h2>

        {/* Pulsing rings */}
        <div className="relative mt-12 flex h-32 w-32 items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border border-primary transition-all duration-700 ease-out"
              style={{
                width: `${80 + i * 40}px`,
                height: `${80 + i * 40}px`,
                opacity: ring === i ? 0.4 : 0.05,
              }}
            />
          ))}
          <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center shadow-lg shadow-primary/20 backdrop-blur-sm">
            {call.type === "video" ? (
              <Video className="h-8 w-8 text-primary" />
            ) : (
              <Phone className="h-8 w-8 text-primary" />
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-20 mb-10">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-error text-white shadow-xl shadow-error/20 hover:scale-110 active:scale-95 transition-all"
          >
            <PhoneOff className="h-7 w-7" />
          </button>
          <span className="text-sm font-medium text-muted">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-white shadow-xl shadow-success/20 hover:scale-110 active:scale-95 transition-all animate-bounce"
          >
            {call.type === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
          </button>
          <span className="text-sm font-medium text-muted">Accept</span>
        </div>
      </div>
    </motion.div>
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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col bg-background/90 backdrop-blur-3xl overflow-hidden"
    >
      {/* Video area */}
      <div className="relative flex-1 bg-black/40 rounded-b-[40px] shadow-2xl overflow-hidden m-2 border border-border-subtle">
        {isVideo && remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-6">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <div className="relative h-36 w-36 rounded-full bg-gradient-to-br from-surface to-card border border-border-subtle flex items-center justify-center text-5xl font-light text-main shadow-2xl">
                {callerName?.[0]?.toUpperCase() ?? "?"}
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-light tracking-wide text-main mb-2">{callerName}</p>
              <p className="text-lg font-mono tracking-widest text-primary">{elapsed}</p>
            </div>
          </div>
        )}

        {/* Local video PiP */}
        {isVideo && localStream && !isVideoOff && (
          <motion.div
            initial={{ opacity: 0, x: 20, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            className="absolute bottom-6 right-6 h-48 w-32 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover bg-black"
            />
          </motion.div>
        )}

        {/* Duration overlay for video */}
        {isVideo && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-6 py-2 text-sm font-mono tracking-widest text-white backdrop-blur-md border border-white/10 shadow-lg">
            {elapsed}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-8 py-8 px-6 pb-12">
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
    </motion.div>
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
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition-all shadow-lg hover:scale-110 active:scale-95 ${
          danger 
            ? "bg-error shadow-error/30 hover:bg-red-600" 
            : active 
              ? "bg-surface border border-border-subtle text-main" 
              : "bg-surface/50 border border-border-subtle text-muted hover:bg-surface hover:text-main"
        }`}
      >
        {children}
      </button>
      <span className="text-[11px] font-medium tracking-wide text-muted">{label}</span>
    </div>
  );
}
