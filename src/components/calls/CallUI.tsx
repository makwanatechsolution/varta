import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  VolumeX,
  Monitor,
  Hand,
  Settings,
  MessageSquare,
  RefreshCw,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallingContext } from "../../contexts/CallingContext";
import type { Call } from "../../types/database";

// ─── 1. Incoming Call Modal ───────────────────────────────────────────────────
export function IncomingCallScreen({
  call,
  callerName,
  avatarUrl,
  onAccept,
  onDecline,
  isMutedRingtone,
  onToggleMuteRingtone,
}: {
  call: Call;
  callerName: string;
  avatarUrl?: string | null;
  onAccept: () => void;
  onDecline: () => void;
  isMutedRingtone: boolean;
  onToggleMuteRingtone: () => void;
}) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-3xl py-16 px-4"
    >
      {/* Mute ringtone toggle top right */}
      <div className="w-full flex justify-end px-6">
        <button
          type="button"
          onClick={onToggleMuteRingtone}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md hover:bg-white/20 transition-all"
        >
          {isMutedRingtone ? (
            <>
              <VolumeX className="h-4 w-4 text-red-400" />
              <span>Ringtone Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4 text-green-400" />
              <span>Mute Ringtone</span>
            </>
          )}
        </button>
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center gap-4 mt-6 text-center">
        <span className="rounded-full bg-primary/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary border border-primary/30">
          {call.type === "video" ? "Incoming Video Call" : "Incoming Voice Call"}
        </span>

        <h2 className="text-4xl font-light tracking-tight text-white mt-2">{callerName}</h2>
        <p className="text-sm font-medium text-white/60">Varta Encrypted Call</p>

        {/* Pulsing Ripple Rings */}
        <div className="relative mt-8 flex h-44 w-44 items-center justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border border-primary/40 transition-all duration-700 ease-out"
              style={{
                width: `${120 + i * 45}px`,
                height: `${120 + i * 45}px`,
                opacity: pulse === i ? 0.6 : 0.1,
                scale: pulse === i ? 1.05 : 0.95,
              }}
            />
          ))}

          <div className="relative h-28 w-28 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 border-2 border-primary/40 flex items-center justify-center shadow-2xl overflow-hidden backdrop-blur-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt={callerName} className="h-full w-full object-cover" />
            ) : (
              <div className="text-4xl font-light text-white">{callerName[0]?.toUpperCase()}</div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-16 mb-8 items-center">
        {/* Decline */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all"
            title="Decline Call"
          >
            <PhoneOff className="h-8 w-8" />
          </button>
          <span className="text-xs font-medium text-white/70">Decline</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all animate-bounce"
            title="Accept Call"
          >
            {call.type === "video" ? <Video className="h-8 w-8" /> : <Phone className="h-8 w-8" />}
          </button>
          <span className="text-xs font-medium text-white/70">Accept</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── 2. Outgoing Call Screen (Calling / Ringing / Connecting) ─────────────────
export function OutgoingCallScreen({
  callerName,
  avatarUrl,
  statusText,
  onCancel,
}: {
  callerName: string;
  avatarUrl?: string | null;
  statusText: string;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-3xl py-20 px-4"
    >
      <div className="flex flex-col items-center gap-4 mt-8 text-center">
        <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold tracking-widest text-primary border border-white/10">
          Varta Voice & Video
        </span>
        <h2 className="text-4xl font-light tracking-tight text-white">{callerName}</h2>

        {/* Status text — NO timer shown while calling/ringing! */}
        <div className="flex items-center gap-2 text-primary font-medium text-lg">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <span>{statusText}...</span>
        </div>

        {/* Pulsing Avatar */}
        <div className="relative mt-12 flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <div className="relative h-32 w-32 rounded-full border-2 border-primary/40 bg-card flex items-center justify-center shadow-2xl overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={callerName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-light text-white">{callerName[0]?.toUpperCase()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 mb-10">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/30 hover:scale-110 active:scale-95 transition-all"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
        <span className="text-xs font-medium text-white/70">Cancel Call</span>
      </div>
    </motion.div>
  );
}

// ─── 3. Busy Screen ───────────────────────────────────────────────────────────
export function BusyCallScreen({
  callerName,
  onCallAgain,
  onSendMessage,
  onClose,
}: {
  callerName: string;
  onCallAgain: () => void;
  onSendMessage: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4"
    >
      <div className="flex flex-col items-center text-center bg-surface border border-border-subtle rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-white p-1 rounded-full hover:bg-card"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="h-16 w-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/30">
          <PhoneOff className="h-8 w-8" />
        </div>

        <h3 className="text-2xl font-semibold text-white mb-1">{callerName} is Busy</h3>
        <p className="text-sm text-muted mb-6">User is currently on another call.</p>

        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={onCallAgain}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Call Again</span>
          </button>

          <button
            type="button"
            onClick={onSendMessage}
            className="flex items-center justify-center gap-2 rounded-2xl bg-card border border-border-subtle px-4 py-3 text-sm font-semibold text-white hover:bg-surface transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Send Message</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── 4. Active Connected Call Screen Overlay ───────────────────────────
export function ActiveCallOverlay() {
  const {
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isHandRaised,
    otherParticipant,
    connectedAt,
    callStatus,
    audioInputs,
    audioOutputs,
    selectedAudioInput,
    selectedAudioOutput,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleRaiseHand,
    setAudioInputDevice,
    setAudioOutputDevice,
    endCall,
  } = useCallingContext();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState("0:00");
  const [showSettings, setShowSettings] = useState(false);

  const isVideo = activeCall?.type === "video" || isScreenSharing;

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((e) => console.warn("Remote audio play error:", e));
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((e) => console.warn("Remote video play error:", e));
    }
  }, [remoteStream, isVideo]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.warn("Local video play error:", e));
    }
  }, [localStream, isVideoOff]);

  // Precise call timer starting strictly when connectedAt is defined
  useEffect(() => {
    if (!connectedAt) {
      setElapsed("Connecting...");
      return;
    }

    const updateTimer = () => {
      const secs = Math.max(0, Math.floor((Date.now() - connectedAt.getTime()) / 1000));
      const m = Math.floor(secs / 60);
      const s = String(secs % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-3xl overflow-hidden"
    >
      {/* Hidden Audio element for remote audio stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary">
            {otherParticipant?.display_name?.[0]?.toUpperCase() || "V"}
          </div>
          <div>
            <p className="font-semibold text-white text-base">
              {otherParticipant?.display_name || "Varta Call"}
            </p>
            <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{callStatus === "reconnecting" ? "Reconnecting..." : elapsed}</span>
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-3">
          {isHandRaised && (
            <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-3 py-1 rounded-full font-medium animate-bounce">
              <Hand className="h-3.5 w-3.5" />
              <span>Hand Raised</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            title="Audio Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Audio Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-6 z-20 w-80 rounded-2xl bg-surface border border-border-subtle p-5 shadow-2xl text-xs space-y-4"
          >
            <h4 className="font-semibold text-white text-sm border-b border-border-subtle pb-2">
              Device Settings
            </h4>

            <div>
              <label className="text-muted block mb-1 font-medium">Microphone</label>
              <select
                value={selectedAudioInput}
                onChange={(e) => setAudioInputDevice(e.target.value)}
                className="w-full rounded-xl bg-card border border-border-subtle p-2 text-white outline-none"
              >
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            {audioOutputs.length > 0 && (
              <div>
                <label className="text-muted block mb-1 font-medium">Speaker</label>
                <select
                  value={selectedAudioOutput}
                  onChange={(e) => setAudioOutputDevice(e.target.value)}
                  className="w-full rounded-xl bg-card border border-border-subtle p-2 text-white outline-none"
                >
                  {audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Speaker ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stream Display */}
      <div className="relative flex-1 bg-black/60 m-3 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center shadow-2xl">
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-6 p-6 text-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full bg-primary/20 blur-2xl animate-pulse" />
              <div className="relative h-40 w-40 rounded-full bg-gradient-to-tr from-surface to-card border border-white/10 flex items-center justify-center text-6xl font-light text-white shadow-2xl overflow-hidden">
                {otherParticipant?.avatar_url ? (
                  <img
                    src={otherParticipant.avatar_url}
                    alt={otherParticipant.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{otherParticipant?.display_name?.[0]?.toUpperCase() || "?"}</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-light text-white">
                {otherParticipant?.display_name || "Varta Call"}
              </h3>
              <p className="text-sm font-mono text-emerald-400 tracking-wider font-semibold">
                {callStatus === "reconnecting" ? "Reconnecting network..." : elapsed}
              </p>
            </div>
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {localStream && !isVideoOff && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-6 right-6 h-52 w-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          </motion.div>
        )}
      </div>

      {/* Call Controls Bar */}
      <div className="flex items-center justify-center gap-6 py-6 px-4">
        {/* Mute */}
        <CallControlButton
          onClick={toggleMute}
          active={isMuted}
          danger={false}
          label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-6 w-6 text-red-400" /> : <Mic className="h-6 w-6 text-white" />}
        </CallControlButton>

        {/* Video toggle */}
        <CallControlButton
          onClick={toggleVideo}
          active={isVideoOff}
          danger={false}
          label={isVideoOff ? "Start Video" : "Stop Video"}
        >
          {isVideoOff ? <VideoOff className="h-6 w-6 text-red-400" /> : <Video className="h-6 w-6 text-white" />}
        </CallControlButton>

        {/* Screen Share */}
        <CallControlButton
          onClick={toggleScreenShare}
          active={isScreenSharing}
          danger={false}
          label={isScreenSharing ? "Stop Share" : "Share Screen"}
        >
          <Monitor className={`h-6 w-6 ${isScreenSharing ? "text-primary" : "text-white"}`} />
        </CallControlButton>

        {/* Raise Hand */}
        <CallControlButton
          onClick={toggleRaiseHand}
          active={isHandRaised}
          danger={false}
          label={isHandRaised ? "Lower Hand" : "Raise Hand"}
        >
          <Hand className={`h-6 w-6 ${isHandRaised ? "text-amber-400" : "text-white"}`} />
        </CallControlButton>

        {/* End Call */}
        <CallControlButton onClick={endCall} active danger label="End Call">
          <PhoneOff className="h-7 w-7 text-white" />
        </CallControlButton>
      </div>
    </motion.div>
  );
}

function CallControlButton({
  onClick,
  active,
  danger,
  label,
  children,
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
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all shadow-xl hover:scale-105 active:scale-95 ${
          danger
            ? "bg-red-600 shadow-red-600/30 hover:bg-red-500"
            : active
            ? "bg-white/20 border border-white/30"
            : "bg-white/10 hover:bg-white/20 border border-white/10"
        }`}
      >
        {children}
      </button>
      <span className="text-[11px] font-medium text-white/70">{label}</span>
    </div>
  );
}

// ─── 5. Global Call Overlay Controller ─────────────────────────────────────────
export function GlobalCallOverlay() {
  const {
    activeCall,
    incomingCall,
    callStatus,
    otherParticipant,
    isRingtoneMuted,
    acceptCall,
    declineCall,
    endCall,
    toggleMuteRingtone,
    clearCallState,
    startCall,
  } = useCallingContext();

  const callerName = otherParticipant?.display_name || "Varta User";
  const avatarUrl = otherParticipant?.avatar_url;

  return (
    <AnimatePresence>
      {/* 1. Incoming Call Screen */}
      {incomingCall && callStatus === "ringing" && (
        <IncomingCallScreen
          key="incoming"
          call={incomingCall}
          callerName={callerName}
          avatarUrl={avatarUrl}
          onAccept={acceptCall}
          onDecline={declineCall}
          isMutedRingtone={isRingtoneMuted}
          onToggleMuteRingtone={toggleMuteRingtone}
        />
      )}

      {/* 2. Outgoing Call Screen (Calling / Ringing / Connecting) */}
      {activeCall && (callStatus === "calling" || callStatus === "ringing" || callStatus === "connecting") && (
        <OutgoingCallScreen
          key="outgoing"
          callerName={callerName}
          avatarUrl={avatarUrl}
          statusText={
            callStatus === "calling"
              ? "Calling"
              : callStatus === "ringing"
              ? "Ringing"
              : "Connecting WebRTC"
          }
          onCancel={endCall}
        />
      )}

      {/* 3. Busy Screen */}
      {callStatus === "busy" && (
        <BusyCallScreen
          key="busy"
          callerName={callerName}
          onCallAgain={() => {
            if (activeCall?.conversation_id) {
              startCall(activeCall.conversation_id, activeCall.type, otherParticipant || undefined);
            }
          }}
          onSendMessage={() => {
            clearCallState();
          }}
          onClose={clearCallState}
        />
      )}

      {/* 4. Active Connected Call Screen */}
      {activeCall && (callStatus === "connected" || callStatus === "reconnecting") && (
        <ActiveCallOverlay key="active" />
      )}
    </AnimatePresence>
  );
}
