import type { CallLogStatus } from "@/lib/call-messages";
import type { CallSession } from "@/lib/webrtc/types";
import type { GroupCallSession } from "@/lib/webrtc/group-call-types";

export type CallLogTracker = {
  callId: string;
  chatId: string;
  sentStart: boolean;
  wasActive: boolean;
  messageId?: string;
};

export function finalCallStatus(session: CallSession, tracker: CallLogTracker): CallLogStatus {
  if (tracker.wasActive || session.phase === "active") return "completed";
  if (session.direction === "incoming") return "missed";
  if (session.error?.toLowerCase().includes("declin")) return "declined";
  if (session.error?.toLowerCase().includes("busy")) return "cancelled";
  return session.direction === "outgoing" ? "cancelled" : "missed";
}

/** Group call fully ended for everyone — chat bubble shows "Group call ended". */
export function finalGroupCallStatus(
  session: GroupCallSession,
  tracker: CallLogTracker,
  isHost: boolean
): CallLogStatus {
  const remoteJoined = [...session.participants.values()].some(
    (p) => p.connected && p.id !== session.participants.keys().next().value
  );
  if (tracker.wasActive || session.phase === "active" || remoteJoined) {
    return "ended";
  }
  return isHost ? "cancelled" : "missed";
}
