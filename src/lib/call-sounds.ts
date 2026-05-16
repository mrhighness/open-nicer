/** Looping ringtones for 1:1 and group calls */

const SOUNDS = {
  regularOutgoing: "/regular-call.mp3",
  groupIncoming: "/groupring-sound.mp3",
  groupWaiting: "/ringing-round.mp3",
} as const;

export type CallSoundKind = keyof typeof SOUNDS;

let active: HTMLAudioElement | null = null;
let activeKind: CallSoundKind | null = null;

export function playCallSound(kind: CallSoundKind, volume = 0.85) {
  stopCallSound();
  if (typeof window === "undefined") return;
  const audio = new Audio(SOUNDS[kind]);
  audio.loop = true;
  audio.volume = volume;
  active = audio;
  activeKind = kind;
  void audio.play().catch(() => {});
}

export function stopCallSound() {
  if (!active) return;
  active.pause();
  active.currentTime = 0;
  active = null;
  activeKind = null;
}

export function isCallSoundPlaying(kind?: CallSoundKind) {
  if (!active) return false;
  if (kind) return activeKind === kind;
  return true;
}
