/** DeepAI avatar generation — https://deepai.org/docs (API key stays on the server). */

import { useServerDeepAiProxy } from "@/lib/ai-server-flags";
import { AI_AVATAR_SYSTEM_PROMPT } from "@/lib/avatar-prompt";
import { uploadOnboardingPhoto } from "@/lib/uploads";

const IMAGE_EDITOR_PATH = "/api/deepai/image-editor";

export const DEEPAI_AVATAR_PROMPT = AI_AVATAR_SYSTEM_PROMPT;

type DeepAiResponse = {
  id?: string;
  output_url?: string;
  err?: string;
  status?: string;
};

function legacyClientKeyConfigured(): boolean {
  const v = import.meta.env.VITE_DEEPAI_API_KEY as string | undefined;
  return !!v?.trim() && v.trim().length > 8;
}

export function hasDeepAiApiKey(): boolean {
  return useServerDeepAiProxy() || legacyClientKeyConfigured();
}

function parseApiError(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as { err?: string; status?: string; message?: string };
    if (j.err) return j.err;
    if (j.message) return j.message;
    if (j.status) return j.status;
  } catch {
    /* plain text */
  }
  if (status === 402) return "DeepAI account needs credits (add balance at deepai.org).";
  if (status === 401) return "Invalid DeepAI API key.";
  if (status === 503) return "DeepAI is not configured on the server. Set DEEPAI_API_KEY and VITE_SERVER_AI_DEEPAI=1.";
  return body || `DeepAI request failed (${status})`;
}

async function downloadImage(url: string, signal?: AbortSignal): Promise<Blob> {
  try {
    const res = await fetch(url, { signal, mode: "cors" });
    if (res.ok) return res.blob();
  } catch {
    /* canvas fallback */
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not download generated image from DeepAI"));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not download generated image from DeepAI"))),
        "image/png"
      );
    };
    img.onerror = () => reject(new Error("Could not download generated image from DeepAI"));
    if (signal) {
      signal.addEventListener("abort", () => reject(new Error("Cancelled")), { once: true });
    }
    img.src = url;
  });
}

/** Selfie + prompt → stylized avatar via DeepAI Photo Editor API. */
export async function generateAiCharacterWithDeepAi(
  userId: string,
  photo: File,
  signal?: AbortSignal
): Promise<Blob> {
  if (!hasDeepAiApiKey()) {
    throw new Error("DeepAI is not configured (enable server proxy or dev key).");
  }

  const referenceUrl = await uploadOnboardingPhoto(userId, photo);

  const res = await fetch(IMAGE_EDITOR_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: referenceUrl,
      text: DEEPAI_AVATAR_PROMPT,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(parseApiError(res.status, body));
  }

  const data = (await res.json()) as DeepAiResponse;
  if (!data.output_url) {
    throw new Error(data.err || data.status || "DeepAI did not return an image URL");
  }

  return downloadImage(data.output_url, signal);
}
