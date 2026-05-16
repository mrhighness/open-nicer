import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Video, ArrowLeft, PhoneMissed, PhoneIncoming, PhoneOutgoing, Plus } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { DesktopNav } from "@/components/DesktopNav";
import { BottomNav } from "@/components/BottomNav";
import { useCall } from "@/contexts/call-context";
import { useGroupCall } from "@/contexts/group-call-context";
import { formatCallDuration, formatCallListTime, type CallLogEntry } from "@/lib/call-history";

import { EM_DASH, pageHead } from "@/lib/seo";
import { PRODUCT } from "@/lib/product";

export const Route = createFileRoute("/calls")({
  head: () =>
    pageHead({
      title: `Calls ${EM_DASH} ${PRODUCT.name}`,
      description: `Voice and video call history on ${PRODUCT.name}. Free WebRTC calls with no sign-up.`,
      path: "/calls",
      index: false,
    }),
  component: CallsPage,
});

function CallsPage() {
  const { history, startCall, session } = useCall();
  const { session: groupSession, incomingGroupCall } = useGroupCall();
  const activeLabel =
    session.phase === "incoming"
      ? `Incoming ${session.video ? "video" : "voice"} call from ${session.peer.username}`
      : session.phase === "outgoing"
        ? `Calling ${session.peer.username}…`
        : session.phase === "active" || session.phase === "connecting"
          ? `On call with ${session.peer.username}`
          : incomingGroupCall
            ? `Incoming group call · ${incomingGroupCall.groupTitle}`
            : groupSession.phase !== "idle" && groupSession.phase !== "ended"
              ? `Group call · ${groupSession.groupTitle || "In progress"}`
              : null;

  return (
    <ResponsiveLayout>
      <StatusBar />
      <DesktopNav
        active="calls"
        trailing={
          <Link
            to="/new"
            className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors"
            aria-label="New chat"
          >
            <Plus className="size-5" />
          </Link>
        }
      />

      <div className="lg:hidden flex min-w-0 items-center justify-between gap-2 px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="lg:hidden size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight font-display">Calls</h1>
            <p className="text-xs text-muted-foreground lg:hidden">Recent call history</p>
          </div>
        </div>
        <Link
          to="/new"
          className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors"
          aria-label="New chat"
        >
          <Plus className="size-5" />
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none pb-24 lg:pb-4">
        <div className="w-full min-w-0 px-2 lg:px-6 xl:px-10">
          {activeLabel && (
            <div className="mb-3 px-3 py-2.5 rounded-2xl bg-primary/15 border border-primary/40 text-sm font-medium text-primary">
              {activeLabel}
            </div>
          )}
          {history.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-1">
              {history.map((call) => (
                <CallRow key={call.id} call={call} disabled={session.phase !== "idle"} onStartCall={startCall} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <BottomNav active="calls" />
    </ResponsiveLayout>
  );
}

function CallStatusPill({ call }: { call: CallLogEntry }) {
  const ongoing = !call.endedAt && !call.durationSec;
  if (ongoing) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-primary/20 text-primary">
        Ongoing
      </span>
    );
  }
  if (call.direction === "missed") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive">
        Missed
      </span>
    );
  }
  if (call.direction === "incoming") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-online/15 text-online">
        Incoming
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
      Outgoing
    </span>
  );
}

function CallRow({
  call,
  disabled,
  onStartCall,
}: {
  call: CallLogEntry;
  disabled: boolean;
  onStartCall: (
    chatId: string,
    peer: { id: string; username: string; avatar_url: string | null },
    video: boolean
  ) => Promise<void>;
}) {
  const getCallIcon = () => {
    if (call.direction === "missed") return <PhoneMissed className="size-4 text-destructive" />;
    if (call.direction === "incoming") return <PhoneIncoming className="size-4 text-online" />;
    return <PhoneOutgoing className="size-4 text-muted-foreground" />;
  };

  const start = (video: boolean) => {
    void onStartCall(
      call.chatId,
      { id: call.otherUserId, username: call.otherName, avatar_url: call.otherAvatar },
      video
    );
  };

  return (
    <li className="lg:col-span-1">
      <div className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-card/40 active:bg-card/60 transition-colors text-left lg:border lg:border-border/40 lg:bg-card/20 lg:hover:bg-card/60">
        <Link to="/chat/$chatId" params={{ chatId: call.chatId }} className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar src={call.otherAvatar} name={call.otherName} size={52} />
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold truncate", call.direction === "missed" && "text-destructive")}>
              {call.otherName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {getCallIcon()}
              <CallStatusPill call={call} />
              <span className="text-xs text-muted-foreground">{formatCallListTime(call.startedAt)}</span>
              {call.durationSec != null && call.durationSec > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{formatCallDuration(call.durationSec)}</span>
                </>
              )}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => start(false)}
            aria-label="Voice call"
            className="size-10 rounded-full bg-gradient-primary/20 hover:bg-gradient-primary/30 flex items-center justify-center disabled:opacity-40"
          >
            <Phone className="size-5 text-primary" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => start(true)}
            aria-label="Video call"
            className="size-10 rounded-full bg-gradient-primary/20 hover:bg-gradient-primary/30 flex items-center justify-center disabled:opacity-40"
          >
            <Video className="size-5 text-primary" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto size-20 rounded-3xl bg-gradient-primary/20 flex items-center justify-center mb-4">
        <Phone className="size-9 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">No calls yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[260px] mx-auto">
        Start a voice or video call from any chat. Your call history will appear here.
      </p>
    </div>
  );
}
