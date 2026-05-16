import { supabase } from "@/integrations/supabase/client";

const GEO_PATH = "/api/geo";

/** Best-effort: record browser string + optional IP/country once per profile (RPC no-ops if duplicate). */
export async function recordSignupClientInfo(): Promise<void> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  const ua = navigator.userAgent ?? "";
  let ip: string | null = null;
  let country: string | null = null;
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(GEO_PATH, { signal: ctrl.signal });
    window.clearTimeout(t);
    if (res.ok) {
      const j = (await res.json()) as { ip?: string; country_name?: string };
      ip = typeof j.ip === "string" ? j.ip : null;
      country = typeof j.country_name === "string" ? j.country_name : null;
    }
  } catch {
    /* ignore geo failures */
  }
  const { error } = await supabase.rpc("record_signup_client_info", {
    p_user_agent: ua.slice(0, 4000),
    p_ip: ip,
    p_country: country,
  });
  if (error) console.warn("record_signup_client_info:", error.message);
}
