import { supabase } from "@/integrations/supabase/client";

const ME_KEY = "nicer.me.id";

// Curated palette of fun usernames
const ADJECTIVES = ["Cosmic", "Neon", "Velvet", "Lunar", "Electric", "Mystic", "Royal", "Stellar", "Crimson", "Sonic", "Wild", "Silent"];
const NOUNS = ["Fox", "Phoenix", "Tiger", "Wolf", "Orchid", "Falcon", "Comet", "Panda", "Raven", "Lynx", "Otter", "Koi"];

export function pickRandomUsername() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${a}${n}${num}`;
}

export function pickRandomAvatar(seed: string) {
  // DiceBear avatars — colorful, deterministic
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export function getStoredMeId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ME_KEY);
}

export function setStoredMeId(id: string) {
  window.localStorage.setItem(ME_KEY, id);
}

export async function getOrCreateMe() {
  let id = getStoredMeId();
  if (id) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) return data;
  }
  const username = pickRandomUsername();
  const avatar_url = pickRandomAvatar(username);
  const { data, error } = await supabase
    .from("profiles")
    .insert({ username, avatar_url, is_online: true })
    .select()
    .single();
  if (error) throw error;
  setStoredMeId(data.id);
  return data;
}

export async function updateMyProfile(meId: string, patch: { username?: string; avatar_url?: string; status?: string }) {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", meId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
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
  const { data, error } = await supabase
    .from("chats")
    .insert({ user_a, user_b })
    .select()
    .single();
  if (error) throw error;
  return data;
}
