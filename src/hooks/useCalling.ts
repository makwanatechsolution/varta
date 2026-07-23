import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { Call, CallType } from "../types/database";

let fetchedIceServers: RTCIceServer[] | null = null;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (fetchedIceServers) return fetchedIceServers;

  const baseServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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

export function useCalling(conversationId: string | undefined) {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const ringTimerRef = useRef<number | null>(null);

  // Keep ref in sync for closures in WebRTC callbacks
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  // ─── Peer connection factory ──────────────────────────────────────────────

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
      setRemoteStream(event.streams[0] ?? null);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        // Attempt ICE restart
        if (pc.connectionState === "failed") {
          pc.restartIce();
        }
      }
    };

    pcRef.current = pc;
    return pc;
  }, [user]);

  // ─── Signal listener — reads offer/answer/ICE from DB ─────────────────────

  const subscribeToSignals = useCallback((callId: string, role: "initiator" | "answerer") => {
    const channel = supabase
      .channel(`call_signals:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          const sig = payload.new as {
            signal_type: string;
            from_user_id: string;
            payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
          };

          // Don't process our own signals
          if (sig.from_user_id === user?.id) return;

          const pc = pcRef.current;
          if (!pc) return;

          if (sig.signal_type === "offer" && role === "answerer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await supabase.from("call_signals").insert({
              call_id: callId,
              from_user_id: user!.id,
              signal_type: "answer",
              payload: answer as unknown as import("../types/database").Json,
            });
          }

          if (sig.signal_type === "answer" && role === "initiator") {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
              import("../lib/audio").then((m) => m.callAudio.stop());
              // Update active call so the timer starts for the caller!
              setActiveCall((prev) => prev ? { ...prev, status: "active", answered_at: new Date().toISOString() } : null);
            }
          }

          if (sig.signal_type === "ice-candidate") {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(sig.payload as unknown as RTCIceCandidateInit));
            } catch {
              // Ignore invalid candidates
            }
          }

          if (sig.signal_type === "hangup") {
            endCall();
          }
        },
      )
      .subscribe();

    return channel;
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Incoming call listener ────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    // Request notification permission if not granted
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel(`calls_incoming:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        async (payload) => {
          const call = payload.new as Call;
          if (call.status === "ringing" && call.initiator_id !== user.id && call.conversation_id) {
            const { data: membership } = await supabase
              .from("conversation_members")
              .select("id")
              .eq("conversation_id", call.conversation_id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (membership) {
              setIncomingCall(call);
              
              // Play ringtone
              import("../lib/audio").then((m) => m.callAudio.playIncomingRing());

              // Send Notification
              if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
                const notif = new Notification("Incoming Call", {
                  body: call.type === "video" ? "Incoming Video Call" : "Incoming Voice Call",
                  icon: "/vite.svg"
                });
                notif.onclick = () => {
                  window.focus();
                  notif.close();
                };
              }

              // Auto-miss after 30s
              const timer = window.setTimeout(async () => {
                import("../lib/audio").then((m) => m.callAudio.stop());
                setIncomingCall((prev) => {
                  if (prev?.id === call.id) {
                    supabase.from("calls").update({ status: "missed" }).eq("id", call.id);
                    return null;
                  }
                  return prev;
                });
              }, RING_TIMEOUT_MS);
              ringTimerRef.current = timer;
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          // If the caller cancelled the call
          setIncomingCall((prev) => {
            if (prev && prev.id === payload.new.id && payload.new.status !== "ringing") {
              import("../lib/audio").then((m) => m.callAudio.stop());
              if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
              return null;
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ─── Start call (initiator) ────────────────────────────────────────────────

  const startCall = async (type: CallType = "voice") => {
    if (!user || !conversationId) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    setLocalStream(stream);

    const { data: call } = await supabase
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

    if (!call) { stream.getTracks().forEach((t) => t.stop()); return; }
    setActiveCall(call as Call);

    await supabase.from("call_participants").insert({ call_id: call.id, user_id: user.id });

    const pc = await createPeerConnection(call.id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Subscribe to signals as initiator BEFORE sending offer
    subscribeToSignals(call.id, "initiator");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    import("../lib/audio").then((m) => m.callAudio.playOutgoingRing());

    await supabase.from("call_signals").insert({
      call_id: call.id,
      from_user_id: user.id,
      signal_type: "offer",
      payload: offer as unknown as import("../types/database").Json,
    });

    // Auto-miss if no answer in 30s
    ringTimerRef.current = window.setTimeout(async () => {
      const cur = activeCallRef.current;
      if (cur?.id === call.id && cur.status === "ringing") {
        import("../lib/audio").then((m) => m.callAudio.stop());
        await supabase.from("calls").update({ status: "missed" }).eq("id", call.id);
        await _insertCallLog(conversationId, call.id, "missed", type);
        stream.getTracks().forEach((t) => t.stop());
        pcRef.current?.close();
        setActiveCall(null);
        setLocalStream(null);
      }
    }, RING_TIMEOUT_MS);
  };

  // ─── Accept call (answerer) ────────────────────────────────────────────────

  const acceptCall = async () => {
    if (!incomingCall || !user) return;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    
    import("../lib/audio").then((m) => m.callAudio.stop());

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: incomingCall.type === "video",
    });
    setLocalStream(stream);
    setActiveCall(incomingCall);
    setIncomingCall(null);

    await supabase.from("calls").update({ status: "active", answered_at: new Date().toISOString() }).eq("id", incomingCall.id);
    await supabase.from("call_participants").insert({ call_id: incomingCall.id, user_id: user.id, joined_at: new Date().toISOString() });

    const pc = await createPeerConnection(incomingCall.id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Subscribe as answerer — will read the offer from DB when signals arrive
    subscribeToSignals(incomingCall.id, "answerer");

    // Fetch existing offer that was already inserted before we answered
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
  };

  // ─── Decline ──────────────────────────────────────────────────────────────

  const declineCall = async () => {
    if (!incomingCall) return;
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    import("../lib/audio").then((m) => m.callAudio.stop());
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", incomingCall.id);
    setIncomingCall(null);
  };

  // ─── End call ─────────────────────────────────────────────────────────────

  const endCall = async () => {
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    import("../lib/audio").then((m) => m.callAudio.stop());

    const call = activeCallRef.current;
    if (call) {
      const endedAt = new Date().toISOString();
      const durationMs = call.started_at ? Date.now() - new Date(call.started_at).getTime() : 0;
      const durationSecs = Math.round(durationMs / 1000);

      await supabase.from("calls").update({
        status: "ended",
        ended_at: endedAt,
        duration_seconds: durationSecs,
      }).eq("id", call.id);

      // Send hangup signal to remote
      if (user) {
        await supabase.from("call_signals").insert({
          call_id: call.id,
          from_user_id: user.id,
          signal_type: "hangup",
          payload: {},
        });
      }

      // Insert call_log message into conversation
      if (call.conversation_id) {
        await _insertCallLog(call.conversation_id, call.id, "ended", call.type, durationSecs);
      }
    }

    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
  };

  // ─── Toggle mute / video ──────────────────────────────────────────────────

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isVideoOff; });
    setIsVideoOff((prev) => !prev);
  };

  return {
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}

// ─── Helper: insert call_log message ─────────────────────────────────────────

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
