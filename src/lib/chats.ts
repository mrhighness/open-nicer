import { supabase } from "@/integrations/supabase/client";
import { getCachedInbox, setCachedInbox } from "@/lib/inbox-cache";
import { unreadStore } from "./unread";
import { isDiscoverable } from "./privacy";
import { isPeerBlocked } from "./chat-settings";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { sanitizeMessageContent } from "@/lib/security/sanitize";
import { parseOrThrow, sendMessageSchema } from "@/lib/security/validation";
import type { Chat, ChatWithMeta, Message, Profile } from "./types";

const MESSAGE_PAGE_SIZE = 80;

async function fetchLastMessagesByChat(chatIds: string[]): Promise<Map<string, Message>> {
  const lastMsgByChat = new Map<string, Message>();
  if (!chatIds.length) return lastMsgByChat;

  const { data, error } = await supabase.rpc("get_last_messages_for_chats", {
    p_chat_ids: chatIds,
  });

  if (!error && data) {
    for (const m of data as Message[]) {
      lastMsgByChat.set(m.chat_id, m);
    }
    return lastMsgByChat;
  }

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, chat_id, content, created_at, sender_id, attachment_type, attachment_name, is_deleted")
    .in("chat_id", chatIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  for (const m of msgs ?? []) {
    if (!lastMsgByChat.has(m.chat_id)) lastMsgByChat.set(m.chat_id, m as Message);
  }
  return lastMsgByChat;
}

export async function assertChatMember(chatId: string, meId: string): Promise<void> {
  const { data: chat, error } = await supabase
    .from("chats")
    .select("id, chat_type, user_a, user_b")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  if (!chat) throw new Error("You do not have access to this chat.");

  if (chat.chat_type === "group") {
    const { data: member } = await supabase
      .from("chat_members")
      .select("profile_id")
      .eq("chat_id", chatId)
      .eq("profile_id", meId)
      .maybeSingle();
    if (!member) throw new Error("You do not have access to this chat.");
    return;
  }

  if (chat.user_a !== meId && chat.user_b !== meId) {
    throw new Error("You do not have access to this chat.");
  }
}

export async function listChatsForUser(meId: string, opts?: { skipCache?: boolean }): Promise<ChatWithMeta[]> {
  if (!opts?.skipCache) {
    const hit = getCachedInbox(meId);
    if (hit) return hit;
  }

  const [{ data: dmRows }, { data: memberships }] = await Promise.all([
    supabase.from("chats").select("*").or(`user_a.eq.${meId},user_b.eq.${meId}`),
    supabase.from("chat_members").select("chat_id").eq("profile_id", meId),
  ]);
  const directChats = (dmRows ?? []).filter((c) => c.chat_type !== "group") as Chat[];

  const groupIds = (memberships ?? []).map((m) => m.chat_id);
  let groupChats: Chat[] = [];
  if (groupIds.length) {
    const { data } = await supabase.from("chats").select("*").in("id", groupIds).eq("chat_type", "group");
    groupChats = (data ?? []) as Chat[];
  }

  const chats = [...((directChats ?? []) as Chat[]), ...groupChats];
  if (chats.length === 0) return [];

  const otherIds = chats
    .filter((c) => c.chat_type !== "group")
    .map((c) => (c.user_a === meId ? c.user_b : c.user_a));

  const groupChatIds = chats.filter((c) => c.chat_type === "group").map((c) => c.id);
  const memberCounts = new Map<string, number>();
  if (groupChatIds.length) {
    const { data: mems } = await supabase.from("chat_members").select("chat_id").in("chat_id", groupChatIds);
    for (const m of mems ?? []) {
      memberCounts.set(m.chat_id, (memberCounts.get(m.chat_id) ?? 0) + 1);
    }
  }

  const { data: profiles } =
    otherIds.length > 0
      ? await supabase.from("profiles").select("*").in("id", otherIds)
      : { data: [] as Profile[] };

  const chatIds = chats.map((c) => c.id);
  const profileMap = new Map<string, Profile>((profiles ?? []).map((p) => [p.id, p as Profile]));
  const lastMsgByChat = await fetchLastMessagesByChat(chatIds);

  if (unreadStore.userId !== meId) unreadStore.init(meId);
  await unreadStore.sync(meId, chatIds);
  const unreadCounts = { ...unreadStore.counts };

  const result: ChatWithMeta[] = chats.map((c) => {
    const isGroup = c.chat_type === "group";
    const otherId = isGroup ? c.id : c.user_a === meId ? c.user_b : c.user_a;
    const groupProfile: Profile = {
      id: c.id,
      username: c.title ?? "Group",
      avatar_url: (c as Chat).avatar_url ?? null,
      is_online: false,
      last_seen: new Date().toISOString(),
      status: c.description,
      created_at: c.created_at,
    } as Profile;

    return {
      ...(c as Chat),
      isGroup,
      memberCount: isGroup ? memberCounts.get(c.id) ?? 0 : undefined,
      other: isGroup
        ? groupProfile
        : profileMap.get(otherId) ??
          ({
            id: otherId,
            username: "Unknown",
            avatar_url: null,
            is_online: false,
            last_seen: new Date().toISOString(),
            status: null,
            created_at: new Date().toISOString(),
          } as Profile),
      lastMessage: lastMsgByChat.get(c.id) ?? null,
      unreadCount: unreadCounts[c.id] ?? 0,
    };
  });

  const visible = result.filter((c) => c.isGroup || !isPeerBlocked(c.other.id));
  visible.sort((a, b) => {
    const at = a.lastMessage?.created_at ?? a.created_at;
    const bt = b.lastMessage?.created_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  setCachedInbox(meId, visible);
  return visible;
}

export async function listAllOtherProfiles(meId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", meId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as Profile[]).filter(isDiscoverable);
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function loadMessages(chatId: string, meId: string, limit = MESSAGE_PAGE_SIZE): Promise<Message[]> {
  await assertChatMember(chatId, meId);
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

export async function sendMessage(input: {
  chat_id: string;
  sender_id: string;
  content: string;
  reply_to?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_duration?: number | null;
}) {
  assertRateLimit(`msg:${input.chat_id}`, 30, 10_000);
  const content = sanitizeMessageContent(input.content);
  const payload = parseOrThrow(sendMessageSchema, { ...input, content });
  await assertChatMember(payload.chat_id, payload.sender_id);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: payload.chat_id,
      sender_id: payload.sender_id,
      content: payload.content,
      reply_to: payload.reply_to ?? null,
      attachment_url: payload.attachment_url ?? null,
      attachment_type: payload.attachment_type ?? null,
      attachment_name: payload.attachment_name ?? null,
      attachment_size: payload.attachment_size ?? null,
      attachment_duration: payload.attachment_duration ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function deleteMessage(id: string, meId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ is_deleted: true, content: "" })
    .eq("id", id)
    .eq("sender_id", meId);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  assertRateLimit(`react:${messageId}`, 20, 10_000);
  const safeEmoji = emoji.slice(0, 8);
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", safeEmoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("reactions").delete().eq("message_id", messageId).eq("user_id", userId);
    await supabase.from("reactions").insert({ message_id: messageId, user_id: userId, emoji: safeEmoji });
  }
}

export async function loadReactionsForMessages(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const { data } = await supabase.from("reactions").select("*").in("message_id", messageIds);
  return data ?? [];
}
