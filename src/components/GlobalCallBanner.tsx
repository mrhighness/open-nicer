import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Phone, Users } from "lucide-react";
import { useCall } from "@/contexts/call-context";
import { useGroupCall } from "@/contexts/group-call-context";
import { isOnboardingComplete } from "@/lib/onboarding";

/** Floating banner for 1:1 and group calls — visible on any screen. */
export function GlobalCallBanner() {
  const { session: call1, acceptCall, endCall } = useCall();
  const { incomingGroupCall, acceptGroupCall, endGroupCall, session: groupSession } = useGroupCall();

  if (!isOnboardingComplete()) return null;

  if (incomingGroupCall && groupSession.phase === "idle") {
    return (
      <motion.div
        className="fixed top-0 left-0 right-0 z-[105] safe-area-pad px-3 pt-2 pointer-events-none"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <motion.div className="max-w-lg mx-auto pointer-events-auto flex gap-2 p-3 rounded-2xl bg-primary/95 text-primary-foreground shadow-lg border border-primary-glow/40">
          <Users className="size-5 shrink-0 mt-0.5" />
          <motion.div
            className="flex-1 min-w-0 text-left"
            animate={{ opacity: [1, 0.85, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <p className="text-sm font-semibold truncate">Incoming group call</p>
            <p className="text-xs opacity-90 truncate">{incomingGroupCall.groupTitle}</p>
          </motion.div>
          <motion.div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void endGroupCall()}
              className="px-3 py-1.5 rounded-xl bg-black/20 text-xs font-semibold"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => void acceptGroupCall()}
              className="px-3 py-1.5 rounded-xl bg-background text-primary text-xs font-semibold"
            >
              Join
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  if (call1.phase === "incoming") {
    return (
      <motion.div
        className="fixed top-0 left-0 right-0 z-[105] safe-area-pad px-3 pt-2 pointer-events-none"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="max-w-lg mx-auto pointer-events-auto flex gap-2 p-3 rounded-2xl bg-primary/95 text-primary-foreground shadow-lg">
          <Phone className="size-5 shrink-0 mt-0.5" />
          <motion.div
            className="flex-1 min-w-0 text-left"
            animate={{ opacity: [1, 0.85, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <p className="text-sm font-semibold truncate">
              Incoming {call1.video ? "video" : "voice"} call
            </p>
            <p className="text-xs opacity-90 truncate">{call1.peer.username}</p>
          </motion.div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void endCall()}
              className="px-3 py-1.5 rounded-xl bg-black/20 text-xs font-semibold"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => void acceptCall()}
              className="px-3 py-1.5 rounded-xl bg-background text-primary text-xs font-semibold"
            >
              Answer
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (call1.phase === "outgoing") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[105] safe-area-pad px-3 pt-2 pointer-events-none">
        <Link
          to="/chat/$chatId"
          params={{ chatId: call1.chatId }}
          className="max-w-lg mx-auto pointer-events-auto flex items-center gap-2 p-3 rounded-2xl bg-card/95 border border-primary/40 shadow-lg"
        >
          <Phone className="size-5 text-primary shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold">Calling {call1.peer.username}…</p>
            <p className="text-xs text-muted-foreground">Tap to return to chat</p>
          </div>
        </Link>
      </div>
    );
  }

  if (groupSession.phase !== "idle" && groupSession.phase !== "ended") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[105] safe-area-pad px-3 pt-2 pointer-events-none">
        <Link
          to="/chat/$chatId"
          params={{ chatId: groupSession.chatId }}
          className="max-w-lg mx-auto pointer-events-auto flex items-center gap-2 p-3 rounded-2xl bg-card/95 border border-primary/40 shadow-lg"
        >
          <Users className="size-5 text-primary shrink-0" />
          <motion.div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold truncate">{groupSession.groupTitle || "Group call"}</p>
            <p className="text-xs text-muted-foreground">Tap to return to call</p>
          </motion.div>
        </Link>
      </div>
    );
  }

  return null;
}
