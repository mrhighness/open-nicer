import { motion } from "framer-motion";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Users, Video } from "lucide-react";
import type { Message } from "@/lib/types";
import {
  callLogLabel,
  groupCallBubbleUI,
  isDirectCallLiveInChat,
  normalizeCallStatus,
  parseCallLogMessage,
} from "@/lib/call-messages";
import { useCall } from "@/contexts/call-context";
import { useGroupCall } from "@/contexts/group-call-context";
import type { GroupActiveCall } from "@/lib/group-active-calls";
import { cn } from "@/lib/utils";

type Props = {
  message: Message;
  viewerId: string;
  activeGroupCall?: GroupActiveCall | null;
  groupTitle?: string;
};

export function CallLogBubble({ message, viewerId, activeGroupCall = null, groupTitle }: Props) {
  const { session: directSession } = useCall();
  const { startGroupCall, acceptGroupCall, rejoinGroupCall, incomingGroupCall } = useGroupCall();
  const meta = parseCallLogMessage(message);
  if (!meta) return null;

  const isGroup = meta.kind === "group";
  const groupUi = isGroup ? groupCallBubbleUI(meta, viewerId, activeGroupCall) : null;

  const rawSt = normalizeCallStatus(meta.status);
  const staleDirectRinging =
    !isGroup &&
    (rawSt === "ringing" || rawSt === "live" || rawSt === "ongoing") &&
    !isDirectCallLiveInChat(message.chat_id, meta.callId, directSession);
  const displayMeta = staleDirectRinging ? { ...meta, status: "ended" as const } : meta;

  const label = isGroup && groupUi ? groupUi.label : callLogLabel(displayMeta, viewerId);

  const outgoing = displayMeta.initiatorId === viewerId;
  const st = normalizeCallStatus(displayMeta.status);
  const missed = st === "missed" || st === "declined";
  const variant =
    groupUi?.variant ??
    (missed
      ? "missed"
      : st === "ringing" || st === "ongoing"
        ? "ringing"
        : st === "live"
          ? "live"
          : st === "ended" || st === "cancelled"
            ? "ended"
            : "neutral");

  const Icon =
    meta.kind === "group"
      ? Users
      : meta.kind === "video" || meta.video
        ? Video
        : missed
          ? PhoneMissed
          : outgoing
            ? PhoneOutgoing
            : PhoneIncoming;

  const onAction = () => {
    if (!isGroup || !groupUi?.action) return;
    const title = meta.groupTitle ?? groupTitle ?? "Group";
    if (groupUi.action === "new_call") {
      void startGroupCall(message.chat_id, title);
      return;
    }
    const live = activeGroupCall?.call_id === meta.callId ? activeGroupCall : null;
    if (!live) {
      void startGroupCall(message.chat_id, title);
      return;
    }
    if (groupUi.action === "join" && incomingGroupCall?.callId === meta.callId) {
      void acceptGroupCall();
      return;
    }
    void rejoinGroupCall({
      chatId: message.chat_id,
      callId: meta.callId,
      groupTitle: title,
      hostId: live.host_id,
    });
  };

  const actionLabel =
    groupUi?.action === "join"
      ? "Join call"
      : groupUi?.action === "rejoin"
        ? "Rejoin"
        : groupUi?.action === "new_call"
          ? "New call"
          : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center my-2 px-3 gap-2"
    >
      <motion.div
        className={cn(
          "inline-flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-medium max-w-[280px]",
          variant === "missed" && "border-destructive/50 bg-destructive/10 text-destructive",
          variant === "ringing" && "border-primary/50 bg-primary/15 text-primary",
          variant === "live" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
          variant === "ended" && "border-destructive/50 bg-destructive/12 text-destructive",
          variant === "neutral" && "border-border/50 bg-card/50 text-foreground/90"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-8 rounded-full flex items-center justify-center shrink-0",
              variant === "missed" || variant === "ended"
                ? "bg-destructive/20"
                : variant === "live"
                  ? "bg-emerald-500/20"
                  : "bg-primary/20"
            )}
          >
            <Icon
              className={cn(
                "size-4",
                variant === "missed" || variant === "ended"
                  ? "text-destructive"
                  : variant === "live"
                    ? "text-emerald-400"
                    : "text-primary"
              )}
            />
          </span>
          <span className="text-left">{label}</span>
        </div>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "w-full h-9 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90",
              variant === "ended" || variant === "missed"
                ? "bg-destructive/90 text-destructive-foreground"
                : variant === "live"
                  ? "bg-emerald-600 text-white"
                  : "bg-primary text-primary-foreground"
            )}
          >
            {actionLabel}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
