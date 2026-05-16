import { playCallSound, stopCallSound } from "@/lib/call-sounds";
import { notifyGroupCall } from "@/lib/groups";
import { buildIceServers, ICE_DISCONNECT_HANGUP_MS, MEDIA_CONSTRAINTS } from "./config";
import type { CallPeer } from "./types";
import {
  EMPTY_GROUP_CALL,
  type GroupCallSession,
  type GroupCallSignal,
} from "./group-call-types";

type SendGroupSignal = (chatId: string, callId: string, signal: Omit<GroupCallSignal, "chatId" | "callId" | "from">) => void;

export type GroupCallCallbacks = {
  onSessionChange: (session: GroupCallSession) => void;
};

function newCallId() {
  return crypto.randomUUID();
}

export class GroupCallEngine {
  private meId = "";
  private session: GroupCallSession = {
    ...EMPTY_GROUP_CALL,
    participants: new Map(),
  };
  private peers = new Map<string, RTCPeerConnection>();
  private sendSignal: SendGroupSignal = () => {};
  private callbacks: GroupCallCallbacks;

  /** ICE candidates received before setRemoteDescription (per remote peer). */
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private hasRemoteDescription = new Map<string, boolean>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private iceRestartAttempts = new Map<string, number>();

  constructor(callbacks: GroupCallCallbacks) {
    this.callbacks = callbacks;
  }

  setMeId(id: string) {
    this.meId = id;
  }

  setSendSignal(fn: SendGroupSignal) {
    this.sendSignal = fn;
  }

  getSession() {
    return this.session;
  }

  isActive() {
    return this.session.phase !== "idle" && this.session.phase !== "ended";
  }

  private emit(patch?: Partial<GroupCallSession>) {
    if (patch?.participants) {
      this.session = { ...this.session, ...patch, participants: patch.participants };
    } else if (patch) {
      this.session = { ...this.session, ...patch };
    }
    this.callbacks.onSessionChange({
      ...this.session,
      participants: new Map(this.session.participants),
    });
  }

  private signal(
    chatId: string,
    callId: string,
    partial: Omit<GroupCallSignal, "chatId" | "callId" | "from">
  ) {
    this.sendSignal(chatId, callId, { ...partial, from: this.meId });
  }

  private updateSounds() {
    const remoteCount = [...this.session.participants.values()].filter(
      (p) => p.id !== this.meId && p.connected
    ).length;
    if (this.session.phase === "incoming") {
      playCallSound("groupIncoming");
      return;
    }
    if (this.session.isHost && this.session.phase === "outgoing" && remoteCount === 0) {
      playCallSound("groupWaiting");
      return;
    }
    if (this.session.phase === "active" || remoteCount > 0) {
      stopCallSound();
    }
  }

  private async getAudioStream() {
    return navigator.mediaDevices.getUserMedia({
      audio: MEDIA_CONSTRAINTS.audio,
      video: false,
    });
  }

  private setParticipant(peer: CallPeer, stream: MediaStream | null, connected: boolean) {
    const next = new Map(this.session.participants);
    next.set(peer.id, { ...peer, stream, connected });
    this.emit({ participants: next });
    this.updateSounds();
  }

  private clearPeerTimersAndIce(peerId: string) {
    const t = this.disconnectTimers.get(peerId);
    if (t) clearTimeout(t);
    this.disconnectTimers.delete(peerId);
    this.pendingIce.delete(peerId);
    this.hasRemoteDescription.delete(peerId);
    this.iceRestartAttempts.delete(peerId);
  }

  private scheduleDisconnectHangup(peerId: string) {
    const existing = this.disconnectTimers.get(peerId);
    if (existing) clearTimeout(existing);
    const t = window.setTimeout(() => {
      this.disconnectTimers.delete(peerId);
      const pc = this.peers.get(peerId);
      if (!pc) return;
      if (pc.connectionState === "disconnected" || pc.iceConnectionState === "disconnected") {
        this.removeParticipant(peerId);
      }
    }, ICE_DISCONNECT_HANGUP_MS);
    this.disconnectTimers.set(peerId, t);
  }

  private clearDisconnectHangup(peerId: string) {
    const t = this.disconnectTimers.get(peerId);
    if (t) clearTimeout(t);
    this.disconnectTimers.delete(peerId);
  }

