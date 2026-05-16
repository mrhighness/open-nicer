import { supabase } from "@/integrations/supabase/client";

export type AdminStats = {
  user_count: number;
  group_count: number;
  suspended_count: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string | null;
  bio: string | null;
  created_at: string;
  suspended_at: string | null;
  invited_by: string | null;
  auth_user_id: string | null;
  email: string | null;
  user_agent: string | null;
  ip: string | null;
  country: string | null;
  invite_count: number;
};

export type AdminGroupRow = {
  id: string;
  title: string | null;
  created_at: string;
  member_count: number;
};

export async function rpcAdminStats(): Promise<AdminStats | null> {
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) {
    console.error(error);
    return null;
  }
  const o = data as Record<string, number>;
  return {
    user_count: Number(o.user_count ?? 0),
    group_count: Number(o.group_count ?? 0),
    suspended_count: Number(o.suspended_count ?? 0),
  };
}

export async function rpcAdminListUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as AdminUserRow[];
}

export async function rpcAdminListGroups(): Promise<AdminGroupRow[]> {
  const { data, error } = await supabase.rpc("admin_list_groups");
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as AdminGroupRow[];
}

export async function rpcAdminUpdateProfile(
  id: string,
  patch: { username?: string; avatar_url?: string; bio?: string }
): Promise<boolean> {
  const { error } = await supabase.rpc("admin_update_profile", {
    p_id: id,
    p_username: patch.username ?? null,
    p_avatar_url: patch.avatar_url ?? null,
    p_bio: patch.bio ?? null,
  });
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

export async function rpcAdminSetSuspended(id: string, suspend: boolean): Promise<boolean> {
  const { error } = await supabase.rpc("admin_set_suspended", { p_id: id, p_suspend: suspend });
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

export async function rpcAdminDeleteProfiles(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await supabase.rpc("admin_delete_profiles", { p_ids: ids });
  if (error) {
    console.error(error);
    return 0;
  }
  return typeof data === "number" ? data : Number(data) || 0;
}

export async function rpcAdminDeleteGroups(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await supabase.rpc("admin_delete_groups", { p_ids: ids });
  if (error) {
    console.error(error);
    return 0;
  }
  return typeof data === "number" ? data : Number(data) || 0;
}

export async function rpcIsAppAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_app_admin");
  if (error) {
    console.error(error);
    return false;
  }
  return Boolean(data);
}
