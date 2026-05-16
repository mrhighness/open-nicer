import { PRODUCT } from "@/lib/product";
import { inviteFriendHeadline, inviteSharePayload, profileInviteUrl } from "@/lib/share";

export type ShareInviteResult = "shared" | "copied" | "cancelled" | "unavailable";

export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Opens the device share sheet (WhatsApp, Messages, Instagram, etc.). */
export async function shareProfileInvite(opts: {
  userId: string;
  username?: string;
}): Promise<ShareInviteResult> {
  const url = profileInviteUrl(opts.userId);
  const name = opts.username?.trim() ?? "";
  const title = name ? inviteFriendHeadline(name) : `Join me on ${PRODUCT.name}`;
  const combined = inviteSharePayload(url, name || undefined);
  const text = combined.split("\n")[0] ?? title;

  if (!canUseNativeShare()) return "unavailable";

  const attempts: ShareData[] = [
    { title, text: combined },
    { title, text, url },
    { text: combined },
    { url },
  ];

  for (const data of attempts) {
    try {
      if (navigator.canShare && !navigator.canShare(data)) continue;
      await navigator.share(data);
      return "shared";
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") return "cancelled";
    }
  }

  return "unavailable";
}

export type SocialShareOption = {
  id: string;
  label: string;
  href: string;
  color: string;
};

export function getSocialShareOptions(userId: string, username?: string): SocialShareOption[] {
  const url = profileInviteUrl(userId);
  const text = username?.trim() ? inviteFriendHeadline(username) : `Join me on ${PRODUCT.name}`;
  const body = encodeURIComponent(inviteSharePayload(url, username));
  const urlEnc = encodeURIComponent(url);
  const textEnc = encodeURIComponent(text);

  return [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${body}`,
      color: "from-[#25D366] to-[#128C7E]",
    },
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${urlEnc}&text=${textEnc}`,
      color: "from-[#2AABEE] to-[#229ED9]",
    },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${urlEnc}&quote=${textEnc}`,
      color: "from-[#1877F2] to-[#0C63D4]",
    },
    {
      id: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${body}`,
      color: "from-[#14171A] to-[#3A3A3A]",
    },
    {
      id: "sms",
      label: "Messages",
      href: `sms:?&body=${body}`,
      color: "from-[#34C759] to-[#30B350]",
    },
    {
      id: "email",
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(`Chat on ${PRODUCT.name}`)}&body=${body}`,
      color: "from-[#FF9500] to-[#FF6B00]",
    },
  ];
}

export async function copyProfileInvite(userId: string, username?: string): Promise<void> {
  const url = profileInviteUrl(userId);
  await navigator.clipboard.writeText(inviteSharePayload(url, username));
}
