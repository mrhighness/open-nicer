import { playCallSound, stopCallSound } from "@/lib/call-sounds";
import { notifyGroupCall } from "@/lib/groups";
import { ICE_SERVERS, MEDIA_CONSTRAINTS } from "./config";
import type { CallPeer } from "./types";
import {
  EMPTY_GROUP_CALL,
  type GroupCallParticipant,
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

  private removeParticipant(peerId: string) {
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
    if (this.peers.has(peer.id)) return this.peers.get(peer.id)!;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.signal(chatId, callId, {
        type: "group-ice",
        to: peer.id,
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        this.setParticipant(peer, this.session.participants.get(peer.id)?.stream ?? null, true);
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.removeParticipant(peer.id);
      }
    };

    this.session.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.session.localStream!));
    this.peers.set(peer.id, pc);

    if (initiator) {
      void pc.createOffer().then((offer) => {
        void pc.setLocalDescription(offer);
        this.signal(chatId, callId, { type: "group-offer", to: peer.id, sdp: offer });
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
      const peer: CallPeer = { id: from, username: "Member", avatar_url: null };
      const pc = this.createPeer(peer, chatId, callId, false);
      await pc.setRemoteDescription(signal.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signal(chatId, callId, { type: "group-answer", to: from, sdp: answer });
      if (!this.session.localStream) {
        const stream = await this.getAudioStream();
        this.emit({ localStream: stream, phase: "active" });
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }
      return;
    }

    if (type === "group-answer" && signal.sdp) {
      const pc = this.peers.get(from);
      if (pc) await pc.setRemoteDescription(signal.sdp);
      return;
    }

    if (type === "group-ice" && signal.candidate) {
      const pc = this.peers.get(from);
      if (pc) await pc.addIceCandidate(signal.candidate).catch(() => {});
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
