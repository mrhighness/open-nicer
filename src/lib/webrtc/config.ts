/**
 * ICE servers for WebRTC.
 *
 * STUN alone is often insufficient on mobile (carrier NAT, symmetric NAT).
 * We include Metered's public open-relay TURN for better cross-network audio.
 * For production scale, set VITE_TURN_URLS + VITE_TURN_USERNAME + VITE_TURN_CREDENTIAL
 * (e.g. Metered, Twilio, or Cloudflare Calls TURN).
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

/** Public demo relay — dramatically improves P2P success vs STUN-only. */
const METERED_OPEN_RELAY: RTCIceServer[] = [
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...STUN_SERVERS, ...METERED_OPEN_RELAY];

  const urlsRaw = (import.meta.env.VITE_TURN_URLS as string | undefined)?.trim();
  if (urlsRaw) {
    const urls = urlsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const user = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
    const cred = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();
    if (urls.length) {
      if (user && cred) {
        servers.unshift({ urls, username: user, credential: cred });
      } else {
        servers.unshift({ urls });
      }
    }
  }

  return servers;
}

export const CALL_RING_TIMEOUT_MS = 45_000;

/** Grace period before treating WebRTC "disconnected" as a hangup (mobile radios flap). */
export const ICE_DISCONNECT_HANGUP_MS = 12_000;

export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user" as const,
  },
};
