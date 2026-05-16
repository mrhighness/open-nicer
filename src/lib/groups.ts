import { supabase } from "@/integrations/supabase/client";
import { assertChatMember } from "@/lib/chats";
import type { Profile } from "@/lib/types";

export type GroupMemberRole = "owner" | "admin" | "member";

export type GroupMember = Profile & {
  role: GroupMemberRole;
  joined_at: string;
};

export function isGroupAdmin(role: GroupMemberRole | null | undefined) {
  return role === "owner" || role === "admin";
}
function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export type GroupChatRow = {
  id: string;
  chat_type: string;
  title: string | null;
  description: string | null;
  created_by: string | null;
  invite_code: string | null;
  avatar_url: string | null;
  created_at: string;
  group_members_can_start_calls?: boolean;
};

export async function createGroup(opts: {
  meId: string;
  memberIds: string[];
  title: string;
  description: string;
}): Promise<{ chatId: string; inviteCode: string }> {
  const uniqueMembers = [...new Set([opts.meId, ...opts.memberIds])];
  const inviteCode = randomInviteCode();

  const { data: chat, error } = await supabase
    .from("chats")
    .insert({
      chat_type: "group",
      title: opts.title.trim(),
      description: opts.description.trim() || null,
      created_by: opts.meId,
      invite_code: inviteCode,
      user_a: opts.meId,
      user_b: opts.meId,
    })
    .select("id, invite_code")
    .single();

  if (error) throw error;

  const rows = uniqueMembers.map((profileId) => ({
    chat_id: chat.id,
    profile_id: profileId,
    role: profileId === opts.meId ? "owner" : "member",
  }));

  const { error: memErr } = await supabase.from("chat_members").insert(rows);
  if (memErr) throw memErr;

  const added = uniqueMembers.filter((id) => id !== opts.meId);
  if (added.length) {
    await notifyUsersAddedToGroup(chat.id, opts.title.trim(), added);
  }

  return { chatId: chat.id, inviteCode: chat.invite_code ?? inviteCode };
}

export async function notifyUsersAddedToGroup(chatId: string, groupTitle: string, recipientIds: string[]) {
  const rows = recipientIds.map((recipient_id) => ({
    recipient_id,
    type: "group_added",
    chat_id: chatId,
    title: `Added to ${groupTitle}`,
    body: "Tap to open the group chat.",
    payload: { groupTitle },
  }));
  const { error } = await supabase.from("app_notifications").insert(rows);
  if (error) console.error("notify group:", error);
}

export async function notifyGroupCall(
  recipientIds: string[],
  chatId: string,
  groupTitle: string,
  callId: string,
  hostId: string,
  hostUsername: string,
  hostAvatar: string | null
) {
  const rows = recipientIds.map((recipient_id) => ({
    recipient_id,
    type: "group_call",
    chat_id: chatId,
    title: `${groupTitle} — group call`,
    body: "Tap to join the call.",
    payload: { callId, groupTitle, hostId, hostUsername, hostAvatar },
  }));
  const { error } = await supabase.from("app_notifications").insert(rows);
  if (error) console.error("notify group call:", error);
}

export async function getGroupById(chatId: string): Promise<GroupChatRow | null> {
  const { data, error } = await supabase
    .from("chats")
    .select(
      "id, chat_type, title, description, created_by, invite_code, avatar_url, created_at, group_members_can_start_calls"
    )
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.chat_type !== "group") return null;
  return data as GroupChatRow;
}

export async function getMyGroupRole(chatId: string, meId: string): Promise<GroupMemberRole | null> {
  const { data, error } = await supabase
    .from("chat_members")
    .select("role")
    .eq("chat_id", chatId)
    .eq("profile_id", meId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as GroupMemberRole) ?? null;
}

export async function getGroupMembers(chatId: string): Promise<Profile[]> {
  const rows = await getGroupMembersWithRoles(chatId);
  return rows.map(({ role: _r, joined_at: _j, ...profile }) => profile);
}

