/**
 * AI character avatars for onboarding.
 * Primary: DeepAI → Fallback: Pixazo → Final: local stylize (always works offline).
 */

import { stylizePhotoLocally } from "@/lib/avatar-stylize";
import { generateAiCharacterWithDeepAi, hasDeepAiApiKey } from "@/lib/deepai";
import { generateAiCharacterWithPixazo, hasPixazoApiKey } from "@/lib/pixazo";

export type AvatarGenerationSource = "deepai" | "pixazo" | "local";

export function hasAiAvatarApiKey(): boolean {
  return hasDeepAiApiKey() || hasPixazoApiKey();
}

export function getAiAvatarProvider(): "deepai" | "pixazo" | null {
  if (hasDeepAiApiKey()) return "deepai";
  if (hasPixazoApiKey()) return "pixazo";
  return null;
}

function isCreditsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /402|credit|balance|insufficient/i.test(msg);
}

/** Upload selfie → AI character PNG (never the raw photo as the final avatar). */
export async function generateAiCharacterFromPhoto(
  userId: string,
  photo: File,
  signal?: AbortSignal
): Promise<{ blob: Blob; source: AvatarGenerationSource }> {
  const errors: string[] = [];

  if (hasDeepAiApiKey()) {
    try {
      const blob = await generateAiCharacterWithDeepAi(userId, photo, signal);
      return { blob, source: "deepai" };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      console.warn("DeepAI avatar failed:", e);
    }
  }

  if (hasPixazoApiKey()) {
    try {
      const blob = await generateAiCharacterWithPixazo(userId, photo, signal);
      return { blob, source: "pixazo" };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      console.warn("Pixazo avatar failed:", e);
    }
  }

  try {
    const blob = await stylizePhotoLocally(photo);
    return { blob, source: "local" };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const creditsHint = errors.some(isCreditsError)
    ? " Add credits to your DeepAI or Pixazo account for full AI generation."
    : "";
  throw new Error(
    (errors[0] || "Avatar generation failed") + creditsHint
  );
}
