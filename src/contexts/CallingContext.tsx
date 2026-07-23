import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
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
        await supabase.from("call_signals").insert({
          call_id: callId,
          from_user_id: user.id,
          signal_type: "ice-candidate",
          payload: event.candidate.toJSON() as unknown as import("../types/database").Json,
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

        // Update database with answered timestamp if caller/answerer
        if (activeCallRef.current?.id) {
          supabase
            .from("calls")
            .update({ status: "active", answered_at: now.toISOString() })
            .eq("id", activeCallRef.current.id)
            .then();
        }
      } else if (state === "disconnected" || state === "failed") {
        setCallStatus("reconnecting");
        // Attempt ICE restart
        try { pc.restartIce(); } catch (e) {}

        // Set 15s reconnection timeout
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

  // ─── Signal listener (Offer, Answer, ICE, Hangup, Busy) ───────────────────
  const subscribeToSignals = useCallback((callId: string, role: "initiator" | "answerer") => {
    const channel = supabase.channel(`call_signals:${callId}`);

    const processSignal = async (sig: { signal_type: string; from_user_id: string; payload: any }) => {
      if (sig.from_user_id === user?.id) return;
      const pc = pcRef.current;
      if (!pc) return;

      if (sig.signal_type === "offer" && role === "answerer") {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        await flushPendingIceCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: "broadcast",
          event: "webrtc_signal",
          payload: { signal_type: "answer", from_user_id: user!.id, payload: answer },
        });

        await supabase.from("call_signals").insert({
          call_id: callId,
          from_user_id: user!.id,
          signal_type: "answer",
          payload: answer as unknown as import("../types/database").Json,
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
        setTimeout(() => {
          clearCallState();
        }, 1000);
      }
    };

    channel
      .on("broadcast", { event: "webrtc_signal" }, async ({ payload }) => {
        await processSignal(payload);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          await processSignal(payload.new as any);
        },
      )
      .subscribe();

    return channel;
  }, [user, flushPendingIceCandidates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Incoming Call Global Listener ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const directChannel = supabase.channel(`varta_direct_calls:${user.id}`);
    directChannel
      .on(
        "broadcast",
        { event: "incoming_call" },
        async ({ payload }) => {
          const { call, initiatorProfile } = payload || {};
          if (!call || call.initiator_id === user.id) return;
          if (callStatusRef.current && ["calling", "ringing", "connecting", "connected", "active"].includes(callStatusRef.current)) return;

          setOtherParticipant(initiatorProfile as Profile);
          setIncomingCall(call);
          setCallStatus("ringing");

          callAudio.playIncomingRing();
          startTitleFlashing(initiatorProfile?.display_name || "Someone");

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`Incoming Call from ${initiatorProfile?.display_name || "Someone"}`, {
                body: call.type === "video" ? "📹 Incoming Video Call" : "📞 Incoming Voice Call",
                icon: initiatorProfile?.avatar_url || "/favicon.svg",
                requireInteraction: true,
              });
            } catch (e) {}
          }
        }
      )
      .subscribe();

    const channel = supabase
      .channel(`calls_incoming:${user.id}`)
      .on(
        "broadcast",
        { event: "incoming_call" },
        async ({ payload }) => {
          const { call, initiatorProfile } = payload || {};
          if (!call || call.initiator_id === user.id) return;
          if (callStatusRef.current && ["calling", "ringing", "connecting", "connected", "active"].includes(callStatusRef.current)) return;

          setOtherParticipant(initiatorProfile as Profile);
          setIncomingCall(call);
          setCallStatus("ringing");

          callAudio.playIncomingRing();
          startTitleFlashing(initiatorProfile?.display_name || "Someone");

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`Incoming Call from ${initiatorProfile?.display_name || "Someone"}`, {
                body: call.type === "video" ? "📹 Incoming Video Call" : "📞 Incoming Voice Call",
                icon: initiatorProfile?.avatar_url || "/favicon.svg",
                requireInteraction: true,
              });
            } catch (e) {}
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        async (payload) => {
          const call = payload.new as Call;
          if (call.initiator_id === user.id) return;

          // Check membership
          let isMember = false;
          if (call.conversation_id) {
            const { data: member } = await supabase
              .from("conversation_members")
              .select("id")
              .eq("conversation_id", call.conversation_id)
              .eq("user_id", user.id)
              .maybeSingle();
            if (member) isMember = true;
          }

          if (!isMember) return;

          // Fetch initiator profile
          const { data: initiatorProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", call.initiator_id)
            .single();

          const callerName = initiatorProfile?.display_name || "Someone";
          setOtherParticipant(initiatorProfile as Profile);

          // If current user is ALREADY in an active/ringing call, reply busy!
          if (callStatusRef.current && ["calling", "ringing", "connecting", "connected", "active"].includes(callStatusRef.current)) {
            await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", call.id);
            await supabase.from("call_signals").insert({
              call_id: call.id,
              from_user_id: user.id,
              signal_type: "busy",
              payload: {},
            });
            return;
          }

          setIncomingCall(call);
          setCallStatus("ringing");

          // Play incoming ringtone
          callAudio.playIncomingRing();

          // Flashing tab title
          startTitleFlashing(callerName);

          // Desktop Web Notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const notif = new Notification(`Incoming Call from ${callerName}`, {
                body: call.type === "video" ? "📹 Incoming Video Call" : "📞 Incoming Voice Call",
                icon: initiatorProfile?.avatar_url || "/favicon.svg",
                tag: `call-${call.id}`,
                requireInteraction: true,
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch (e) {
              console.warn("Notification trigger failed", e);
            }
          }

          // 30-Second Timeout for auto-missed call
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          ringTimerRef.current = window.setTimeout(async () => {
            if (callStatusRef.current === "ringing") {
              callAudio.stop();
              callAudio.playMissedCall();
              stopTitleFlashing();

              await supabase.from("calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", call.id);
              if (call.conversation_id) {
                await _insertCallLog(call.conversation_id, call.id, "missed", call.type);
              }

              setIncomingCall(null);
              setCallStatus(null);
            }
          }, RING_TIMEOUT_MS);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const updated = payload.new as Call;
          if (incomingCall && incomingCall.id === updated.id) {
            if (updated.status === "ended" || updated.status === "declined" || updated.status === "missed") {
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(directChannel);
    };
  }, [user, startTitleFlashing, stopTitleFlashing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Start Call (Caller / Initiator) ───────────────────────────────────────
  const startCall = async (conversationId: string, type: CallType = "voice", targetUser?: Profile) => {
    if (!user) return;
    callAudio.stop();

    if (targetUser) setOtherParticipant(targetUser);

    // Acquire stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      setLocalStream(stream);
      setIsVideoOff(type !== "video");
      setIsMuted(false);

      // Check if target recipient is online / busy in DB
      if (targetUser?.id) {
        const { data: activeCalls } = await supabase
          .from("calls")
          .select("id")
          .eq("initiator_id", targetUser.id)
          .in("status", ["ringing", "active"]);

        if (activeCalls && activeCalls.length > 0) {
          callAudio.playBusyTone();
          setCallStatus("busy");
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
      }

      // Insert Call record
      const { data: call, error } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId,
          initiator_id: user.id,
          type,
          status: "ringing",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !call) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setActiveCall(call as Call);
      setCallStatus("calling");

      await supabase.from("call_participants").insert({ call_id: call.id, user_id: user.id });

      const pc = await createPeerConnection(call.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      subscribeToSignals(call.id, "initiator");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Play custom Varta Outgoing Ringtone
      callAudio.playOutgoingRing();

      // Dispatch direct WebSocket broadcast for 0-latency instant ringing on recipient device
      if (targetUser?.id) {
        const broadcastChannel = supabase.channel(`varta_direct_calls:${targetUser.id}`);
        broadcastChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            broadcastChannel.send({
              type: "broadcast",
              event: "incoming_call",
              payload: {
                call,
                initiatorProfile: {
                  id: user.id,
                  display_name: user.user_metadata?.display_name || user.email || "Varta User",
                  avatar_url: user.user_metadata?.avatar_url || null,
                },
              },
            }).then(() => {
              supabase.removeChannel(broadcastChannel);
            });
          }
        });
      }

      await supabase.from("call_signals").insert({
        call_id: call.id,
        from_user_id: user.id,
        signal_type: "offer",
        payload: offer as unknown as import("../types/database").Json,
      });

      // Send background FCM push via backend route
      fetch("/api/sendCallPush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: call.id,
          conversationId,
          initiatorId: user.id,
          initiatorName: user.user_metadata?.display_name || "Varta User",
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

          await supabase.from("calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", call.id);
          await _insertCallLog(conversationId, call.id, "missed", type);

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

      await supabase.from("call_participants").insert({
        call_id: incomingCall.id,
        user_id: user.id,
        joined_at: new Date().toISOString(),
      });

      const pc = await createPeerConnection(incomingCall.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      subscribeToSignals(incomingCall.id, "answerer");

      // Check for existing SDP offer
      const { data: signals } = await supabase
        .from("call_signals")
        .select("*")
        .eq("call_id", incomingCall.id)
        .eq("signal_type", "offer")
        .order("created_at", { ascending: true })
        .limit(1);

      const offerSig = signals?.[0];
      if (offerSig && offerSig.from_user_id !== user.id) {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSig.payload as unknown as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await supabase.from("call_signals").insert({
          call_id: incomingCall.id,
          from_user_id: user.id,
          signal_type: "answer",
          payload: answer as unknown as import("../types/database").Json,
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
      await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", targetCallId);
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

      await supabase.from("calls").update({
        status: "ended",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSecs,
      }).eq("id", call.id);

      if (user) {
        await supabase.from("call_signals").insert({
          call_id: call.id,
          from_user_id: user.id,
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
      // Revert to camera stream
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      }
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(screen);
        setIsScreenSharing(true);

        const screenTrack = screen.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender && screenTrack) {
          sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.warn("Screen share cancelled", err);
      }
    }
  };

  const toggleRaiseHand = () => {
    setIsHandRaised((prev) => !prev);
  };

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
        if (sender && newAudioTrack) {
          sender.replaceTrack(newAudioTrack);
        }
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
  const label = outcome === "missed"
    ? `${icon} Missed ${type} call`
    : `${icon} ${type === "video" ? "Video" : "Voice"} call · ${formatDuration(durationSecs)}`;

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: null,
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
