import { supabase } from "@/integrations/supabase/client";
import { formatCallDuration } from "@/lib/call-history";
import type { GroupActiveCall } from "@/lib/group-active-calls";
import type { Message } from "@/lib/types";
import type { CallSession } from "@/lib/webrtc/types";

export type CallLogKind = "voice" | "video" | "group";
export type CallLogStatus =
  | "ringing"
  | "live"
  | "ended"
  | "missed"
  | "completed"
  | "cancelled"
  | "declined"
  /** @deprecated legacy — treated as ringing */
  | "ongoing";

export type CallLogMeta = {
  callId: string;
  kind: CallLogKind;
  status: CallLogStatus;
  initiatorId: string;
  video?: boolean;
  durationSec?: number;
  groupTitle?: string;
  joinedUserIds?: string[];
};

const CALL_LOG_TYPE = "call_log";

const STATUS_RANK: Record<string, number> = {
  ringing: 0,
  ongoing: 0,
  live: 1,
  cancelled: 2,
  declined: 3,
  missed: 4,
  ended: 5,
  completed: 6,
};

export function normalizeCallStatus(status: CallLogStatus): CallLogStatus {
  if (status === "ongoing") return "ringing";
  return status;
}

export function isCallLogMessage(m: Pick<Message, "attachment_type">): boolean {
  return m.attachment_type === CALL_LOG_TYPE;
}

export function parseCallLogMessage(m: Message): CallLogMeta | null {
  if (!isCallLogMessage(m) || !m.attachment_name) return null;
  try {
    const meta = JSON.parse(m.attachment_name) as CallLogMeta;
    return { ...meta, status: normalizeCallStatus(meta.status) };
  } catch {
    return null;
  }
}

export type GroupCallBubbleUI = {
  label: string;
  variant: "ringing" | "live" | "ended" | "neutral" | "missed";
  action: "join" | "rejoin" | "new_call" | null;
};

export function groupCallBubbleUI(
  meta: CallLogMeta,
  viewerId: string,
  active: GroupActiveCall | null
): GroupCallBubbleUI {
  const joined =
    active?.joined_user_ids?.includes(viewerId) || meta.joinedUserIds?.includes(viewerId);
  const isThisCallLive = active?.call_id === meta.callId;

  if (isThisCallLive) {
    if (!joined) {
      return { label: "Group call · Ringing…", variant: "ringing", action: "join" };
    }
    return { label: "Group call ongoing", variant: "live", action: "rejoin" };
  }

  const status = normalizeCallStatus(meta.status);
  if (status === "ended" || status === "ringing" || status === "live" || status === "ongoing") {
    return { label: "Group call ended", variant: "ended", action: "new_call" };
  }
  if (status === "completed" && meta.durationSec != null && meta.durationSec > 0) {
    return {
      label: `Group call · ${formatCallDuration(meta.durationSec)}`,
      variant: "neutral",
      action: null,
    };
  }
  if (status === "missed" || status === "declined") {
    return { label: "Missed group call", variant: "missed", action: "new_call" };
  }
  if (status === "cancelled") {
    return { label: "Group call · Cancelled", variant: "neutral", action: "new_call" };
  }
  return { label: "Group call ended", variant: "ended", action: "new_call" };
}

export function callLogLabel(meta: CallLogMeta, viewerId: string): string {
  const status = normalizeCallStatus(meta.status);
  const m = { ...meta, status };
  const kindLabel =
    m.kind === "group"
      ? "Group call"
      : m.kind === "video" || m.video
        ? "Video call"
        : "Voice call";
  const outgoing = m.initiatorId === viewerId;

  if (m.kind === "group") {
    if (status === "ringing") return outgoing ? `${kindLabel} · Ringing…` : "Group call · Ringing…";
    if (status === "live") return "Group call ongoing";
    if (status === "ended") return "Group call ended";
  }

  if (status === "ringing" || status === "ongoing") {
    return outgoing ? `${kindLabel} · Ringing…` : `Incoming ${kindLabel.toLowerCase()}`;
  }
  if (status === "missed") {
    return outgoing ? `${kindLabel} · No answer` : `Missed ${kindLabel.toLowerCase()}`;
  }
  if (status === "declined") {
    return outgoing ? `${kindLabel} · Declined` : `Missed ${kindLabel.toLowerCase()}`;
  }
  if (status === "cancelled") return `${kindLabel} · Cancelled`;
  if (status === "ended") {
    return outgoing ? `${kindLabel} · Ended` : `${kindLabel} ended`;
  }
  if (status === "completed" && meta.durationSec != null && meta.durationSec > 0) {
    return `${kindLabel} · ${formatCallDuration(meta.durationSec)}`;
  }
  return kindLabel;
}

