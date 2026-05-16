import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  RotateCcw,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useCall } from "@/contexts/call-context";
import { formatCallDuration } from "@/lib/call-history";
import { cn } from "@/lib/utils";

function VideoTile({
  stream,
  muted,
  mirror,
  className,
  label,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <motion.div className={cn("relative overflow-hidden bg-black/80", className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn("size-full object-cover", mirror && "scale-x-[-1]")}
      />
      {label && (
        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-[10px] text-white font-medium">
          {label}
        </span>
      )}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
          <div className="size-16 rounded-full bg-muted/30 animate-pulse" />
        </div>
      )}
    </motion.div>
  );
}

function RingPulse() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-primary/40"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8 + i * 0.3, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

export function CallOverlay() {
  const { session, acceptCall, rejectCall, endCall, toggleMute, toggleVideo } = useCall();
  const [durationSec, setDurationSec] = useState(0);
  const visible = session.phase !== "idle";

  useEffect(() => {
    if (session.phase !== "active" || !session.startedAt) {
      setDurationSec(0);
      return;
    }
    const start = session.startedAt;
    const tick = () => setDurationSec(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.phase, session.startedAt]);

  const statusText = (() => {
    if (session.error) return session.error;
    if (session.phase === "outgoing") return "Ringing…";
    if (session.phase === "incoming") return session.video ? "Incoming video call" : "Incoming voice call";
    if (session.phase === "connecting") return "Connecting…";
    if (session.phase === "active") return formatCallDuration(durationSec);
    if (session.phase === "ended") return "Call ended";
    return "";
  })();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col bg-background"
          style={{ backgroundImage: "var(--gradient-app)" }}
        >
          {/* Remote / main view */}
          <div className="flex-1 relative min-h-0">
            {session.phase === "active" && session.video ? (
              <>
                <VideoTile stream={session.remoteStream} className="absolute inset-0" label={session.peer.username} />
                <VideoTile
                  stream={session.localStream}
                  muted
                  mirror
                  className="absolute bottom-24 right-4 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl border-2 border-white/20 shadow-2xl z-10"
                  label="You"
                />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                <motion.div
                  className="relative mb-8"
                  animate={{ scale: session.phase === "outgoing" || session.phase === "incoming" ? [1, 1.04, 1] : 1 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {(session.phase === "outgoing" || session.phase === "incoming") && <RingPulse />}
                  <Avatar
                    src={session.peer.avatar_url}
                    name={session.peer.username}
                    size={120}
                  />
                </motion.div>
                <h2 className="text-2xl font-bold font-display text-center">{session.peer.username}</h2>
                <p className={cn("text-sm mt-2", session.error ? "text-destructive" : "text-muted-foreground")}>
                  {statusText}
                </p>
                {session.phase === "active" && !session.video && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-8 flex items-center gap-1"
                  >
                    {[...Array(5)].map((_, i) => (
                      <motion.span
                        key={i}
                        className="w-1 rounded-full bg-primary"
                        animate={{ height: [12, 28, 12] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="shrink-0 px-6 pb-10 pt-4 bg-gradient-to-t from-black/60 to-transparent">
            {session.phase === "incoming" ? (
              <div className="flex items-center justify-center gap-10 max-w-md mx-auto">
                <CallAction
                  icon={PhoneOff}
                  label="Decline"
                  variant="destructive"
                  onClick={() => rejectCall()}
                />
                <CallAction
                  icon={session.video ? Video : Phone}
                  label="Accept"
                  variant="accept"
                  onClick={() => void acceptCall()}
                  large
                />
              </div>
            ) : (
              <motion.div className="flex flex-col items-center gap-6 max-w-lg mx-auto">
                {session.phase === "active" && (
                  <div className="flex items-center justify-center gap-4">
                    <ControlButton
                      icon={session.muted ? MicOff : Mic}
                      label={session.muted ? "Unmute" : "Mute"}
                      active={session.muted}
                      onClick={toggleMute}
                    />
                    {session.video && (
                      <ControlButton
                        icon={session.videoEnabled ? Video : VideoOff}
                        label={session.videoEnabled ? "Camera" : "Camera off"}
                        active={!session.videoEnabled}
                        onClick={toggleVideo}
                      />
                    )}
                    <ControlButton icon={RotateCcw} label="Flip" onClick={() => {}} />
                  </div>
                )}
                <CallAction
                  icon={PhoneOff}
                  label={session.phase === "active" ? "End" : "Cancel"}
                  variant="destructive"
                  onClick={() => void endCall()}
                  large
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CallAction({
  icon: Icon,
  label,
  onClick,
  variant,
  large,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
  variant: "accept" | "destructive";
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
      aria-label={label}
    >
      <span
        className={cn(
          "rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-lg",
          large ? "size-16" : "size-14",
          variant === "accept" && "bg-online hover:bg-online/90 text-white",
          variant === "destructive" && "bg-destructive hover:bg-destructive/90 text-white"
        )}
      >
        <Icon className={large ? "size-7" : "size-6"} />
      </span>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
      aria-label={label}
    >
      <span
        className={cn(
          "size-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-colors",
          active ? "bg-foreground text-background border-foreground" : "bg-white/10 text-white border-white/20 hover:bg-white/20"
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-[10px] text-white/70">{label}</span>
    </button>
  );
}
