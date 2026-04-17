import { useEffect, useRef, useState } from "react";
import { FileText, Download, Play, Pause, X } from "lucide-react";
import { formatBytes, formatDuration } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  url: string;
  type: string | null;
  name: string | null;
  size: number | null;
  duration: number | null;
  isMine: boolean;
}

export function AttachmentView({ url, type, name, size, duration, isMine }: Props) {
  const kind = (type || "").split("/")[0];

  if (kind === "image") return <ImageView url={url} name={name} />;
  if (kind === "video") return <VideoView url={url} />;
  if (kind === "audio") return <AudioView url={url} duration={duration ?? 0} isMine={isMine} />;
  return <FileView url={url} name={name} size={size} isMine={isMine} />;
}

function ImageView({ url, name }: { url: string; name: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="block -mx-1 -mt-1 mb-1 rounded-xl overflow-hidden">
        <img
          src={url}
          alt={name || "image"}
          loading="lazy"
          className="max-w-[260px] max-h-[320px] w-auto h-auto object-cover rounded-xl"
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setOpen(false)}
          >
            <button className="absolute top-4 right-4 size-10 rounded-full bg-white/10 text-white flex items-center justify-center" onClick={() => setOpen(false)}>
              <X className="size-5" />
            </button>
            <img src={url} alt={name || "image"} className="max-w-full max-h-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function VideoView({ url }: { url: string }) {
  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      className="-mx-1 -mt-1 mb-1 max-w-[260px] max-h-[320px] rounded-xl bg-black"
    />
  );
}

function AudioView({ url, duration, isMine }: { url: string; duration: number; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(duration);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onMeta = () => { if (isFinite(a.duration)) setDur(a.duration); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] py-1">
      <button
        onClick={toggle}
        className={cn(
          "size-9 rounded-full flex items-center justify-center shrink-0",
          isMine ? "bg-white/25 text-white" : "bg-primary text-primary-foreground"
        )}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={cn("h-1 rounded-full overflow-hidden", isMine ? "bg-white/25" : "bg-primary/20")}>
          <div
            className={cn("h-full transition-[width] duration-100", isMine ? "bg-white" : "bg-primary")}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums opacity-80">{formatDuration(dur)}</span>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}

function FileView({ url, name, size, isMine }: { url: string; name: string | null; size: number | null; isMine: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name || true}
      className={cn(
        "flex items-center gap-3 min-w-[220px] py-1.5 -mx-0.5",
      )}
    >
      <div className={cn(
        "size-10 rounded-xl flex items-center justify-center shrink-0",
        isMine ? "bg-white/25" : "bg-primary/15"
      )}>
        <FileText className={cn("size-5", isMine ? "text-white" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name || "File"}</div>
        {size != null && <div className="text-[11px] opacity-70">{formatBytes(size)}</div>}
      </div>
      <Download className="size-4 opacity-70 shrink-0" />
    </a>
  );
}