export function mergeCallLogMessages(messages: Message[]): Message[] {
  const byCallId = new Map<string, Message>();
  const rest: Message[] = [];

  for (const m of messages) {
    const meta = parseCallLogMessage(m);
    if (!meta) {
      rest.push(m);
      continue;
    }
    const prev = byCallId.get(meta.callId);
    if (!prev) {
      byCallId.set(meta.callId, m);
      continue;
    }
    const prevMeta = parseCallLogMessage(prev)!;
    const a = STATUS_RANK[normalizeCallStatus(meta.status)] ?? 0;
    const b = STATUS_RANK[normalizeCallStatus(prevMeta.status)] ?? 0;
    if (a >= b) byCallId.set(meta.callId, m);
  }

  const merged = [...rest, ...byCallId.values()];
  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return merged;
}

export async function sendCallLogMessage(opts: {
  chatId: string;
  senderId: string;
  meta: CallLogMeta;
}): Promise<string | null> {
  const meta = { ...opts.meta, status: normalizeCallStatus(opts.meta.status) };
  const name = JSON.stringify(meta);
  if (name.length > 256) return null;
  const content = callLogLabel(meta, opts.senderId);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: opts.chatId,
      sender_id: opts.senderId,
      content,
      attachment_type: CALL_LOG_TYPE,
      attachment_name: name,
    })
    .select("id")
    .single();

  if (error) {
    console.error("call log insert:", error);
    return null;
  }
  return data.id as string;
}

/** Updates all call_log rows for this call_id in the chat (both peers may have inserted one). */
export async function finalizeCallLogMessagesForCall(opts: {
  chatId: string;
  callId: string;
  meta: CallLogMeta;
}): Promise<number> {
  const meta = { ...opts.meta, status: normalizeCallStatus(opts.meta.status) };
  const name = JSON.stringify(meta);
  if (name.length > 256) return 0;
  const content = callLogLabel(meta, meta.initiatorId);

  const { data, error } = await supabase.rpc("finalize_call_log_for_call", {
    p_chat_id: opts.chatId,
    p_call_id: opts.callId,
    p_attachment_name: name,
    p_content: content,
  });

  if (error) {
    console.error("finalize_call_log_for_call:", error);
    return 0;
  }
  if (typeof data === "number" && !Number.isNaN(data)) return data;
  if (typeof data === "string") {
    const n = parseInt(data, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function updateCallLogMessage(
  messageId: string,
  opts: { chatId: string; senderId: string; meta: CallLogMeta }
) {
  const meta = { ...opts.meta, status: normalizeCallStatus(opts.meta.status) };
  const name = JSON.stringify(meta);
  if (name.length > 256) return;
  const content = callLogLabel(meta, opts.senderId);

  const { error: rpcErr } = await supabase.rpc("update_group_call_log_message", {
    p_message_id: messageId,
    p_chat_id: opts.chatId,
    p_attachment_name: name,
    p_content: content,
  });

  if (!rpcErr) return;

  const { error } = await supabase
    .from("messages")
    .update({ content, attachment_name: name })
    .eq("id", messageId)
    .eq("chat_id", opts.chatId)
    .eq("sender_id", opts.senderId);

  if (error) console.error("call log update:", error);
}

/** Mark stale in-chat call bubbles as ended when no live call row exists. */
export async function reconcileStaleGroupCallLogs(
  chatId: string,
  messages: Message[],
  active: GroupActiveCall | null,
  meId: string
) {
  if (active) return;
  for (const m of messages) {
    const meta = parseCallLogMessage(m);
    if (!meta || meta.kind !== "group") continue;
    const st = normalizeCallStatus(meta.status);
    if (st !== "ringing" && st !== "live" && st !== "ongoing") continue;
    const next: CallLogMeta = { ...meta, status: "ended" };
    await updateCallLogMessage(m.id, { chatId, senderId: m.sender_id, meta: next });
  }
}

const DIRECT_CALL_ACTIVE_PHASES: CallSession["phase"][] = ["outgoing", "incoming", "connecting", "active"];

export function isDirectCallLiveInChat(
  messageChatId: string,
  metaCallId: string,
  session: Pick<CallSession, "chatId" | "callId" | "phase">
): boolean {
  return (
    session.chatId === messageChatId &&
    !!session.callId &&
    session.callId === metaCallId &&
    DIRECT_CALL_ACTIVE_PHASES.includes(session.phase)
  );
}

/** 1:1 calls: mark ringing/live rows ended when no session is active for that call (peer row may never get updated). */
export async function reconcileStaleDirectCallLogs(
  chatId: string,
  messages: Message[],
  session: Pick<CallSession, "chatId" | "callId" | "phase">
) {
  const liveForThisChat = isDirectCallLiveInChat(chatId, session.callId, session) ? session.callId : null;

  const seenCallIds = new Set<string>();
  for (const m of messages) {
    const meta = parseCallLogMessage(m);
    if (!meta || meta.kind === "group") continue;
    const st = normalizeCallStatus(meta.status);
    if (st !== "ringing" && st !== "live" && st !== "ongoing") continue;
    if (meta.callId === liveForThisChat) continue;
    if (seenCallIds.has(meta.callId)) continue;
    seenCallIds.add(meta.callId);
    const next: CallLogMeta = { ...meta, status: "ended" };
    await finalizeCallLogMessagesForCall({ chatId, callId: meta.callId, meta: next });
  }
}
