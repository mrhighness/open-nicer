import { supabase } from "@/integrations/supabase/client";
import { assertAllowedMime, assertAvatarMime } from "@/lib/security/mime";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { sanitizeFilename } from "@/lib/security/sanitize";

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
  assertRateLimit(`upload:${opts.chatId}`, 15, 60_000);
  assertAllowedMime(opts.kind, file.type || "");
  const ext = opts.filename.includes(".") ? opts.filename.split(".").pop() : guessExt(file.type);
  const safeName = sanitizeFilename(opts.filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
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

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const STATUS_IMAGE_MAX = 8 * 1024 * 1024;

export async function uploadStatusImage(userId: string, file: Blob, filename: string): Promise<string> {
  assertRateLimit(`status:${userId}`, 8, 60_000);
  assertAllowedMime("image", file.type || "");
  if (file.size > STATUS_IMAGE_MAX) throw new Error("Status image must be under 8 MB");
  const ext = filename.includes(".") ? filename.split(".").pop() : guessExt(file.type) || "jpg";
  const path = `status/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}

/** Temporary signed URL for external AI APIs (Pixazo / DeepAI). Uses avatars/ path allowed by RLS. */
export async function uploadOnboardingPhoto(userId: string, file: Blob): Promise<string> {
  assertRateLimit(`onboarding:${userId}`, 3, 60_000);
  assertAllowedMime("image", file.type || "");
  if (file.size > LIMITS.image) throw new Error("Photo must be under 10 MB");
  const ext = guessExt(file.type) || "jpg";
  const path = `avatars/${userId}/onboarding-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "300",
    upsert: false,
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, 600);
  if (signErr || !signed?.signedUrl) {
    throw signErr ?? new Error("Could not create reference URL for AI processing");
  }
  return signed.signedUrl;
}

export async function uploadGroupAvatar(chatId: string, file: Blob, filename: string): Promise<string> {
  assertRateLimit(`group-avatar:${chatId}`, 5, 60_000);
  assertAvatarMime(file.type || "");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Image must be under 5 MB");
  const ext = filename.includes(".") ? filename.split(".").pop() : guessExt(file.type) || "jpg";
  const path = `avatars/groups/${chatId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "60",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadAvatar(userId: string, file: Blob, filename: string): Promise<string> {
  assertRateLimit(`avatar:${userId}`, 5, 60_000);
  assertAvatarMime(file.type || "");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Image must be under 5 MB");
  const ext = filename.includes(".") ? filename.split(".").pop() : guessExt(file.type) || "jpg";
  const path = `avatars/${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "60",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
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
