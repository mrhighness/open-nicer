import { createFileRoute } from "@tanstack/react-router";
import {
  checkServerRateLimit,
  getRequestClientIp,
  rateLimitResponse,
} from "@/lib/security/server-proxy";

const GEO_UPSTREAM = "https://ipapi.co/json/";

export const Route = createFileRoute("/api/geo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ip = getRequestClientIp(request);
        if (!checkServerRateLimit(`geo:${ip}`, 40, 60 * 60_000)) return rateLimitResponse();

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4500);
        try {
          const res = await fetch(GEO_UPSTREAM, { signal: ctrl.signal });
          const text = await res.text();
          return new Response(text, {
            status: res.status,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        } catch {
          return new Response(JSON.stringify({ ip: null, country_name: null }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } finally {
          clearTimeout(t);
        }
      },
    },
  },
});
