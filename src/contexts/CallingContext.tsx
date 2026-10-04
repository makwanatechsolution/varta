import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { vartaWS } from "../lib/ws";
import { callsApi, messagesApi } from "../lib/api";
import { useAuth } from "./AuthContext";
import { callAudio } from "../lib/audio";
import type { Call, CallType, CallStatus, Profile } from "../types/database";

let fetchedIceServers: RTCIceServer[] | null = null;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (fetchedIceServers) return fetchedIceServers;

  const baseServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  const domain = import.meta.env.VITE_TURN_SERVER_URL;
  const apiKey = import.meta.env.VITE_TURN_CREDENTIAL;

  if (domain && domain.includes("metered.live") && apiKey) {
    try {
      const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
      const data = await response.json();
      fetchedIceServers = [...baseServers, ...data];
      return fetchedIceServers;
    } catch (e) {
      console.error("Failed to fetch Metered ICE servers:", e);
    }
  } else if (domain && domain.startsWith("turn:")) {
    fetchedIceServers = [
      ...baseServers,
      {
        urls: domain,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      },
    ];
    return fetchedIceServers;
  }

  fetchedIceServers = baseServers;
  return baseServers;
}

const RING_TIMEOUT_MS = 30_000;
const RECONNECT_TIMEOUT_MS = 15_000;

export interface CallingContextType {
  activeCall: Call | null;
  incomingCall: Call | null;
  callStatus: CallStatus | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isRingtoneMuted: boolean;
  otherParticipant: Profile | null;
  connectedAt: Date | null;
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedAudioOutput: string;
  startCall: (conversationId: string, type?: CallType, targetUser?: Profile) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleRaiseHand: () => void;
  toggleMuteRingtone: () => void;
  setAudioInputDevice: (deviceId: string) => Promise<void>;
  setAudioOutputDevice: (deviceId: string) => Promise<void>;
  clearCallState: () => void;
}

const CallingContext = createContext<CallingContextType | undefined>(undefined);

