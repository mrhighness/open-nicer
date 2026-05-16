import { useServerPixazoProxy } from "@/lib/ai-server-flags";

import { AI_AVATAR_SYSTEM_PROMPT } from "@/lib/avatar-prompt";

import { uploadOnboardingPhoto } from "@/lib/uploads";

const AI_CHARACTER_PROMPT = AI_AVATAR_SYSTEM_PROMPT;



type PixazoQueued = {

  request_id: string;

  status: string;

  polling_url?: string;

};



type PixazoStatus = {

  request_id: string;

  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "ERROR";

  error?: string | null;

  output?: { media_url?: string[] };

};



function legacyPixazoKeyConfigured(): boolean {

  const v = import.meta.env.VITE_PIXAZO_API_KEY as string | undefined;

  return !!v?.trim() && v.trim().length > 8;

}



export function hasPixazoApiKey(): boolean {

  return useServerPixazoProxy() || legacyPixazoKeyConfigured();

}



async function queueGeneration(imageUrl: string): Promise<string> {

  const url = "/api/pixazo/generate";

  const res = await fetch(url, {

    method: "POST",

    headers: {

      "Content-Type": "application/json",

      "Cache-Control": "no-cache",

    },

    body: JSON.stringify({

      prompt: AI_CHARACTER_PROMPT,

      image_input: [imageUrl],

      aspect_ratio: "1:1",

      resolution: "1K",

      output_format: "png",

    }),

  });



  if (!res.ok) {

    const body = await res.text().catch(() => "");

    let message = body || `Pixazo request failed (${res.status})`;

    try {

      const j = JSON.parse(body) as { message?: string; error?: string };

      message = j.message || j.error || message;

    } catch {

      /* keep raw */

    }

    if (res.status === 402) message = "Pixazo wallet needs balance. Top up at pixazo.ai.";

    if (res.status === 503) message = "Pixazo is not configured on the server. Set PIXAZO_API_KEY and VITE_SERVER_AI_PIXAZO=1.";

    throw new Error(message);

  }



  const data = (await res.json()) as PixazoQueued;

  if (!data.request_id) throw new Error("Pixazo did not return a request id");

  return data.request_id;

}



async function pollStatus(requestId: string, signal?: AbortSignal): Promise<string> {

  const statusUrl = `/api/pixazo/status/${encodeURIComponent(requestId)}`;

  const deadline = Date.now() + 90_000;

  const interval = 2_000;



  while (Date.now() < deadline) {

    if (signal?.aborted) throw new Error("Cancelled");

    const res = await fetch(statusUrl, {

      headers: {

        "Content-Type": "application/json",

        "Cache-Control": "no-cache",

      },

      signal,

    });

    if (!res.ok) throw new Error(`Pixazo status failed (${res.status})`);

    const data = (await res.json()) as PixazoStatus;



    if (data.status === "COMPLETED") {

      const url = data.output?.media_url?.[0];

      if (!url) throw new Error("Pixazo completed without an image URL");

      return url;

    }

    if (data.status === "FAILED" || data.status === "ERROR") {

      throw new Error(data.error || "Pixazo generation failed");

    }

    await new Promise((r) => setTimeout(r, interval));

  }

  throw new Error("Pixazo took too long — try again");

}



async function downloadImage(url: string): Promise<Blob> {

  const res = await fetch(url);

  if (!res.ok) throw new Error("Could not download generated image");

  return res.blob();

}



/** Upload selfie → Pixazo image-to-image → PNG blob (fallback provider). */

export async function generateAiCharacterWithPixazo(

  userId: string,

  photo: File,

  signal?: AbortSignal

): Promise<Blob> {

  if (!hasPixazoApiKey()) {

    throw new Error("Pixazo is not configured (enable server proxy or dev key).");

  }



  const referenceUrl = await uploadOnboardingPhoto(userId, photo);

  const requestId = await queueGeneration(referenceUrl);

  const resultUrl = await pollStatus(requestId, signal);

  return downloadImage(resultUrl);

}


