import { useState, useRef, useEffect } from "react";
import { Mic, Send, Trash2, Lock } from "lucide-react";
import clsx from "clsx";

interface VoiceRecorderProps {
  onSend: (blob: Blob) => void;
  onCancel: () => void;
  onRecordingChange?: (isRecording: boolean) => void;
  className?: string;
}

export function VoiceRecorder({ onSend, onCancel, onRecordingChange, className }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false); // When dragging left
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number>(0);
  
  // Gesture tracking
  const startPos = useRef({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const SLIDE_CANCEL_THRESHOLD = -100; // Slide left 100px to cancel
  const SWIPE_LOCK_THRESHOLD = -100; // Swipe up 100px to lock

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      setDuration(0);
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // 100ms chunks to ensure we don't lose data if stopped abruptly
      setIsRecording(true);
      onRecordingChange?.(true);
    } catch (err) {
      console.error("Microphone permission denied or error", err);
      alert("Microphone access is required to send voice messages.");
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        if (duration < 1) {
          // Discard if under 1 second
          stopTracks();
          onCancel();
          return;
        }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stopTracks();
        onSend(blob);
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsLocked(false);
    onRecordingChange?.(false);
  };

  const stopAndDiscard = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null; // Prevent onstop logic
      mediaRecorderRef.current.stop();
    }
    stopTracks();
    setIsRecording(false);
    setIsLocked(false);
    onRecordingChange?.(false);
    onCancel();
  };

  const stopTracks = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRecording) return; // Prevent double trigger
    startPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRecording();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isRecording || isLocked) return;
    
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    
    // Only allow left drag and up drag
    const x = Math.min(0, dx);
    const y = Math.min(0, dy);
    
    setDragOffset({ x, y });
    
    if (x < SLIDE_CANCEL_THRESHOLD) {
      setIsCancelling(true);
    } else {
      setIsCancelling(false);
    }
    
    if (y < SWIPE_LOCK_THRESHOLD) {
      setIsLocked(true);
      setDragOffset({ x: 0, y: 0 }); // reset visuals once locked
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isRecording || isLocked) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    setDragOffset({ x: 0, y: 0 });
    
    if (isCancelling || dragOffset.x <= SLIDE_CANCEL_THRESHOLD) {
      stopAndDiscard();
    } else {
      stopAndSend();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      {isRecording && (
        <div className="flex-1 flex items-center justify-between px-4 bg-[#202c33] rounded-full h-10 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono">{formatTime(duration)}</span>
          </div>
          
          {!isLocked ? (
            <div className="flex items-center gap-1 text-zinc-400 text-xs">
              <span className={clsx("transition-opacity", isCancelling ? "opacity-100 text-red-400" : "opacity-60")}>
                {isCancelling ? "Release to cancel" : "◁ Slide to cancel"}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={stopAndDiscard} className="text-zinc-400 hover:text-red-400 p-1">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lock indicator (appears while dragging up) */}
      {isRecording && !isLocked && dragOffset.y < -20 && (
        <div 
          className="absolute right-4 bottom-16 bg-[#202c33] rounded-full p-2 flex flex-col items-center gap-1 opacity-70"
          style={{ transform: `translateY(${Math.max(dragOffset.y + 100, 0)}px)` }}
        >
          <Lock className="w-4 h-4 text-zinc-400" />
        </div>
      )}

      {/* The main button */}
      {!isLocked ? (
        <button
          className={clsx(
            "rounded-full p-2.5 transition-colors touch-none select-none",
            isRecording ? "bg-[#1E88C7] text-white" : "bg-transparent text-zinc-400 hover:bg-zinc-800"
          )}
          style={{
            transform: isRecording ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={stopAndDiscard}
        >
          <Mic className="h-5 w-5 fill-current" />
        </button>
      ) : (
        <button
          onClick={stopAndSend}
          className="rounded-full p-2.5 bg-[#1E88C7] text-white hover:bg-[#1971A5] transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
