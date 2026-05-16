import { useEffect, useState } from "react";

/** Normalized mic level 0–1 from a MediaStream audio track. */
export function useAudioLevel(stream: MediaStream | null, enabled = true) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled || !stream || typeof window === "undefined") {
      setLevel(0);
      return;
    }

    const track = stream.getAudioTracks()[0];
    if (!track || !track.enabled) {
      setLevel(0);
      return;
    }

    let ctx: AudioContext | null = null;
    let raf = 0;
    let cancelled = false;

    const start = async () => {
      try {
        ctx = new AudioContext();
        if (ctx.state === "suspended") await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);

        const bins = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(bins);
          let sum = 0;
          for (let i = 0; i < bins.length; i++) sum += bins[i];
          const avg = sum / bins.length / 255;
          setLevel(avg);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setLevel(0);
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void ctx?.close();
      setLevel(0);
    };
  }, [stream, enabled]);

  return level;
}

export function isSpeakingLevel(level: number) {
  return level > 0.055;
}
