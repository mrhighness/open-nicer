import { createFileRoute } from "@tanstack/react-router";
import {
  checkServerRateLimit,
  getRequestClientIp,
  rateLimitResponse,
  readJsonBody,
} from "@/lib/security/server-proxy";

const UPSTREAM = "https://api.deepai.org/api/image-editor";
const BODY_MAX = 140_000;

export const Route = createFileRoute("/api/deepai/image-editor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getRequestClientIp(request);
        if (!checkServerRateLimit(`deepai:${ip}`, 40, 15 * 60_000)) return rateLimitResponse();

        const key = (process.env.DEEPAI_API_KEY || process.env.VITE_DEEPAI_API_KEY)?.trim();
        if (!key) {
          return new Response(JSON.stringify({ err: "DeepAI is not configured on the server." }), {
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
            return new Response(JSON.stringify({ err: "Payload too large" }), {
              status: 413,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ err: "Invalid request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const res = await fetch(UPSTREAM, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": key,
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
