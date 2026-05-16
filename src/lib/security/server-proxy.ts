/** Shared helpers for same-origin API proxies (TanStack Start server routes). */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function getRequestClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Simple per-isolate rate limit (reduces scripted abuse of paid upstream APIs). */
export function checkServerRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

export function rateLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error("payload_too_large");
  }
  const text = new TextDecoder().decode(buf);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}
