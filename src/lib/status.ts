import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

export type StatusItem = {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  expires_at: string;
};

export type StatusGroup = {
  user: Profile;
  items: StatusItem[];
  viewed: boolean;
  latestAt: string;
};

export async function createStatusUpdate(userId: string, imageUrl: string): Promise<StatusItem> {
  const { data, error } = await supabase
    .from("status_updates")
    .insert({ user_id: userId, image_url: imageUrl })
    .select()
    .single();
  if (error) throw error;
  return data as StatusItem;
}

export async function deleteStatusUpdate(id: string, userId: string) {
  const { error } = await supabase.from("status_updates").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function listStatusGroups(meId: string): Promise<StatusGroup[]> {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("status_updates")
    .select("id, user_id, image_url, created_at, expires_at")
    .gt("expires_at", now)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!rows?.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

  const statusIds = rows.map((r) => r.id);
  const { data: views } = await supabase
    .from("status_views")
    .select("status_id")
    .eq("viewer_id", meId)
    .in("status_id", statusIds);
  const viewedSet = new Set((views ?? []).map((v) => v.status_id));

  const byUser = new Map<string, StatusItem[]>();
  for (const row of rows) {
    const item = row as StatusItem;
    const list = byUser.get(item.user_id) ?? [];
    list.push(item);
    byUser.set(item.user_id, list);
  }

  const groups: StatusGroup[] = [];
  for (const [userId, items] of byUser) {
    const user = profileMap.get(userId);
    if (!user) continue;
    const viewed = items.every((i) => viewedSet.has(i.id));
    groups.push({
      user,
      items,
      viewed,
      latestAt: items[items.length - 1].created_at,
    });
  }

  groups.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  return groups;
}

export async function markStatusViewed(statusIds: string[], viewerId: string) {
  if (statusIds.length === 0) return;
  const rows = statusIds.map((status_id) => ({ status_id, viewer_id: viewerId }));
  const { error } = await supabase.from("status_views").upsert(rows, {
    onConflict: "status_id,viewer_id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export function getMyStatusGroup(groups: StatusGroup[], meId: string): StatusGroup | null {
  return groups.find((g) => g.user.id === meId) ?? null;
}

export function getOthersStatusGroups(groups: StatusGroup[], meId: string): StatusGroup[] {
  return groups.filter((g) => g.user.id !== meId);
}
