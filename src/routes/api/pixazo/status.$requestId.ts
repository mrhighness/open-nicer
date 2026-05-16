import { createFileRoute } from "@tanstack/react-router";
import {
  checkServerRateLimit,
  getRequestClientIp,
  rateLimitResponse,
} from "@/lib/security/server-proxy";

function pixazoStatusUrl(requestId: string): string {
  const gateway =
    process.env.PIXAZO_GATEWAY_URL?.replace(/\/$/, "") ||
    process.env.VITE_PIXAZO_GATEWAY_URL?.replace(/\/$/, "") ||
    "https://gateway.pixazo.ai";
  return `${gateway}/v2/requests/status/${encodeURIComponent(requestId)}`;
}

export const Route = createFileRoute("/api/pixazo/status/$requestId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ip = getRequestClientIp(request);
        if (!checkServerRateLimit(`pixazo-status:${ip}`, 120, 15 * 60_000)) return rateLimitResponse();

        const key = (process.env.PIXAZO_API_KEY || process.env.VITE_PIXAZO_API_KEY)?.trim();
        if (!key) {
          return new Response(JSON.stringify({ message: "Pixazo is not configured on the server." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const requestId = params.requestId;
        if (!requestId || requestId.length > 200) {
          return new Response(JSON.stringify({ message: "Invalid request id" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const res = await fetch(pixazoStatusUrl(requestId), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Ocp-Apim-Subscription-Key": key,
          },
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
