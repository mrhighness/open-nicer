import { createFileRoute } from "@tanstack/react-router";
import {
  checkServerRateLimit,
  getRequestClientIp,
  rateLimitResponse,
  readJsonBody,
} from "@/lib/security/server-proxy";

const BODY_MAX = 220_000;

function pixazoUpstreamGenerate(): string {
  const gateway =
    process.env.PIXAZO_GATEWAY_URL?.replace(/\/$/, "") ||
    process.env.VITE_PIXAZO_GATEWAY_URL?.replace(/\/$/, "") ||
    "https://gateway.pixazo.ai";
  const model =
    process.env.PIXAZO_MODEL?.trim() || process.env.VITE_PIXAZO_MODEL?.trim() || "nano-banana-2";
  return `${gateway}/${model}/v1/${model}/generate`;
}

export const Route = createFileRoute("/api/pixazo/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getRequestClientIp(request);
        if (!checkServerRateLimit(`pixazo-gen:${ip}`, 30, 15 * 60_000)) return rateLimitResponse();

        const key = (process.env.PIXAZO_API_KEY || process.env.VITE_PIXAZO_API_KEY)?.trim();
        if (!key) {
          return new Response(JSON.stringify({ message: "Pixazo is not configured on the server." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: unknown;
        try {
          body = await readJsonBody(request, BODY_MAX);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg === "payload_too_large") {
            return new Response(JSON.stringify({ message: "Payload too large" }), {
              status: 413,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ message: "Invalid request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const res = await fetch(pixazoUpstreamGenerate(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Ocp-Apim-Subscription-Key": key,
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: {
            "Content-Type": res.headers.get("content-type") || "application/json",
          },
        });
      },
    },
  },
});
