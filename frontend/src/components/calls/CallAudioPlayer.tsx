import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Download, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallAudioPlayerProps {
  src: string;
  duration?: number;
  className?: string;
}

export default function CallAudioPlayer({ src, duration = 0, className }: CallAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset state on track change
    setIsPlaying(false);
    setCurrentTime(0);
    setTotalDuration(duration || 0);
    setHasError(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [src, duration]);

  const togglePlay = () => {
    if (!audioRef.current || hasError) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setHasError(true);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || !totalDuration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = newProgress * totalDuration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    audioRef.current.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (hasError) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20", className)}>
        <span>Audio unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5 bg-muted/60 hover:bg-muted/90 transition-colors border px-3 py-1.5 rounded-full shadow-sm max-w-sm sm:max-w-md", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setHasError(true)}
      />

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        disabled={isBuffering}
        className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0 focus:outline-none"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isBuffering ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      {/* Current Time / Total Duration */}
      <span className="text-[11px] font-mono tabular-nums text-foreground/80 flex-shrink-0 select-none">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>

      {/* Progress Bar Scrubber */}
      <div
        ref={progressBarRef}
        onClick={handleSeek}
        className="w-24 sm:w-36 h-2 bg-muted-foreground/20 hover:bg-muted-foreground/30 rounded-full relative cursor-pointer flex-shrink-0 transition-colors overflow-hidden"
        title="Seek audio"
      >
        <div
          className="h-full bg-primary rounded-full transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Speed Selector */}
      <button
        onClick={cycleSpeed}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-background/80 hover:bg-background border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 select-none"
        title="Playback Speed"
      >
        {playbackRate}x
      </button>

      {/* Mute Button */}
      <button
        onClick={toggleMute}
        className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 focus:outline-none"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      {/* Download Button */}
      <a
        href={src}
        download={`call_recording_${src.split("/").pop() || "audio.wav"}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        title="Download Recording"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
