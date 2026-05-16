import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_AUTH_KEY = "nicer.device.auth";
const AUTH_PROBE_KEY = "nicer.auth.probe";
const AUTH_PROBE_TTL_MS = 60 * 60 * 1000;

type DeviceCreds = { email: string; password: string };
type ProbeResult = { mode: AuthMode; at: number };

export type AuthMode = "anonymous" | "device" | "legacy";

let authMode: AuthMode = "legacy";
let sessionPromise: Promise<Session | null> | null = null;
let probeCache: ProbeResult | null = null;

export function getAuthMode(): AuthMode {
  return authMode;
}

export function hasSecureAuth(): boolean {
  return authMode !== "legacy";
}

function loadProbe(): ProbeResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_PROBE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProbeResult;
    if (Date.now() - parsed.at > AUTH_PROBE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProbe(mode: AuthMode) {
  const entry = { mode, at: Date.now() };
  probeCache = entry;
  window.localStorage.setItem(AUTH_PROBE_KEY, JSON.stringify(entry));
}

function loadDeviceCreds(): DeviceCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceCreds;
    if (parsed?.email && parsed?.password) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function saveDeviceCreds(creds: DeviceCreds) {
  window.localStorage.setItem(DEVICE_AUTH_KEY, JSON.stringify(creds));
}

function clearDeviceCreds() {
  window.localStorage.removeItem(DEVICE_AUTH_KEY);
}

function isAnonymousDisabled(error: { message?: string; status?: number }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return error.status === 422 || msg.includes("anonymous");
}

function isSignupBlocked(error: { message?: string; status?: number }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.status === 422 ||
    error.status === 429 ||
    msg.includes("signup") ||
    msg.includes("sign up") ||
    msg.includes("not allowed") ||
    msg.includes("rate limit")
  );
}

function isInvalidCredentials(error: { message?: string; status?: number }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return error.status === 400 || msg.includes("invalid") || msg.includes("credentials");
}

async function tryDeviceSession(): Promise<Session | null> {
  const stored = loadDeviceCreds();
  if (stored) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: stored.email,
      password: stored.password,
    });
    if (!error && data.session) {
      authMode = "device";
      return data.session;
    }
    if (error && (isInvalidCredentials(error) || isSignupBlocked(error))) {
      clearDeviceCreds();
    }
  }

  const cached = probeCache ?? loadProbe();
  if (cached?.mode === "legacy") return null;

  const email = `device-${crypto.randomUUID()}@noreply.nicer.local`;
  const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (!signUpError && signUpData.session) {
    saveDeviceCreds({ email, password });
    authMode = "device";
    saveProbe("device");
    return signUpData.session;
  }

  if (signUpError && isSignupBlocked(signUpError)) {
    saveProbe("legacy");
    return null;
  }

  if (!signUpError || !isSignupBlocked(signUpError)) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInError && signInData.session) {
      saveDeviceCreds({ email, password });
      authMode = "device";
      saveProbe("device");
      return signInData.session;
    }
  }

  return null;
}

async function resolveAuthSession(): Promise<Session | null> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) {
    authMode = existing.session.user.is_anonymous ? "anonymous" : "device";
    return existing.session;
  }

  const cached = probeCache ?? loadProbe();
  if (cached?.mode === "legacy") {
    authMode = "legacy";
    await supabase.auth.signOut();
    return null;
  }

  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
  if (!anonError && anonData.session) {
    authMode = "anonymous";
    saveProbe("anonymous");
    return anonData.session;
  }

  if (anonError && isAnonymousDisabled(anonError)) {
    saveProbe("legacy");
  } else if (anonError) {
    console.warn("Anonymous sign-in failed:", anonError.message);
  }

  const deviceSession = await tryDeviceSession();
  if (deviceSession) return deviceSession;

  authMode = "legacy";
  saveProbe("legacy");
  return null;
}

/**
 * Starts a Supabase Auth session for RLS (anonymous → device credentials → legacy).
 * Legacy mode uses anon RLS policies when auth providers are disabled in the dashboard.
 */
export async function ensureAuthSession(): Promise<Session | null> {
  if (!sessionPromise) {
    sessionPromise = resolveAuthSession().finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

/** @deprecated Use ensureAuthSession */
export const ensureAnonymousSession = ensureAuthSession;

export async function getAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export function resetAuthProbe() {
  probeCache = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_PROBE_KEY);
    clearDeviceCreds();
  }
}
