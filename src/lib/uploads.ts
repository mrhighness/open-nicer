import { supabase } from "@/integrations/supabase/client";

export const LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 10 * 1024 * 1024, // 10MB (5 min voice)
  file: 25 * 1024 * 1024, // 25MB
  voiceMaxSeconds: 300,
} as const;

export type AttachmentKind = "image" | "video" | "audio" | "file";

export function detectKind(file: { type: string; name?: string }): AttachmentKind {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "file";
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export async function uploadAttachment(
  file: Blob,
  opts: { chatId: string; senderId: string; filename: string; kind: AttachmentKind }
): Promise<{ url: string; path: string }> {
  const ext = opts.filename.includes(".") ? opts.filename.split(".").pop() : guessExt(file.type);
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${opts.chatId}/${opts.senderId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}${ext && !opts.filename.includes(".") ? "." + ext : ""}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

function guessExt(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("mpeg") && mime.includes("audio")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

export function checkSize(file: { size: number }, kind: AttachmentKind): string | null {
  const limit = LIMITS[kind];
  if (file.size > limit) return `File too large. Max ${formatBytes(limit)}.`;
  return null;
}

export async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}
