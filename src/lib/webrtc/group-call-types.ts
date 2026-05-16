import type { CallPeer } from "./types";

export type GroupCallSignalType =
  | "group-start"
  | "group-join"
  | "group-leave"
  | "group-offer"
  | "group-answer"
  | "group-ice"
  | "group-end";

export type GroupCallSignal = {
  type: GroupCallSignalType;
  callId: string;
  chatId: string;
  from: string;
  to: string;
  groupTitle?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  participants?: CallPeer[];
};

export type GroupCallParticipant = CallPeer & {
  stream: MediaStream | null;
  connected: boolean;
};

export type GroupCallSession = {
  callId: string;
  chatId: string;
  groupTitle: string;
  phase: "idle" | "outgoing" | "incoming" | "active" | "ended";
  isHost: boolean;
  localStream: MediaStream | null;
  participants: Map<string, GroupCallParticipant>;
  muted: boolean;
  startedAt: number | null;
  error: string | null;
};

export const EMPTY_GROUP_CALL: GroupCallSession = {
  callId: "",
  chatId: "",
  groupTitle: "",
  phase: "idle",
  isHost: false,
  localStream: null,
  participants: new Map(),
  muted: false,
  startedAt: null,
  error: null,
};
