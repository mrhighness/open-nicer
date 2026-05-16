import { supabase } from "@/integrations/supabase/client";
import { ensureAuthSession } from "@/lib/security/session";
import { getAuthMode } from "@/lib/security/session";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { resetBootstrapApp, setStoredMe } from "@/lib/identity";
import { completeOnboarding } from "@/lib/onboarding";

export type RetentionBootstrap = {
  retention_public_id: number;
  pin_set: boolean;
};

function parseBootstrap(data: unknown): RetentionBootstrap {
  const o = data as { retention_public_id?: number; pin_set?: boolean };
  return {
    retention_public_id: Number(o.retention_public_id),
    pin_set: Boolean(o.pin_set),
  };
}

/** Load 5-digit account ID + whether a Nicer PIN is already set (requires migration on DB). */
export async function fetchRetentionBootstrap(
  profileId: string,
  claimToken: string | null
): Promise<RetentionBootstrap | null> {
  await ensureAuthSession();
  if (getAuthMode() !== "legacy") {
    const { data, error } = await supabase.rpc("retention_bootstrap_my_code");
    if (!error && data) return parseBootstrap(data);
    return null;
  }
  if (!claimToken) return null;
  const { data, error } = await supabase.rpc("retention_bootstrap_code_claim", {
    p_profile_id: profileId,
    p_claim_token: claimToken,
  });
  if (!error && data) return parseBootstrap(data);
  return null;
}

export async function activateRetentionPin(opts: {
  pin: string;
  oldPin?: string | null;
  profileId: string;
  claimToken: string | null;
}): Promise<{ retention_public_id: number }> {
  assertRateLimit(`retention_pin:${opts.profileId}`, 25, 60_000, "Too many PIN attempts");
  await ensureAuthSession();
  const oldPin = opts.oldPin ?? null;
  const legacy = getAuthMode() === "legacy";
  if (legacy && !opts.claimToken) {
    throw new Error("missing_claim");
  }
  const r = legacy
    ? await supabase.rpc("retention_activate_pin_claim", {
        p_profile_id: opts.profileId,
        p_claim_token: opts.claimToken as string,
        p_pin: opts.pin,
        p_old_pin: oldPin,
      })
    : await supabase.rpc("retention_activate_pin", { p_pin: opts.pin, p_old_pin: oldPin });
  if (r.error) throw r.error;
  const row = r.data as { retention_public_id?: number };
  return { retention_public_id: Number(row.retention_public_id) };
}

/**
 * Sign in to a previously retained account (Account ID + Nicer PIN).
 * Completes onboarding flag, stores profile id + claim token, reloads the app.
 */
export async function recoverAccountByRetention(retentionPublicId: number, pin: string): Promise<void> {
  assertRateLimit(`retention_recover:${retentionPublicId}`, 15, 60_000, "Too many recovery attempts");
  await ensureAuthSession();
  const legacy = getAuthMode() === "legacy";
  const { data, error } = legacy
    ? await supabase.rpc("retention_recover_claim", {
        p_public_id: retentionPublicId,
        p_pin: pin,
      })
    : await supabase.rpc("retention_recover_swap", {
        p_public_id: retentionPublicId,
        p_pin: pin,
      });
  if (error) throw error;
  const o = data as { profile_id?: string; claim_token?: string };
  if (!o.profile_id || !o.claim_token) {
    throw new Error("invalid_recovery_response");
  }
  completeOnboarding();
  setStoredMe(o.profile_id, o.claim_token);
  resetBootstrapApp();
  window.location.reload();
}

export function retentionErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code).toUpperCase() : "";
  const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : String(err);
  const lower = msg.toLowerCase();
  if (code === "PGRST202" || code === "42883" || lower.includes("could not find the function")) {
    return "Account retention is not enabled on the server yet. Apply the latest Supabase migration (account retention), then try again.";
  }
  if (lower.includes("requested path is invalid") || lower.includes("not found") && lower.includes("rpc")) {
    return "Account retention is not enabled on the server yet. Apply the latest Supabase migration (account retention), then try again.";
  }
  if (lower.includes("invalid_credentials")) return "Wrong Account ID or Nicer PIN.";
  if (lower.includes("locked")) return "Too many attempts. Try again in about 15 minutes.";
  if (lower.includes("invalid_pin_format")) return "PIN must be exactly 4 digits.";
  if (lower.includes("wrong_old_pin")) return "Current PIN is incorrect.";
  if (lower.includes("invalid_claim")) return "Could not verify this device. Reload and try again.";
  if (lower.includes("not_authenticated")) return "Session not ready. Try again in a moment.";
  if (lower.includes("could not find")) return "Account recovery is not available yet. Apply the latest database migration.";
  return msg.slice(0, 160) || "Something went wrong.";
}
