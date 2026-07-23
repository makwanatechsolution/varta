import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import clsx from "clsx";

interface VoicePlayerProps {
  url: string;
  isOwn?: boolean;
}

export function VoicePlayer({ url, isOwn }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    return parseFloat(localStorage.getItem("varta_voice_speed") || "1");
  });
  
  const [waveform, setWaveform] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    let isMounted = true;
    const fetchAudio = async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (!isMounted) return;

        setDuration(audioBuffer.duration);
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = 40;
        const blockSize = Math.floor(channelData.length / samples);
        const peaks = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          peaks.push(sum / blockSize);
        }
        
        const maxPeak = Math.max(...peaks);
        const normalized = peaks.map(p => (p / maxPeak) * 100);
        setWaveform(normalized);
        setLoading(false);
      } catch (err) {
        console.error("Error decoding audio", err);
        setLoading(false);
      }
    };
    
    fetchAudio();
    return () => { isMounted = false; };
  }, [url]);

  const updateProgress = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateProgress);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(e => console.error("Play error", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !canvasRef.current || duration === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cycleSpeed = () => {
    const nextSpeed = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextSpeed);
    localStorage.setItem("varta_voice_speed", nextSpeed.toString());
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.length === 0) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    const barWidth = 3;
    const gap = 2;
    const totalBars = waveform.length;
    const maxBarHeight = rect.height * 0.8;
    
    const progressPercentage = duration > 0 ? currentTime / duration : 0;
    const playedBars = Math.floor(progressPercentage * totalBars);

    waveform.forEach((val, i) => {
      const height = Math.max(4, (val / 100) * maxBarHeight);
      const x = i * (barWidth + gap);
      const y = (rect.height - height) / 2;
      
      const isPlayed = i < playedBars;
      
      if (isOwn) {
        ctx.fillStyle = isPlayed ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)";
      } else {
        ctx.fillStyle = isPlayed ? "#173B4D" : "rgba(11, 85, 99, 0.3)";
      }
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, height, 2);
      ctx.fill();
    });
  }, [waveform, currentTime, duration, isOwn]);

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 w-64 select-none">
      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }} 
        className="hidden" 
      />
      
      <button 
        onClick={togglePlay}
        className={clsx(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95",
          isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-[#173B4D] hover:bg-[#173B4D]/90 text-white"
        )}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center">
        {loading ? (
          <div className="h-8 flex items-center">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
               <div className="h-full bg-white/50 w-1/3 animate-pulse rounded-full" />
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleSeek}
            className="w-full h-8 cursor-pointer"
            style={{ width: "100%", height: "32px" }}
          />
        )}
        <div className="flex items-center justify-between">
          <span className={clsx("text-[10px] font-medium tracking-wide", isOwn ? "text-white/80" : "text-[#8A8175]")}>
            {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <button 
            onClick={cycleSpeed}
            className={clsx(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors",
              isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-black/5 hover:bg-black/10 text-[#8A8175]"
            )}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
