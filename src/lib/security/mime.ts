import type { AttachmentKind } from "@/lib/uploads";

const ALLOWED: Record<AttachmentKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"],
  file: [
    "application/pdf",
    "text/plain",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const AVATAR_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function assertAllowedMime(kind: AttachmentKind, mime: string): void {
  const t = (mime || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED[kind].includes(t)) {
    throw new Error(`File type not allowed for ${kind} uploads.`);
  }
}

export function assertAvatarMime(mime: string): void {
  const t = (mime || "").toLowerCase().split(";")[0].trim();
  if (!AVATAR_MIMES.includes(t as (typeof AVATAR_MIMES)[number])) {
    throw new Error("Avatar must be JPEG, PNG, WebP, or GIF.");
  }
}
