export type CallSignalType =
  | "offer"
  | "answer"
  | "ice"
  | "hangup"
  | "reject"
  | "busy"
  | "ringing";

export type CallSignal = {
  type: CallSignalType;
  callId: string;
  chatId: string;
  from: string;
  to: string;
  video: boolean;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  peerName?: string;
  peerAvatar?: string | null;
};

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";

export type CallDirection = "incoming" | "outgoing";

export type CallPeer = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export type CallSession = {
  callId: string;
  chatId: string;
  peer: CallPeer;
  video: boolean;
  direction: CallDirection;
  phase: CallPhase;
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  videoEnabled: boolean;
  error: string | null;
  pendingOffer?: RTCSessionDescriptionInit;
};

export const EMPTY_CALL_SESSION: CallSession = {
  callId: "",
  chatId: "",
  peer: { id: "", username: "", avatar_url: null },
  video: false,
  direction: "outgoing",
  phase: "idle",
  startedAt: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  videoEnabled: true,
  error: null,
};
