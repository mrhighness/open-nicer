import { supabase } from "@/integrations/supabase/client";
import { orderedPair } from "@/lib/identity";

const BLOCKS_KEY = "nicer.blocks";
const MUTES_KEY = "nicer.mutes";

type SettingsCache = {
  blocked: Set<string>;
  muted: Set<string>;
  loaded: boolean;
};

let cache: SettingsCache = { blocked: new Set(), muted: new Set(), loaded: false };

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BLOCKS_KEY, JSON.stringify([...cache.blocked]));
  window.localStorage.setItem(MUTES_KEY, JSON.stringify([...cache.muted]));
}

function loadLocal() {
  if (typeof window === "undefined") return;
  try {
    const b = window.localStorage.getItem(BLOCKS_KEY);
    const m = window.localStorage.getItem(MUTES_KEY);
    if (b) cache.blocked = new Set(JSON.parse(b) as string[]);
    if (m) cache.muted = new Set(JSON.parse(m) as string[]);
  } catch {
    /* ignore */
  }
}

export async function loadChatSettings(meId: string) {
  loadLocal();
  const [{ data: blocks }, { data: mutes }] = await Promise.all([
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", meId),
    supabase.from("chat_mutes").select("peer_id").eq("user_id", meId),
  ]);
  cache.blocked = new Set((blocks ?? []).map((r) => r.blocked_id));
  cache.muted = new Set((mutes ?? []).map((r) => r.peer_id));
  cache.loaded = true;
  persist();
}

export function isPeerBlocked(peerId: string) {
  return cache.blocked.has(peerId);
}

export function isPeerMuted(peerId: string) {
  return cache.muted.has(peerId);
}

export function getBlockedPeerIds() {
  return [...cache.blocked];
}

export function getMutedPeerIds() {
  return [...cache.muted];
}

async function deleteChatsWithPeer(meId: string, peerId: string) {
  const [user_a, user_b] = orderedPair(meId, peerId);
  const { error } = await supabase.from("chats").delete().eq("user_a", user_a).eq("user_b", user_b);
  if (error) throw error;
}

export async function blockPeer(meId: string, peerId: string) {
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: meId, blocked_id: peerId },
    { onConflict: "blocker_id,blocked_id" }
  );
  if (error) throw error;
  cache.blocked.add(peerId);
  cache.muted.delete(peerId);
  persist();
  await deleteChatsWithPeer(meId, peerId);
}

export async function unblockPeer(meId: string, peerId: string) {
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", meId).eq("blocked_id", peerId);
  if (error) throw error;
  cache.blocked.delete(peerId);
  persist();
}

export async function mutePeer(meId: string, peerId: string) {
  const { error } = await supabase.from("chat_mutes").upsert(
    { user_id: meId, peer_id: peerId },
    { onConflict: "user_id,peer_id" }
  );
  if (error) throw error;
  cache.muted.add(peerId);
  persist();
}

export async function unmutePeer(meId: string, peerId: string) {
  const { error } = await supabase.from("chat_mutes").delete().eq("user_id", meId).eq("peer_id", peerId);
  if (error) throw error;
  cache.muted.delete(peerId);
  persist();
}

export async function deleteChats(meId: string, chatIds: string[]) {
  if (chatIds.length === 0) return;
  const { data: rows, error: fetchErr } = await supabase
    .from("chats")
    .select("id")
    .in("id", chatIds)
    .or(`user_a.eq.${meId},user_b.eq.${meId}`);
  if (fetchErr) throw fetchErr;
  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from("chats").delete().in("id", ids);
  if (error) throw error;
}

export async function blockPeers(meId: string, peerIds: string[]) {
  for (const peerId of peerIds) {
    await blockPeer(meId, peerId);
  }
}

export async function mutePeers(meId: string, peerIds: string[]) {
  for (const peerId of peerIds) {
    await mutePeer(meId, peerId);
  }
}