  private tryRestartIceOnce(peerId: string, pc: RTCPeerConnection): boolean {
    const n = this.iceRestartAttempts.get(peerId) ?? 0;
    if (n >= 1 || typeof pc.restartIce !== "function") return false;
    this.iceRestartAttempts.set(peerId, n + 1);
    try {
      pc.restartIce();
      return true;
    } catch {
      return false;
    }
  }

  private markRemoteDescriptionReady(peerId: string) {
    this.hasRemoteDescription.set(peerId, true);
    void this.flushPendingIce(peerId);
  }

  private async flushPendingIce(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc || !this.hasRemoteDescription.get(peerId)) return;
    const queued = [...(this.pendingIce.get(peerId) ?? [])];
    this.pendingIce.set(peerId, []);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* stale */
      }
    }
  }

  private removeParticipant(peerId: string) {
    this.clearPeerTimersAndIce(peerId);
    const next = new Map(this.session.participants);
    next.delete(peerId);
    this.emit({ participants: next });
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
  }

  private createPeer(peer: CallPeer, chatId: string, callId: string, initiator: boolean) {
    const peerId = peer.id;
    if (this.peers.has(peerId)) return this.peers.get(peerId)!;

    this.pendingIce.set(peerId, []);
    this.hasRemoteDescription.set(peerId, false);
    this.iceRestartAttempts.set(peerId, 0);

    const pc = new RTCPeerConnection({
      iceServers: buildIceServers(),
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
    });

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.signal(chatId, callId, {
        type: "group-ice",
        to: peerId,
        candidate: ev.candidate.toJSON(),
      });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.setParticipant(peer, stream, true);
      if (this.session.phase !== "active") {
        this.emit({ phase: "active", startedAt: Date.now() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") {
        this.clearDisconnectHangup(peerId);
        this.setParticipant(peer, this.session.participants.get(peerId)?.stream ?? null, true);
      }
      if (ice === "failed") {
        if (!this.tryRestartIceOnce(peerId, pc)) {
          this.removeParticipant(peerId);
        }
      }
      if (ice === "disconnected") {
        this.scheduleDisconnectHangup(peerId);
      }
    };

    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === "connected") {
        this.clearDisconnectHangup(peerId);
        this.setParticipant(peer, this.session.participants.get(peerId)?.stream ?? null, true);
      }
      if (cs === "disconnected") {
        this.scheduleDisconnectHangup(peerId);
      }
    };

    this.session.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.session.localStream!));
    this.peers.set(peerId, pc);

    if (initiator) {
      void pc.createOffer().then((offer) => {
        void pc.setLocalDescription(offer);
        this.signal(chatId, callId, { type: "group-offer", to: peerId, sdp: offer });
      });
    }

    return pc;
  }

  async startGroupCall(
    chatId: string,
    groupTitle: string,
    notifyIds: string[],
    hostProfile: CallPeer
  ) {
    if (this.isActive()) throw new Error("Already in a call");
    const callId = newCallId();
    const localStream = await this.getAudioStream();

    this.emit({
      callId,
      chatId,
      groupTitle,
      phase: "outgoing",
      isHost: true,
      localStream,
      startedAt: Date.now(),
      error: null,
      participants: new Map([
        [
          this.meId,
          {
            id: this.meId,
            username: "You",
            avatar_url: null,
            stream: localStream,
            connected: true,
          },
        ],
      ]),
    });

    this.updateSounds();
    void notifyGroupCall(notifyIds, chatId, groupTitle, callId, hostProfile.id, hostProfile.username, hostProfile.avatar_url);

    this.signal(chatId, callId, {
      type: "group-start",
      to: "*",
      groupTitle,
      participants: [hostProfile],
    });
  }

  async joinGroupCall(chatId: string, callId: string, groupTitle: string, hostPeer: CallPeer) {
    if (this.isActive()) return;
    const localStream = await this.getAudioStream();
    this.emit({
      callId,
      chatId,
      groupTitle,
      phase: "active",
      isHost: false,
      localStream,
      startedAt: Date.now(),
      participants: new Map([
        [
          this.meId,
          {
            id: this.meId,
            username: "You",
            avatar_url: null,
            stream: localStream,
            connected: true,
          },
        ],
      ]),
    });

    this.signal(chatId, callId, { type: "group-join", to: "*", participants: [] });
    this.createPeer(hostPeer, chatId, callId, true);
    stopCallSound();
  }

  async handleSignal(signal: GroupCallSignal, myProfile: CallPeer) {
    const { chatId, callId, from, type } = signal;
    if (from === this.meId) return;

    if (type === "group-start" && !this.isActive()) {
      this.emit({
        callId,
        chatId,
        groupTitle: signal.groupTitle ?? "Group call",
        phase: "incoming",
        isHost: false,
        localStream: null,
        participants: new Map(),
      });
      this.updateSounds();
      return;
    }

    if (type === "group-join" && this.session.callId === callId && this.session.isHost) {
      const peer: CallPeer = {
        id: from,
        username: signal.participants?.[0]?.username ?? "Member",
        avatar_url: signal.participants?.[0]?.avatar_url ?? null,
      };
      this.createPeer(peer, chatId, callId, true);
      return;
    }

    if (type === "group-offer" && signal.sdp) {
      const peer: CallPeer = {
        id: from,
        username: signal.participants?.[0]?.username ?? "Member",
        avatar_url: signal.participants?.[0]?.avatar_url ?? null,
      };
      if (!this.session.localStream) {
        const stream = await this.getAudioStream();
        this.emit({ localStream: stream, phase: "active" });
      }
      const pc = this.createPeer(peer, chatId, callId, false);
      await pc.setRemoteDescription(signal.sdp);
      this.markRemoteDescriptionReady(from);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signal(chatId, callId, { type: "group-answer", to: from, sdp: answer });
      return;
    }

    if (type === "group-answer" && signal.sdp) {
      const pc = this.peers.get(from);
      if (pc) {
        await pc.setRemoteDescription(signal.sdp);
        this.markRemoteDescriptionReady(from);
      }
      return;
    }

    if (type === "group-ice" && signal.candidate) {
      const pc = this.peers.get(from);
      if (!pc) return;
      if (!this.hasRemoteDescription.get(from)) {
        const q = this.pendingIce.get(from) ?? [];
        q.push(signal.candidate);
        this.pendingIce.set(from, q);
        return;
      }
      try {
        await pc.addIceCandidate(signal.candidate);
      } catch {
        /* ignore */
      }
      return;
    }

    if (type === "group-end" && (this.session.callId === callId || this.session.chatId === chatId)) {
      await this.endCall();
    }
  }

  async acceptIncoming(hostPeer: CallPeer, myProfile: CallPeer) {
    if (this.session.phase !== "incoming") return;
    const localStream = await this.getAudioStream();
    this.emit({ localStream, phase: "active", startedAt: Date.now() });
    this.signal(this.session.chatId, this.session.callId, {
      type: "group-join",
      to: "*",
      participants: [myProfile],
    });
    this.createPeer(hostPeer, this.session.chatId, this.session.callId, true);
    stopCallSound();
  }

  toggleMute() {
    const muted = !this.session.muted;
    this.session.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    this.emit({ muted });
  }

  /** Reset local state without notifying peers (e.g. on app load). */
  resetSession() {
    stopCallSound();
    for (const id of this.peers.keys()) {
      this.clearPeerTimersAndIce(id);
    }
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.session.localStream?.getTracks().forEach((t) => t.stop());
    this.emit({ ...EMPTY_GROUP_CALL, participants: new Map() });
  }

  async endCall() {
    if (this.session.chatId && this.session.callId) {
      this.signal(this.session.chatId, this.session.callId, { type: "group-end", to: "*" });
    }
    stopCallSound();
    for (const id of this.peers.keys()) {
      this.clearPeerTimersAndIce(id);
    }
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.session.localStream?.getTracks().forEach((t) => t.stop());
    this.emit({
      ...EMPTY_GROUP_CALL,
      phase: "ended",
      participants: new Map(),
    });
    setTimeout(() => {
      if (this.session.phase === "ended") {
        this.emit({ ...EMPTY_GROUP_CALL, participants: new Map() });
      }
    }, 400);
  }
}
