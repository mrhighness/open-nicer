import { PRODUCT } from "@/lib/product";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InviteProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string | null;
  bio: string | null;
  allow_incoming_messages: boolean;
};

export function isValidProfileId(id: string) {
  return UUID_RE.test(id);
}

export function profileInvitePath(userId: string) {
  return `/u/${userId}`;
}

export function getSiteOrigin(fallback?: string) {
  if (typeof window !== "undefined") return window.location.origin;
  const env = import.meta.env.VITE_APP_URL as string | undefined;
  return (fallback || env || "").replace(/\/$/, "");
}

export function profileInviteUrl(userId: string, origin?: string) {
  const base = getSiteOrigin(origin);
  const path = profileInvitePath(userId);
  return base ? `${base}${path}` : path;
}

export function inviteOgImage(avatarUrl: string | null, origin: string) {
  if (avatarUrl?.startsWith("http")) return avatarUrl;
  if (avatarUrl && origin) return `${origin}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
  return origin ? `${origin}${PRODUCT.logoUrl}` : PRODUCT.logoUrl;
}

/** First name for friendlier invite copy (e.g. "James" from "James Smith"). */
export function inviteFirstName(username: string) {
  const trimmed = username.trim();
  if (!trimmed) return "Your friend";
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

export function inviteFriendHeadline(username: string) {
  const name = inviteFirstName(username);
  return `Your friend ${name} invited you to join ${PRODUCT.name}`;
}

export function inviteFriendSubtext(username: string) {
  const name = inviteFirstName(username);
  return `${name} wants to chat with you on ${PRODUCT.name} — free, instant, and no sign-up required.`;
}

export function inviteOgTitle(username: string) {
  return inviteFriendHeadline(username);
}

export function inviteShareText() {
  return PRODUCT.inviteShareText;
}

export function inviteSharePayload(url: string, username?: string) {
  const lead = username?.trim()
    ? inviteFriendHeadline(username)
    : PRODUCT.inviteShareText;
  return `${lead}\n${url}`;
}

export function inviteOgDescription(username: string, status: string | null, bio?: string | null) {
  const friendLine = inviteFriendSubtext(username);
  const snippet = bio?.trim() || status?.trim();
  if (snippet) return `${snippet} · ${friendLine}`;
  return friendLine;
}
