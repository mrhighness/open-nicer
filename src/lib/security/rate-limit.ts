type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple client-side throttle to reduce accidental / scripted spam. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

export function assertRateLimit(key: string, max: number, windowMs: number, label = "Slow down"): void {
  if (!rateLimit(key, max, windowMs)) {
    throw new Error(`${label} — try again in a moment.`);
  }
}