export function CallingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRingtoneMuted, setIsRingtoneMuted] = useState(false);
  const [otherParticipant, setOtherParticipant] = useState<Profile | null>(null);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const callStatusRef = useRef<CallStatus | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const originalTitleRef = useRef<string>(document.title);
  const titleFlashIntervalRef = useRef<number | null>(null);
  const signalUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  // Load available audio devices
  const updateAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    } catch (e) {
      console.warn("Failed to enumerate audio devices", e);
    }
  }, []);

  useEffect(() => {
    updateAudioDevices();
    navigator.mediaDevices?.addEventListener("devicechange", updateAudioDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", updateAudioDevices);
    };
  }, [updateAudioDevices]);

  // ─── Window Title Flashing Helper ──────────────────────────────────────────
  const startTitleFlashing = useCallback((callerName: string) => {
    stopTitleFlashing();
    originalTitleRef.current = document.title;
    let step = 0;
    titleFlashIntervalRef.current = window.setInterval(() => {
      document.title = step % 2 === 0 ? `🔔 Call from ${callerName}...` : `📞 Incoming Call...`;
      step++;
    }, 1000);
  }, []);

  const stopTitleFlashing = useCallback(() => {
    if (titleFlashIntervalRef.current) {
      clearInterval(titleFlashIntervalRef.current);
      titleFlashIntervalRef.current = null;
    }
    document.title = originalTitleRef.current;
  }, []);

  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription || !pc.remoteDescription.type) return;
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("Error adding queued ICE candidate:", e);
        }
      }
    }
  }, []);

  // ─── Peer Connection Creation ──────────────────────────────────────────────
  const createPeerConnection = useCallback(async (callId: string) => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = async (event) => {
      if (event.candidate && user) {
        await callsApi.sendSignal(callId, {
          to_user_id: "", // broadcast to all call participants
          signal_type: "ice-candidate",
          payload: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("WebRTC Received Track:", event.track.kind, event.streams);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else if (event.track) {
        setRemoteStream((prev) => {
          const stream = prev || new MediaStream();
          if (!stream.getTracks().some((t) => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          return new MediaStream(stream.getTracks());
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("WebRTC Connection state changed:", state);

      if (state === "connected") {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        callAudio.stop();
        stopTitleFlashing();
        setCallStatus("connected");
        const now = new Date();
        setConnectedAt(now);

        if (activeCallRef.current?.id) {
          callsApi.update(activeCallRef.current.id, {
            status: "active",
            answered_at: now.toISOString(),
          });
        }
      } else if (state === "disconnected" || state === "failed") {
        setCallStatus("reconnecting");
        try { pc.restartIce(); } catch (e) { /* ignore */ }

        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = window.setTimeout(() => {
            console.warn("Reconnection timeout reached (15s). Ending call.");
            endCall();
          }, RECONNECT_TIMEOUT_MS);
        }
      }
    };

    pcRef.current = pc;
    return pc;
  }, [user, stopTitleFlashing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Signal listener via WebSocket ─────────────────────────────────────────
  const subscribeToSignals = useCallback((callId: string, role: "initiator" | "answerer") => {
    // Unsubscribe previous
    if (signalUnsubRef.current) signalUnsubRef.current();

    const processSignal = async (sig: any) => {
      if (sig.from_user_id === user?.uid) return;
      const pc = pcRef.current;
      if (!pc) return;

      if (sig.signal_type === "offer" && role === "answerer") {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        await flushPendingIceCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await callsApi.sendSignal(callId, {
          to_user_id: sig.from_user_id,
          signal_type: "answer",
          payload: answer,
        });
      }

      if (sig.signal_type === "answer" && role === "initiator") {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          await flushPendingIceCandidates(pc);
          setCallStatus("connecting");
        }
      }

      if (sig.signal_type === "ice-candidate") {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
          } catch (e) {
            console.warn("Candidate add error:", e);
          }
        } else {
          pendingIceCandidatesRef.current.push(sig.payload);
        }
      }

      if (sig.signal_type === "busy") {
        callAudio.stop();
        callAudio.playBusyTone();
        setCallStatus("busy");
      }

      if (sig.signal_type === "hangup") {
        callAudio.playCallEnded();
        setTimeout(() => { clearCallState(); }, 1000);
      }
    };

    const unsub = vartaWS.on(`call_signals:${callId}`, "signal", processSignal);
    signalUnsubRef.current = unsub;
    return unsub;
  }, [user, flushPendingIceCandidates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Incoming Call Global Listener ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const handleIncomingCall = async (payload: any) => {
      const { call, initiatorProfile } = payload || {};
      if (!call || call.initiator_id === user.uid) return;
      if (callStatusRef.current && ["calling", "ringing", "connecting", "connected", "active"].includes(callStatusRef.current)) {
        // Busy — send busy signal
        await callsApi.update(call.id, { status: "declined", ended_at: new Date().toISOString() });
        await callsApi.sendSignal(call.id, {
          to_user_id: call.initiator_id,
          signal_type: "busy",
          payload: {},
        });
        return;
      }

      setOtherParticipant(initiatorProfile as Profile);
      setIncomingCall(call);
      setCallStatus("ringing");
      callAudio.playIncomingRing();
      startTitleFlashing(initiatorProfile?.display_name || "Someone");

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notif = new Notification(`Incoming Call from ${initiatorProfile?.display_name || "Someone"}`, {
            body: call.type === "video" ? "📹 Incoming Video Call" : "📞 Incoming Voice Call",
            icon: initiatorProfile?.avatar_url || "/favicon.svg",
            tag: `call-${call.id}`,
            requireInteraction: true,
          });
          notif.onclick = () => { window.focus(); notif.close(); };
        } catch (e) { /* ignore */ }
      }

      // 30-Second Timeout for auto-missed call
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = window.setTimeout(async () => {
        if (callStatusRef.current === "ringing") {
          callAudio.stop();
          callAudio.playMissedCall();
          stopTitleFlashing();
          await callsApi.update(call.id, { status: "missed", ended_at: new Date().toISOString() });
          if (call.conversation_id) {
            await _insertCallLog(call.conversation_id, call.id, "missed", call.type);
          }
          setIncomingCall(null);
          setCallStatus(null);
        }
      }, RING_TIMEOUT_MS);
    };

    const handleCallUpdate = (payload: any) => {
      const updated = payload as Call;
      if (incomingCall && incomingCall.id === updated.id) {
        if (["ended", "declined", "missed"].includes(updated.status)) {
          callAudio.stop();
          stopTitleFlashing();
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          setIncomingCall(null);
          setCallStatus(null);
        }
      } else if (activeCallRef.current && activeCallRef.current.id === updated.id) {
        if (updated.status === "busy") {
          callAudio.stop();
          callAudio.playBusyTone();
          setCallStatus("busy");
        } else if (updated.status === "declined") {
          callAudio.stop();
          callAudio.playCallEnded();
          setCallStatus("declined");
          setTimeout(() => clearCallState(), 2000);
        }
      }
    };

    const unsub1 = vartaWS.on(`calls:${user.uid}`, "incoming_call", handleIncomingCall);
    const unsub2 = vartaWS.on(`calls:${user.uid}`, "call_updated", handleCallUpdate);

    return () => {
      unsub1();
      unsub2();
    };
  }, [user, startTitleFlashing, stopTitleFlashing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Start Call (Caller / Initiator) ───────────────────────────────────────
  const startCall = async (conversationId: string, type: CallType = "voice", targetUser?: Profile) => {
    if (!user) return;
    callAudio.stop();
    if (targetUser) setOtherParticipant(targetUser);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      setLocalStream(stream);
      setIsVideoOff(type !== "video");
      setIsMuted(false);

      // Create call record on backend
      const { data: call, error } = await callsApi.create({
        conversation_id: conversationId,
        type,
        participant_ids: targetUser ? [targetUser.id] : [],
      });

      if (error || !call) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setActiveCall(call as Call);
      setCallStatus("calling");

      const pc = await createPeerConnection((call as Call).id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      subscribeToSignals((call as Call).id, "initiator");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      callAudio.playOutgoingRing();

      // Send offer via API
      await callsApi.sendSignal((call as Call).id, {
        to_user_id: targetUser?.id || "",
        signal_type: "offer",
        payload: offer,
      });

      // FCM push for wake-up
      fetch("/api/sendCallPush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: (call as Call).id,
          conversationId,
          initiatorId: user.uid,
          initiatorName: user.displayName || "Varta User",
          callType: type,
          recipientIds: targetUser ? [targetUser.id] : [],
        }),
      }).catch(() => {});

      // 30s timeout for unanswered call
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = window.setTimeout(async () => {
        if (callStatusRef.current === "calling" || callStatusRef.current === "ringing") {
          callAudio.stop();
          callAudio.playMissedCall();
          await callsApi.update((call as Call).id, { status: "missed", ended_at: new Date().toISOString() });
          await _insertCallLog(conversationId, (call as Call).id, "missed", type);
          setCallStatus("missed");
          setTimeout(() => clearCallState(), 2500);
        }
      }, RING_TIMEOUT_MS);
    } catch (err) {
      console.error("Failed to start call", err);
      alert("Could not access microphone/camera. Please grant permissions.");
    }
  };

  // ─── Accept Call (Recipient / Answerer) ─────────────────────────────────────
  const acceptCall = async () => {
    if (!incomingCall || !user) return;

    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    callAudio.stop();
    stopTitleFlashing();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === "video",
      });
      setLocalStream(stream);
      setIsVideoOff(incomingCall.type !== "video");
      setIsMuted(false);

      setActiveCall(incomingCall);
      setIncomingCall(null);
      setCallStatus("connecting");

      await callsApi.update(incomingCall.id, {
        status: "connecting",
        answered_at: new Date().toISOString(),
      });

      const pc = await createPeerConnection(incomingCall.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      subscribeToSignals(incomingCall.id, "answerer");

      // Fetch existing offer signal
      const { data: signals } = await callsApi.getSignals(incomingCall.id);
      const offerSig = (signals as any[] | null)?.find(
        (s: any) => s.signal_type === "offer" && s.from_user_id !== user.uid,
      );

      if (offerSig) {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSig.payload as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await callsApi.sendSignal(incomingCall.id, {
          to_user_id: offerSig.from_user_id,
          signal_type: "answer",
          payload: answer,
        });
      }
    } catch (err) {
      console.error("Failed to accept call", err);
      declineCall();
    }
  };

  // ─── Decline Call ─────────────────────────────────────────────────────────
  const declineCall = async () => {
    if (!incomingCall && !activeCall) return;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    callAudio.stop();
    stopTitleFlashing();

    const targetCallId = incomingCall?.id || activeCall?.id;
    if (targetCallId) {
      await callsApi.update(targetCallId, { status: "declined", ended_at: new Date().toISOString() });
    }

    callAudio.playCallEnded();
    clearCallState();
  };

  // ─── End Call ──────────────────────────────────────────────────────────────
  const endCall = async () => {
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }

    callAudio.stop();
    stopTitleFlashing();

    const call = activeCallRef.current;
    if (call) {
      const endedAt = new Date();
      let durationSecs = 0;
      if (connectedAt) {
        durationSecs = Math.max(0, Math.round((endedAt.getTime() - connectedAt.getTime()) / 1000));
      }

      await callsApi.update(call.id, {
        status: "ended",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSecs,
      });

      if (user) {
        await callsApi.sendSignal(call.id, {
          to_user_id: "",
          signal_type: "hangup",
          payload: {},
        });
      }

      if (call.conversation_id) {
        await _insertCallLog(call.conversation_id, call.id, "ended", call.type, durationSecs);
      }
    }

    callAudio.playCallEnded();
    clearCallState();
  };

  // ─── Clear All Call State ──────────────────────────────────────────────────
  const clearCallState = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (signalUnsubRef.current) {
      signalUnsubRef.current();
      signalUnsubRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setScreenStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    setOtherParticipant(null);
    setConnectedAt(null);
  };

  // ─── Toggles & Controls ───────────────────────────────────────────────────
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    }
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => { t.enabled = isVideoOff; });
    }
    setIsVideoOff((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current) return;

    if (isScreenSharing) {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      }
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(screen);
        setIsScreenSharing(true);

        const screenTrack = screen.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender && screenTrack) sender.replaceTrack(screenTrack);

        screenTrack.onended = () => { toggleScreenShare(); };
      } catch (err) {
        console.warn("Screen share cancelled", err);
      }
    }
  };

  const toggleRaiseHand = () => { setIsHandRaised((prev) => !prev); };

  const toggleMuteRingtone = () => {
    const next = !isRingtoneMuted;
    setIsRingtoneMuted(next);
    callAudio.setMuted(next);
  };

  const setAudioInputDevice = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (!localStream) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "audio");
        if (sender && newAudioTrack) sender.replaceTrack(newAudioTrack);
      }
    } catch (e) {
      console.error("Error switching audio input", e);
    }
  };

  const setAudioOutputDevice = async (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
  };

  return (
    <CallingContext.Provider
      value={{
        activeCall,
        incomingCall,
        callStatus,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isHandRaised,
        isRingtoneMuted,
        otherParticipant,
        connectedAt,
        audioInputs,
        audioOutputs,
        selectedAudioInput,
        selectedAudioOutput,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        toggleRaiseHand,
        toggleMuteRingtone,
        setAudioInputDevice,
        setAudioOutputDevice,
        clearCallState,
      }}
    >
      {children}
    </CallingContext.Provider>
  );
}

export function useCallingContext() {
  const context = useContext(CallingContext);
  if (!context) {
    throw new Error("useCallingContext must be used within a CallingProvider");
  }
  return context;
}

// ─── Helper function to record call log message into chat ────────────────────
async function _insertCallLog(
  conversationId: string,
  callId: string,
  outcome: "ended" | "missed",
  type: CallType,
  durationSecs = 0,
) {
  const icon = type === "video" ? "📹" : "📞";
  const label =
    outcome === "missed"
      ? `${icon} Missed ${type} call`
      : `${icon} ${type === "video" ? "Video" : "Voice"} call · ${formatDuration(durationSecs)}`;

  await messagesApi.send(conversationId, {
    type: "call_log",
    content: `${label}||call_id=${callId}`,
  });
}

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}
