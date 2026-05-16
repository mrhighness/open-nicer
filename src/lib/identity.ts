import { supabase } from "@/integrations/supabase/client";
import { PRODUCT } from "@/lib/product";
import { ensureAuthSession, getAuthMode, hasSecureAuth } from "@/lib/security/session";
import { parseOrThrow, profilePatchSchema } from "@/lib/security/validation";
import { sanitizeUsername } from "@/lib/security/sanitize";
import { isValidProfileId } from "@/lib/share";
import { consumeReferrerProfileId } from "@/lib/referrer";

const ME_KEY = "nicer.me.id";
const CLAIM_KEY = "nicer.me.claim";

const ADJECTIVES = ["Cosmic", "Neon", "Velvet", "Lunar", "Electric", "Mystic", "Royal", "Stellar", "Crimson", "Sonic", "Wild", "Silent"];
const NOUNS = ["Fox", "Phoenix", "Tiger", "Wolf", "Orchid", "Falcon", "Comet", "Panda", "Raven", "Lynx", "Otter", "Koi"];

export function pickRandomUsername() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${a}${n}${num}`;
}

export function pickRandomAvatar(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export function getStoredMeId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ME_KEY);
}

export function getStoredClaimToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAIM_KEY);
}

export function clearStoredMeLocal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ME_KEY);
  window.localStorage.removeItem(CLAIM_KEY);
}

export function setStoredMe(id: string, claimToken?: string | null) {
  window.localStorage.setItem(ME_KEY, id);
  if (claimToken) window.localStorage.setItem(CLAIM_KEY, claimToken);
}

async function resolveInvitedByProfileId(): Promise<string | undefined> {
  const invitedRaw = consumeReferrerProfileId();
  if (!invitedRaw || !isValidProfileId(invitedRaw)) return undefined;
  const { data: refP } = await supabase.from("profiles").select("id").eq("id", invitedRaw).maybeSingle();
  return refP?.id;
}

async function getOrCreateMeWithAuth(authId: string) {
  const { data: byAuth } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (byAuth) {
    setStoredMe(byAuth.id);
    return byAuth;
  }

  const storedId = getStoredMeId();
  const claimToken = getStoredClaimToken();
  if (storedId && claimToken) {
    const { data: claimed, error: claimErr } = await supabase
      .from("profiles")
      .update({ auth_user_id: authId })
      .eq("id", storedId)
      .eq("claim_token", claimToken)
      .is("auth_user_id", null)
      .select()
      .maybeSingle();
    if (!claimErr && claimed) {
      setStoredMe(claimed.id);
      return claimed;
    }
  }

  if (storedId) {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", storedId).maybeSingle();
    if (existing?.auth_user_id === authId) {
      setStoredMe(existing.id);
      return existing;
    }
  }

  const username = pickRandomUsername();
  const avatar_url = pickRandomAvatar(username);
  const invited_by = await resolveInvitedByProfileId();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      username,
      avatar_url,
      status: PRODUCT.inviteShareText,
      is_online: true,
      discoverable: true,
      allow_incoming_messages: true,
      show_online_status: true,
      auth_user_id: authId,
      invited_by,
    })
    .select()
    .single();
  if (error) throw error;
  setStoredMe(data.id, data.claim_token ?? null);
  return data;
}

/** Original no-auth flow — works when RLS is still permissive (demo mode). */
async function getOrCreateMeLegacy() {
  let id = getStoredMeId();
  if (id) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) return data;
  }

  const username = pickRandomUsername();
  const avatar_url = pickRandomAvatar(username);
  const invited_by = await resolveInvitedByProfileId();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      username,
      avatar_url,
      status: PRODUCT.inviteShareText,
      is_online: true,
      discoverable: true,
      allow_incoming_messages: true,
      show_online_status: true,
      invited_by,
    })
    .select()
    .single();
  if (error) throw error;
  setStoredMe(data.id, data.claim_token ?? null);
  return data;
}

let bootstrapPromise: ReturnType<typeof getOrCreateMe> | null = null;

/** Clears cached bootstrap (e.g. after account retention recovery + full reload). */
export function resetBootstrapApp() {
  bootstrapPromise = null;
}

/** Single shared app init — used by splash + useMe. */
export function bootstrapApp() {
  if (!bootstrapPromise) bootstrapPromise = getOrCreateMe();
  return bootstrapPromise;
}

export async function getOrCreateMe() {
  const session = await ensureAuthSession();
  const authId = session?.user.id ?? null;

  if (authId && hasSecureAuth()) {
    try {
      return await getOrCreateMeWithAuth(authId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "";
      if (
        msg.includes("row-level security") ||
        msg.includes("permission") ||
        msg.includes("42501") ||
        code === "42501" ||
        code === "PGRST301"
      ) {
        console.warn("Auth profile blocked by RLS, falling back to legacy mode:", msg);
        return getOrCreateMeLegacy();
      }
      throw e;
    }
  }

  if (authId && getAuthMode() !== "legacy") {
    return getOrCreateMeWithAuth(authId);
  }

  return getOrCreateMeLegacy();
}

export async function updateMyProfile(
  meId: string,
  patch: {
    username?: string;
    avatar_url?: string;
    status?: string;
    bio?: string | null;
    discoverable?: boolean;
    allow_incoming_messages?: boolean;
    show_online_status?: boolean;
  }
) {
  const safe = parseOrThrow(profilePatchSchema, {
    ...patch,
    username: patch.username !== undefined ? sanitizeUsername(patch.username) : undefined,
  });
  const { data, error } = await supabase.from("profiles").update(safe).eq("id", meId).select().single();
  if (error) throw error;
  return data;
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getExistingDirectChatId(meId: string, otherId: string): Promise<string | null> {
  const [user_a, user_b] = orderedPair(meId, otherId);
  const { data } = await supabase.from("chats").select("id").eq("user_a", user_a).eq("user_b", user_b).maybeSingle();
  return data?.id ?? null;
}

export async function getOrCreateChatWith(meId: string, otherId: string) {
  const [user_a, user_b] = orderedPair(meId, otherId);
  const { data: existing } = await supabase
    .from("chats")
    .select("*")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (existing) return existing;

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("allow_incoming_messages, username")
    .eq("id", otherId)
    .maybeSingle();
  if (otherProfile && otherProfile.allow_incoming_messages === false) {
    throw new Error(`${otherProfile.username} isn't accepting new messages right now`);
  }

  const { data, error } = await supabase.from("chats").insert({ user_a, user_b }).select().single();
  if (error) throw error;
  return data;
}
