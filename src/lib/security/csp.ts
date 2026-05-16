/**
 * Content-Security-Policy connect-src (no blanket https: — reduces XSS data exfil surface).
 * Image/media fetches to arbitrary https hosts still use img-src/media-src where applicable.
 */
export function buildConnectSrcDirective(supabaseOrigin?: string): string {
  const parts = new Set<string>(["'self'", "https://api.dicebear.com", "https://*.deepai.org", "https://gateway.pixazo.ai"]);

  if (supabaseOrigin) {
    try {
      const u = new URL(supabaseOrigin);
      parts.add(`${u.protocol}//${u.host}`);
      if (u.protocol === "https:") {
        parts.add(`wss://${u.host}`);
      }
    } catch {
      /* ignore */
    }
  }

  parts.add("https://*.supabase.co");
  parts.add("wss://*.supabase.co");

  return Array.from(parts).join(" ");
}
