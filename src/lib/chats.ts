import { supabase } from "@/integrations/supabase/client";
import type { Chat, ChatWithMeta, Message, Profile } from "./types";

export async function listChatsForUser(meId: string): Promise<ChatWithMeta[]> {
  const { data: chats, error } = await supabase
    .from("chats")
    .select("*")
    .or(`user_a.eq.${meId},user_b.eq.${meId}`);
  if (error) throw error;
  if (!chats || chats.length === 0) return [];

  const otherIds = chats.map((c) => (c.user_a === meId ? c.user_b : c.user_a));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", otherIds);

  const chatIds = chats.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .in("chat_id", chatIds)
    .order("created_at", { ascending: false });

  const profileMap = new Map<string, Profile>((profiles ?? []).map((p) => [p.id, p as Profile]));
  const lastMsgByChat = new Map<string, Message>();
  for (const m of msgs ?? []) {
    if (!lastMsgByChat.has(m.chat_id)) lastMsgByChat.set(m.chat_id, m as Message);
  }

  const result: ChatWithMeta[] = chats.map((c) => {
    const otherId = c.user_a === meId ? c.user_b : c.user_a;
    return {
      ...(c as Chat),
      other: profileMap.get(otherId) ?? ({ id: otherId, username: "Unknown", avatar_url: null, is_online: false, last_seen: new Date().toISOString(), status: null, created_at: new Date().toISOString() } as Profile),
      lastMessage: lastMsgByChat.get(c.id) ?? null,
      unreadCount: 0,
    };
  });

  // Sort by last message time desc (chats with no message go to bottom)
  result.sort((a, b) => {
    const at = a.lastMessage?.created_at ?? a.created_at;
    const bt = b.lastMessage?.created_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  return result;
}

export async function listAllOtherProfiles(meId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", meId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function loadMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(input: {
  chat_id: string;
  sender_id: string;
  content: string;
  reply_to?: string | null;
}) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: input.chat_id,
      sender_id: input.sender_id,
      content: input.content,
      reply_to: input.reply_to ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase
    .from("messages")
    .update({ is_deleted: true, content: "" })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    // Remove other reactions from this user on this message (one reaction per user per message)
    await supabase.from("reactions").delete().eq("message_id", messageId).eq("user_id", userId);
    await supabase.from("reactions").insert({ message_id: messageId, user_id: userId, emoji });
  }
}

export async function loadReactionsForMessages(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const { data } = await supabase.from("reactions").select("*").in("message_id", messageIds);
  return data ?? [];
}
