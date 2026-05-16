import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { addCallLogEntry, updateCallLogEntry } from "@/lib/call-history";
import { playCallSound, stopCallSound } from "@/lib/call-sounds";
import { CALL_RING_TIMEOUT_MS, ICE_SERVERS, MEDIA_CONSTRAINTS } from "./config";
import type { CallPeer, CallSession, CallSignal, CallSignalType } from "./types";
import { EMPTY_CALL_SESSION } from "./types";

type SendSignal = (chatId: string, signal: Omit<CallSignal, "chatId">) => void;

export type CallEngineCallbacks = {
  onSessionChange: (session: CallSession) => void;
  onHistoryChange: () => void;
};

function newCallId() {
  return crypto.randomUUID();
}

export class CallEngine {
  private meId = "";
  private session: CallSession = { ...EMPTY_CALL_SESSION };
  private pc: RTCPeerConnection | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;
  private sendSignal: SendSignal = () => {};
  private callbacks: CallEngineCallbacks;

  constructor(callbacks: CallEngineCallbacks) {
    this.callbacks = callbacks;
  }

  setMeId(id: string) {
    this.meId = id;
  }

  setSendSignal(fn: SendSignal) {
    this.sendSignal = fn;
  }

  getSession() {
    return this.session;
  }

  isInCall() {
    return this.session.phase !== "idle" && this.session.phase !== "ended";
  }

  private emit(session?: Partial<CallSession>) {
    if (session) this.session = { ...this.session, ...session };
    this.callbacks.onSessionChange({ ...this.session });
  }

  private signal(chatId: string, partial: Omit<CallSignal, "chatId" | "from" | "to"> & { to: string }) {
    this.sendSignal(chatId, {
      ...partial,
      from: this.meId,
    });
  }

