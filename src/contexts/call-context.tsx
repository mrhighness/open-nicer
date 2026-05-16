import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCallHistory, type CallLogEntry } from "@/lib/call-history";
import { finalizeCallLogMessagesForCall, sendCallLogMessage } from "@/lib/call-messages";
import { finalCallStatus, type CallLogTracker } from "@/lib/call-log-sync";
import { listChatsForUser } from "@/lib/chats";
import { CallEngine } from "@/lib/webrtc/call-engine";
import type { CallPeer, CallSession, CallSignal } from "@/lib/webrtc/types";
import { useMe } from "@/lib/use-me";
import { toast } from "sonner";

type CallContextValue = {
  session: CallSession;
  history: CallLogEntry[];
  startCall: (chatId: string, peer: CallPeer, video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  refreshHistory: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const [session, setSession] = useState<CallSession>(() => ({
    callId: "",
    chatId: "",
    peer: { id: "", username: "", avatar_url: null },
    video: false,
    direction: "outgoing",
    phase: "idle",
    startedAt: null,
    localStream: null,
    remoteStream: null,
    muted: false,
    videoEnabled: true,
    error: null,
  }));
  const [history, setHistory] = useState<CallLogEntry[]>([]);
  const engineRef = useRef<CallEngine | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const callLogRef = useRef<CallLogTracker | null>(null);

  const refreshHistory = useCallback(() => {
    if (!me) return;
    setHistory(getCallHistory(me.id));
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    refreshHistory();
  }, [me?.id, refreshHistory]);

  useEffect(() => {
    const engine = new CallEngine({
      onSessionChange: (s) => setSession({ ...s }),
      onHistoryChange: refreshHistory,
    });
    engineRef.current = engine;
    engine.setMeId(me?.id ?? "");

    engine.setSendSignal((chatId, partial) => {
      const ch = channelsRef.current.get(chatId);
      if (!ch) return;
      const payload: CallSignal = { ...partial, chatId, to: partial.to, from: partial.from };
      void ch.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload,
      });
    });

    return () => {
      void engine.endCall();
    };
  }, [refreshHistory]);

  useEffect(() => {
    engineRef.current?.setMeId(me?.id ?? "");
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    const s = session;

    if (
      (s.phase === "outgoing" || s.phase === "incoming") &&
      s.callId &&
      s.chatId &&
      (!callLogRef.current || callLogRef.current.callId !== s.callId)
    ) {
      callLogRef.current = { callId: s.callId, chatId: s.chatId, sentStart: true, wasActive: false };
      const initiatorId = s.direction === "outgoing" ? me.id : s.peer.id;
      void sendCallLogMessage({
        chatId: s.chatId,
        senderId: me.id,
        meta: {
          callId: s.callId,
          kind: s.video ? "video" : "voice",
          status: "ongoing",
          initiatorId,
          video: s.video,
        },
      }).then((id) => {
        if (id && callLogRef.current?.callId === s.callId) {
          callLogRef.current.messageId = id;
        }
      });
    }

    if ((s.phase === "active" || s.phase === "connecting") && callLogRef.current?.callId === s.callId) {
      callLogRef.current.wasActive = true;
    }

    if (s.phase === "ended" && s.callId && s.chatId) {
      const tr = callLogRef.current;
      const tracker =
        tr && tr.callId === s.callId
          ? tr
          : { callId: s.callId, chatId: s.chatId, sentStart: false, wasActive: false };
      const durationSec = s.startedAt ? Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000)) : 0;
      const status = finalCallStatus(s, tracker);
      const meta = {
        callId: s.callId,
        kind: (s.video ? "video" : "voice") as const,
        status,
        initiatorId: s.direction === "outgoing" ? me.id : s.peer.id,
        video: s.video,
        durationSec: status === "completed" ? durationSec : undefined,
      };
      void (async () => {
        const n = await finalizeCallLogMessagesForCall({ chatId: s.chatId, callId: s.callId, meta });
        if (n === 0) {
          await sendCallLogMessage({ chatId: s.chatId, senderId: me.id, meta });
        }
      })();
      if (tr?.callId === s.callId) {
        callLogRef.current = null;
      }
    }
  }, [session, me]);

  const subscribeChat = useCallback(
    (chatId: string) => {
      if (!me || channelsRef.current.has(chatId)) return;

      const channel = supabase
        .channel(`webrtc:${chatId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
          const signal = payload as CallSignal;
          if (signal.to !== me.id) return;
          if (signal.type === "offer" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
          void engineRef.current?.handleSignal(signal);
        })
        .subscribe();

      channelsRef.current.set(chatId, channel);
    },
    [me?.id]
  );

  const unsubscribeAll = useCallback(() => {
    channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!me) {
      unsubscribeAll();
      return;
    }

    let alive = true;

    const setup = async () => {
      try {
        const chats = await listChatsForUser(me.id);
        if (!alive) return;
        chats.forEach((c) => subscribeChat(c.id));
      } catch (e) {
        console.error("Call channels setup failed:", e);
      }
    };

    void setup();

    const inbox = supabase
      .channel(`webrtc-inbox:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, () => {
        void setup();
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(inbox);
      unsubscribeAll();
    };
  }, [me?.id, subscribeChat, unsubscribeAll]);

  const ensureChatChannel = useCallback(
    (chatId: string) => {
      subscribeChat(chatId);
    },
    [subscribeChat]
  );

  const startCall = useCallback(
    async (chatId: string, peer: CallPeer, video: boolean) => {
      if (!me || !engineRef.current) return;
      ensureChatChannel(chatId);
      try {
        await engineRef.current.startCall(chatId, peer, video, {
          id: me.id,
          username: me.username,
          avatar_url: me.avatar_url,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not start call";
        toast.error(msg);
        throw e;
      }
    },
    [me, ensureChatChannel]
  );

  const value = useMemo<CallContextValue>(
    () => ({
      session,
      history,
      startCall,
      acceptCall: async () => engineRef.current?.acceptCall(),
      rejectCall: () => engineRef.current?.rejectCall(),
      endCall: async () => engineRef.current?.endCall(),
      toggleMute: () => engineRef.current?.toggleMute(),
      toggleVideo: () => engineRef.current?.toggleVideo(),
      refreshHistory,
    }),
    [session, history, startCall, refreshHistory]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
