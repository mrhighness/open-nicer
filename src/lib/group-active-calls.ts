import { supabase } from "@/integrations/supabase/client";

export type GroupActiveCall = {
  chat_id: string;
  call_id: string;
  host_id: string;
  message_id: string | null;
  group_title: string | null;
  joined_user_ids: string[];
  started_at: string;
};

export async function getActiveGroupCall(chatId: string): Promise<GroupActiveCall | null> {
  const { data, error } = await supabase
    .from("group_active_calls")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) {
    console.error("getActiveGroupCall:", error);
    return null;
  }
  return data as GroupActiveCall | null;
}

export async function registerGroupActiveCall(opts: {
  chatId: string;
  callId: string;
  hostId: string;
  messageId: string | null;
  groupTitle: string;
}) {
  const { error } = await supabase.from("group_active_calls").upsert({
    chat_id: opts.chatId,
    call_id: opts.callId,
    host_id: opts.hostId,
    message_id: opts.messageId,
    group_title: opts.groupTitle,
    joined_user_ids: [opts.hostId],
    started_at: new Date().toISOString(),
  });
  if (error) console.error("registerGroupActiveCall:", error);
}

export async function addGroupCallParticipant(chatId: string, userId: string) {
  const row = await getActiveGroupCall(chatId);
  if (!row) return;
  const ids = new Set(row.joined_user_ids ?? []);
  ids.add(userId);
  const { error } = await supabase
    .from("group_active_calls")
    .update({ joined_user_ids: [...ids] })
    .eq("chat_id", chatId);
  if (error) console.error("addGroupCallParticipant:", error);
}

export async function endGroupActiveCall(chatId: string) {
  const { error } = await supabase.from("group_active_calls").delete().eq("chat_id", chatId);
  if (error) console.error("endGroupActiveCall:", error);
}
