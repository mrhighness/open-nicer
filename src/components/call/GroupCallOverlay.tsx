import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { SpeakingWaveform } from "@/components/call/SpeakingWaveform";
import { useGroupCall } from "@/contexts/group-call-context";
import { GroupCallInviteSheet } from "@/components/call/GroupCallInviteSheet";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { formatCallDuration } from "@/lib/call-history";
import { useMe } from "@/lib/use-me";
import type { GroupCallParticipant } from "@/lib/webrtc/group-call-types";
import { cn } from "@/lib/utils";
import { isOnboardingComplete } from "@/lib/onboarding";

function CallParticipant({
  participant,
  stream,
  audioEnabled,
  x,
  y,
  delay,
}: {
  participant: Pick<GroupCallParticipant, "username" | "avatar_url">;
  stream: MediaStream | null;
  audioEnabled: boolean;
  x: string;
  y: string;
  delay: number;
}) {
  const level = useAudioLevel(stream, audioEnabled);

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1.5"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 280, damping: 22 }}
    >
      <Avatar src={participant.avatar_url} name={participant.username} size={64} />
      <motion.div
        className="flex items-center gap-2 max-w-[120px]"
        animate={{ opacity: audioEnabled ? 1 : 0.65 }}
      >
        <span className="text-xs font-medium text-foreground/90 truncate">
          {participant.username}
        </span>
        <SpeakingWaveform level={level} active={audioEnabled} />
      </motion.div>
    </motion.div>
  );
}

export function GroupCallOverlay() {
  const { me } = useMe();
  const { session, endGroupCall, toggleMute, incomingGroupCall } = useGroupCall();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  const visible =
    isOnboardingComplete() &&
    (session.phase === "active" || session.phase === "outgoing");

  const participants = useMemo(() => {
    return [...session.participants.values()].filter(
      (p) => p.username !== "You" || session.participants.size === 1
    );
  }, [session.participants]);

  const displayList = useMemo(() => {
    const list = [...session.participants.values()];
    if (list.length === 0 && incomingGroupCall) {
      return [
        {
          id: "host",
          username: incomingGroupCall.groupTitle,
          avatar_url: null,
          stream: null,
          connected: false,
        } satisfies GroupCallParticipant,
      ];
    }
    return list.slice(0, 5);
  }, [session.participants, incomingGroupCall]);

  const positions = [
    { x: "50%", y: "28%" },
    { x: "28%", y: "52%" },
    { x: "72%", y: "52%" },
    { x: "38%", y: "72%" },
    { x: "62%", y: "72%" },
  ];

  useEffect(() => {
    if (session.phase !== "active" || !session.startedAt) {
      setDurationSec(0);
      return;
    }
    const tick = () => setDurationSec(Math.floor((Date.now() - session.startedAt!) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.phase, session.startedAt]);

  const title = session.groupTitle || "Conference call";

  const streamFor = (p: GroupCallParticipant) => {
    if (me && p.id === me.id) return session.localStream;
    return p.stream;
  };

  const audioEnabledFor = (p: GroupCallParticipant) => {
    if (me && p.id === me.id) return !session.muted;
    return !!p.stream;
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex flex-col"
          style={{ backgroundImage: "var(--gradient-app)" }}
        >
          <div className="pt-14 pb-4 text-center">
            <h1 className="text-lg font-semibold text-foreground/90">{title}</h1>
            <p className="text-2xl font-mono font-semibold mt-3 tabular-nums">
              {session.phase === "active" ? formatCallDuration(durationSec) : "00:00"}
            </p>
          </div>

          <div className="flex-1 relative min-h-[280px] max-w-md mx-auto w-full px-6">
            {displayList.map((p, i) => (
              <CallParticipant
                key={p.id}
                participant={p}
                stream={streamFor(p)}
                audioEnabled={audioEnabledFor(p)}
                x={positions[i]?.x ?? "50%"}
                y={positions[i]?.y ?? "50%"}
                delay={i * 0.08}
              />
            ))}

            <div
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
              style={{ top: "58%" }}
            >
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="size-12 rounded-full bg-card/60 border border-primary/30 flex items-center justify-center text-primary shadow-glow"
                aria-label="Add to call"
              >
                <UserPlus className="size-5" />
              </button>
              <span className="text-[11px] text-muted-foreground">Add call</span>
            </div>
          </div>

          <div className="px-8 pb-10 space-y-6">
            <div className="flex justify-center gap-10">
              <button
                type="button"
                onClick={toggleMute}
                className={cn(
                  "flex flex-col items-center gap-2",
                  session.muted && "text-destructive"
                )}
              >
                <span className="size-14 rounded-full bg-card/50 border border-border/60 flex items-center justify-center">
                  {session.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                </span>
                <span className="text-xs text-muted-foreground">Mute</span>
              </button>
              <button type="button" className="flex flex-col items-center gap-2 opacity-80">
                <span className="size-14 rounded-full bg-card/50 border border-border/60 flex items-center justify-center">
                  <Users className="size-6" />
                </span>
                <span className="text-xs text-muted-foreground">{participants.length} in call</span>
              </button>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void endGroupCall()}
                className="size-16 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-lg"
                aria-label="End call"
              >
                <PhoneOff className="size-7" />
              </button>
            </div>
          </div>

          {session.chatId && (
            <GroupCallInviteSheet
              open={inviteOpen}
              onClose={() => setInviteOpen(false)}
              chatId={session.chatId}
              groupTitle={session.groupTitle}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
