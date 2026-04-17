import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, X, Send } from "lucide-react";
import { formatDuration, LIMITS } from "@/lib/uploads";
import { toast } from "sonner";

export function VoiceRecorder({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (blob: Blob, durationSec: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    start();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop at max duration
  useEffect(() => {
    if (seconds >= LIMITS.voiceMaxSeconds && recording) {
      stopAndSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const cleanup = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start();
      setRecording(true);
      tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      console.error(e);
      toast.error("Microphone permission denied");
      onCancel();
    }
  };

  const stopAndSend = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    const dur = seconds;
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType });
      cleanup();
      onSend(blob, dur);
    };
    if (rec.state !== "inactive") rec.stop();
  };

  const cancel = () => {
    cleanup();
    onCancel();
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="flex-1 flex items-center gap-3 bg-card border border-border/60 rounded-3xl px-3 py-2.5"
    >
      <button onClick={cancel} className="size-9 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <span className="size-2.5 rounded-full bg-destructive animate-pulse" />
        <Mic className="size-4 text-destructive" />
        <span className="text-sm font-mono tabular-nums">{formatDuration(seconds)}</span>
        <span className="text-xs text-muted-foreground ml-auto">Recording…</span>
      </div>
      <button
        onClick={stopAndSend}
        disabled={seconds < 1}
        className="size-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
        aria-label="Send voice note"
      >
        <Send className="size-4" />
      </button>
    </motion.div>
  );
}
