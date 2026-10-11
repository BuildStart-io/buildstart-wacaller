import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Download, Loader2, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CallAudioPlayerProps {
  src: string;
  duration?: number;
  className?: string;
}

export function CallAudioPlayer({ src, duration: initialDuration = 0, className }: CallAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset player when src changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(initialDuration);
    setError(null);
    setIsLoading(false);
  }, [src, initialDuration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch((err) => {
        console.error("Playback error:", err);
        setError("Playback failed");
        setIsLoading(false);
        setIsPlaying(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && (!duration || isNaN(duration) || duration === 0)) {
      if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
        setDuration(Math.round(audioRef.current.duration));
      }
    }
    setIsLoading(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (values: number[]) => {
    const newTime = values[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 bg-card/90 dark:bg-muted/30 border border-border/80 shadow-sm rounded-full px-3 py-1.5 transition-all max-w-full",
        className
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onError={() => {
          setError("Audio unavailable");
          setIsLoading(false);
          setIsPlaying(false);
        }}
      />

      {/* Play / Pause Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        disabled={!!error}
        className={cn(
          "h-8 w-8 rounded-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:scale-95 transition-transform shadow-sm",
          error && "opacity-50 cursor-not-allowed"
        )}
        title={isPlaying ? "Pause" : "Play recording"}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </Button>

      {/* Time Display */}
      <div className="font-mono text-xs text-muted-foreground whitespace-nowrap select-none min-w-[70px]">
        <span>{formatTime(currentTime)}</span>
        <span className="opacity-40 mx-1">/</span>
        <span>{formatTime(duration || 0)}</span>
      </div>

      {/* Progress Slider */}
      <div className="w-20 sm:w-28 md:w-36 flex-shrink">
        <Slider
          value={[currentTime]}
          max={Math.max(duration, 1)}
          step={0.5}
          onValueChange={handleSeek}
          disabled={!!error}
          className="cursor-pointer py-1"
        />
      </div>

      {/* Volume / Mute Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50 hidden sm:flex"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
      </Button>

      {/* Download Audio */}
      <a
        href={src}
        download="call-recording.wav"
        target="_blank"
        rel="noopener noreferrer"
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="Download recording"
      >
        <Download className="w-3.5 h-3.5" />
      </a>

      {error && (
        <span className="text-[11px] text-destructive whitespace-nowrap pr-1">
          {error}
        </span>
      )}
    </div>
  );
}