  private clearRingTimer() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
  }

  private async getUserMedia(video: boolean): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: MEDIA_CONSTRAINTS.audio,
      video: video ? MEDIA_CONSTRAINTS.video : false,
    });
  }

  private createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !this.session.chatId) return;
      this.signal(this.session.chatId, {
        type: "ice",
        callId: this.session.callId,
        to: this.session.peer.id,
        video: this.session.video,
        candidate: ev.candidate.toJSON(),
      });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      stopCallSound();
      this.emit({ remoteStream: stream, phase: "active", startedAt: this.session.startedAt ?? Date.now() });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        this.clearRingTimer();
        this.emit({ phase: "active", startedAt: this.session.startedAt ?? Date.now() });
      }
      if (pc.connectionState === "failed") {
        this.emit({ error: "Connection failed" });
        void this.endCall("failed");
      }
      if (pc.connectionState === "disconnected") {
        void this.endCall("disconnected");
      }
    };

    this.pc = pc;
    return pc;
  }

  private attachLocalTracks(stream: MediaStream) {
    if (!this.pc) return;
    stream.getTracks().forEach((track) => this.pc!.addTrack(track, stream));
  }

  private async flushPendingCandidates() {
    if (!this.pc || !this.remoteDescSet) return;
    for (const c of this.pendingCandidates) {
      await this.pc.addIceCandidate(c);
    }
    this.pendingCandidates = [];
  }

  private stopStreams() {
    this.session.localStream?.getTracks().forEach((t) => t.stop());
    this.session.remoteStream?.getTracks().forEach((t) => t.stop());
  }

  private closePeer() {
    this.pc?.close();
    this.pc = null;
    this.remoteDescSet = false;
    this.pendingCandidates = [];
  }

  private startRingTimeout() {
    this.clearRingTimer();
    this.ringTimer = setTimeout(() => {
      if (this.session.phase === "outgoing" || this.session.phase === "incoming") {
        void this.endCall("timeout", true);
      }
    }, CALL_RING_TIMEOUT_MS);
  }

  private logCallStart(direction: "incoming" | "outgoing") {
    addCallLogEntry(this.meId, {
      id: crypto.randomUUID(),
      callId: this.session.callId,
      chatId: this.session.chatId,
      otherUserId: this.session.peer.id,
      otherName: this.session.peer.username,
      otherAvatar: this.session.peer.avatar_url,
      direction,
      video: this.session.video,
      startedAt: new Date().toISOString(),
    });
    this.callbacks.onHistoryChange();
  }

  private logCallEnd(missed: boolean) {
    const started = this.session.startedAt;
    const durationSec = started ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
    updateCallLogEntry(this.meId, this.session.callId, {
      direction: missed ? "missed" : this.session.direction,
      endedAt: new Date().toISOString(),
      durationSec: durationSec > 0 ? durationSec : undefined,
    });
    this.callbacks.onHistoryChange();
  }

  async startCall(chatId: string, peer: CallPeer, video: boolean, localProfile: CallPeer) {
    if (this.isInCall()) throw new Error("Already in a call");

    const callId = newCallId();
    let localStream: MediaStream;
    try {
      localStream = await this.getUserMedia(video);
    } catch {
      throw new Error("Microphone or camera permission denied");
    }

    this.emit({
      callId,
      chatId,
      peer,
      video,
      direction: "outgoing",
      phase: "outgoing",
      localStream,
      remoteStream: null,
      muted: false,
      videoEnabled: video,
      error: null,
      startedAt: null,
    });

    this.logCallStart("outgoing");
    this.startRingTimeout();
    playCallSound("regularOutgoing");

    const pc = this.createPeerConnection();
    this.attachLocalTracks(localStream);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.signal(chatId, {
      type: "offer",
      callId,
      to: peer.id,
      video,
      sdp: offer,
      peerName: localProfile.username,
      peerAvatar: localProfile.avatar_url,
    });
  }

  async acceptCall() {
    if (this.session.phase !== "incoming" || !this.session.chatId) return;

    this.clearRingTimer();
    let localStream: MediaStream;
    try {
      localStream = await this.getUserMedia(this.session.video);
    } catch {
      this.emit({ error: "Microphone or camera permission denied" });
      void this.rejectCall();
      return;
    }

    this.emit({
      phase: "connecting",
      localStream,
      videoEnabled: this.session.video,
    });

    this.logCallStart("incoming");

    const pc = this.createPeerConnection();
    this.attachLocalTracks(localStream);

    if (this.session.pendingOffer) {
      await pc.setRemoteDescription(this.session.pendingOffer);
      this.remoteDescSet = true;
      await this.flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signal(this.session.chatId, {
        type: "answer",
        callId: this.session.callId,
        to: this.session.peer.id,
        video: this.session.video,
        sdp: answer,
      });
    }
  }

  rejectCall() {
    if (this.session.phase !== "incoming") return;
    this.signal(this.session.chatId, {
      type: "reject",
      callId: this.session.callId,
      to: this.session.peer.id,
      video: this.session.video,
    });
    addCallLogEntry(this.meId, {
      id: crypto.randomUUID(),
      callId: this.session.callId,
      chatId: this.session.chatId,
      otherUserId: this.session.peer.id,
      otherName: this.session.peer.username,
      otherAvatar: this.session.peer.avatar_url,
      direction: "missed",
      video: this.session.video,
      startedAt: new Date().toISOString(),
    });
    this.callbacks.onHistoryChange();
    this.cleanup("ended");
  }

  async endCall(reason = "hangup", missed = false) {
    if (this.session.phase === "idle") return;

    if (this.session.chatId && this.session.peer.id) {
      this.signal(this.session.chatId, {
        type: "hangup",
        callId: this.session.callId,
        to: this.session.peer.id,
        video: this.session.video,
      });
    }

    if (this.session.phase === "outgoing" && (reason === "timeout" || missed)) {
      this.logCallEnd(true);
    } else if (this.session.phase !== "idle") {
      this.logCallEnd(missed);
    }

    this.cleanup("ended");
  }

  private cleanup(phase: "idle" | "ended") {
    stopCallSound();
    this.clearRingTimer();
    this.stopStreams();
    this.closePeer();
    const ended = phase === "ended";
    this.emit({
      ...EMPTY_CALL_SESSION,
      phase: ended ? "ended" : "idle",
    });
    if (ended) {
      setTimeout(() => this.emit({ ...EMPTY_CALL_SESSION, phase: "idle" }), 600);
    }
  }

  toggleMute() {
    const muted = !this.session.muted;
    this.session.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    this.emit({ muted });
  }

  toggleVideo() {
    if (!this.session.video) return;
    const videoEnabled = !this.session.videoEnabled;
    this.session.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = videoEnabled;
    });
    this.emit({ videoEnabled });
  }

  async handleSignal(signal: CallSignal) {
    if (signal.from === this.meId) return;
    if (signal.to !== this.meId) return;

    if (signal.type === "busy" || signal.type === "reject" || signal.type === "hangup") {
      if (signal.callId !== this.session.callId && this.isInCall()) return;
    }

    switch (signal.type as CallSignalType) {
      case "offer":
        await this.handleOffer(signal);
        break;
      case "answer":
        await this.handleAnswer(signal);
        break;
      case "ice":
        await this.handleIce(signal);
        break;
      case "ringing":
        if (signal.callId === this.session.callId) this.emit({ phase: "connecting" });
        break;
      case "reject":
        if (signal.callId === this.session.callId) {
          updateCallLogEntry(this.meId, this.session.callId, { direction: "missed" });
          this.callbacks.onHistoryChange();
          this.emit({ error: "Call declined" });
          this.cleanup("ended");
        }
        break;
      case "busy":
        if (signal.callId === this.session.callId) {
          this.emit({ error: "User is busy" });
          this.cleanup("ended");
        }
        break;
      case "hangup":
        if (signal.callId === this.session.callId) this.cleanup("ended");
        break;
    }
  }

  private async handleOffer(signal: CallSignal) {
    if (this.isInCall()) {
      this.signal(signal.chatId, {
        type: "busy",
        callId: signal.callId,
        to: signal.from,
        video: signal.video,
      });
      return;
    }

    const peer: CallPeer = {
      id: signal.from,
      username: signal.peerName ?? "Someone",
      avatar_url: signal.peerAvatar ?? null,
    };

    this.emit({
      callId: signal.callId,
      chatId: signal.chatId,
      peer,
      video: signal.video,
      direction: "incoming",
      phase: "incoming",
      localStream: null,
      remoteStream: null,
      muted: false,
      videoEnabled: signal.video,
      error: null,
      startedAt: null,
      pendingOffer: signal.sdp,
    });

    this.startRingTimeout();

    this.signal(signal.chatId, {
      type: "ringing",
      callId: signal.callId,
      to: signal.from,
      video: signal.video,
    });
  }

  private async handleAnswer(signal: CallSignal) {
    if (signal.callId !== this.session.callId || !this.pc || !signal.sdp) return;
    this.clearRingTimer();
    await this.pc.setRemoteDescription(signal.sdp);
    this.remoteDescSet = true;
    await this.flushPendingCandidates();
    this.emit({ phase: "connecting" });
  }

  private async handleIce(signal: CallSignal) {
    if (signal.callId !== this.session.callId || !signal.candidate) return;
    if (!this.pc || !this.remoteDescSet) {
      this.pendingCandidates.push(signal.candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(signal.candidate);
    } catch {
      // ignore stale candidates
    }
  }
}