export async function getGroupMembersWithRoles(chatId: string): Promise<GroupMember[]> {
  const { data: members, error } = await supabase
    .from("chat_members")
    .select("role, joined_at, profile_id")
    .eq("chat_id", chatId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  const ids = (members ?? []).map((m) => m.profile_id);
  if (!ids.length) return [];

  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

  return (members ?? [])
    .map((m) => {
      const profile = profileMap.get(m.profile_id);
      if (!profile) return null;
      return {
        ...profile,
        role: m.role as GroupMemberRole,
        joined_at: m.joined_at,
      };
    })
    .filter((m): m is GroupMember => m != null);
}

export async function canStartGroupCall(chatId: string, meId: string): Promise<boolean> {
  const role = await getMyGroupRole(chatId, meId);
  if (isGroupAdmin(role)) return true;
  const group = await getGroupById(chatId);
  return group?.group_members_can_start_calls !== false;
}

export async function updateGroup(
  chatId: string,
  meId: string,
  patch: {
    title?: string;
    description?: string;
    avatar_url?: string;
    group_members_can_start_calls?: boolean;
  }
) {
  await assertChatMember(chatId, meId);
  const role = await getMyGroupRole(chatId, meId);
  if (!isGroupAdmin(role)) throw new Error("Only group admins can update group info");

  const { error } = await supabase
    .from("chats")
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() || null } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() || null } : {}),
      ...(patch.avatar_url !== undefined ? { avatar_url: patch.avatar_url } : {}),
      ...(patch.group_members_can_start_calls !== undefined
        ? { group_members_can_start_calls: patch.group_members_can_start_calls }
        : {}),
    })
    .eq("id", chatId)
    .eq("chat_type", "group");
  if (error) throw error;
}

export async function removeGroupMember(chatId: string, actorId: string, targetId: string) {
  await assertChatMember(chatId, actorId);
  if (actorId === targetId) throw new Error("You cannot remove yourself here");

  const [actorRole, targetRole] = await Promise.all([
    getMyGroupRole(chatId, actorId),
    getMyGroupRole(chatId, targetId),
  ]);
  if (!isGroupAdmin(actorRole)) throw new Error("Only admins can remove members");
  if (!targetRole) throw new Error("Member not found");
  if (targetRole === "owner") throw new Error("Cannot remove the group owner");
  if (targetRole === "admin" && actorRole !== "owner") {
    throw new Error("Only the owner can remove an admin");
  }

  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("profile_id", targetId);
  if (error) throw error;
}

export async function getGroupByInviteCode(code: string): Promise<GroupChatRow | null> {
  const { data, error } = await supabase
    .from("chats")
    .select(
      "id, chat_type, title, description, created_by, invite_code, avatar_url, created_at, group_members_can_start_calls"
    )
    .eq("invite_code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data || data.chat_type !== "group") return null;
  return data as GroupChatRow;
}

export async function joinGroupByInvite(meId: string, inviteCode: string): Promise<string> {
  const group = await getGroupByInviteCode(inviteCode);
  if (!group) throw new Error("Invalid group code");

  const { data: existing } = await supabase
    .from("chat_members")
    .select("profile_id")
    .eq("chat_id", group.id)
    .eq("profile_id", meId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("chat_members").insert({
      chat_id: group.id,
      profile_id: meId,
      role: "member",
    });
    if (error) throw error;
    await notifyUsersAddedToGroup(group.id, group.title ?? "Group", [meId]);
  }

  return group.id;
}

export function groupInvitePath(code: string) {
  return `/g/${code}`;
}

export function groupInviteUrl(code: string) {
  if (typeof window !== "undefined") return `${window.location.origin}/g/${code}`;
  const base = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "");
  return base ? `${base}/g/${code}` : `/g/${code}`;
}

export async function addMemberToGroup(chatId: string, profileId: string, groupTitle: string) {
  const { error } = await supabase.from("chat_members").insert({
    chat_id: chatId,
    profile_id: profileId,
    role: "member",
  });
  if (error) throw error;
  await notifyUsersAddedToGroup(chatId, groupTitle, [profileId]);
}

export async function listMyNotifications(meId: string, limit = 30) {
  const { data, error } = await supabase
    .from("app_notifications")
    .select("*")
    .eq("recipient_id", meId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  await supabase.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function getChattedPeerIds(meId: string): Promise<Profile[]> {
  const { data: chats } = await supabase
    .from("chats")
    .select("user_a, user_b, chat_type")
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)
    .eq("chat_type", "direct");

  const ids = new Set<string>();
  for (const c of chats ?? []) {
    if (c.chat_type !== "direct") continue;
    ids.add(c.user_a === meId ? c.user_b : c.user_a);
  }
  if (!ids.size) return [];
  const { data } = await supabase.from("profiles").select("*").in("id", [...ids]);
  return (data ?? []) as Profile[];
}
