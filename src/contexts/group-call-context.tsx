import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { sendCallLogMessage, updateCallLogMessage } from "@/lib/call-messages";
import {
  addGroupCallParticipant,
  endGroupActiveCall,
  registerGroupActiveCall,
} from "@/lib/group-active-calls";
import { waitForChannelSubscribed } from "@/lib/realtime-channel";
import { finalGroupCallStatus, type CallLogTracker } from "@/lib/call-log-sync";
import { getGroupMembers } from "@/lib/groups";
import { listChatsForUser } from "@/lib/chats";
import { GroupCallEngine } from "@/lib/webrtc/group-call-engine";
import type { GroupCallSession, GroupCallSignal } from "@/lib/webrtc/group-call-types";
import { EMPTY_GROUP_CALL } from "@/lib/webrtc/group-call-types";
import type { CallPeer } from "@/lib/webrtc/types";
import { useMe } from "@/lib/use-me";
import { playCallSound, stopCallSound } from "@/lib/call-sounds";
import { dismissGroupCall, isGroupCallDismissed } from "@/lib/group-call-dismissed";
import { isOnboardingComplete } from "@/lib/onboarding";
import { toast } from "sonner";

type GroupCallInvite = {
  chatId: string;
  callId: string;
  groupTitle: string;
  hostId: string;
  hostUsername: string;
  hostAvatar: string | null;
};

type GroupCallContextValue = {
  session: GroupCallSession;
  startGroupCall: (chatId: string, groupTitle: string) => Promise<void>;
  acceptGroupCall: () => Promise<void>;
  rejoinGroupCall: (opts: {
    chatId: string;
    callId: string;
    groupTitle: string;
    hostId: string;
  }) => Promise<void>;
  endGroupCall: () => Promise<void>;
  toggleMute: () => void;
  incomingGroupCall: { chatId: string; callId: string; groupTitle: string; hostId: string } | null;
};

const GroupCallContext = createContext<GroupCallContextValue | null>(null);

export function GroupCallProvider({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const [session, setSession] = useState<GroupCallSession>(() => ({
    ...EMPTY_GROUP_CALL,
    participants: new Map(),
  }));
  const [incoming, setIncoming] = useState<GroupCallContextValue["incomingGroupCall"]>(null);
  const engineRef = useRef<GroupCallEngine | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const ringChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const hostRef = useRef<CallPeer | null>(null);
  const callLogRef = useRef<CallLogTracker | null>(null);
  const hostIdRef = useRef<string | null>(null);

  useEffect(() => {
    stopCallSound();
    setIncoming(null);
  }, []);

  const clearIncomingForCall = useCallback((chatId: string, callId: string) => {
    dismissGroupCall(callId);
    setIncoming((inc) => {
      if (inc?.chatId === chatId && inc?.callId === callId) {
        stopCallSound();
        return null;
      }
      return inc;
    });
  }, []);

  const broadcastRingInvite = useCallback(
    (chatId: string, callId: string, groupTitle: string) => {
      if (!me) return;
      const ring = ringChannelsRef.current.get(chatId);
      if (!ring) return;
      void ring.send({
        type: "broadcast",
        event: "group-call-invite",
        payload: {
          chatId,
          callId,
          groupTitle,
          hostId: me.id,
          hostUsername: me.username,
          hostAvatar: me.avatar_url,
        } satisfies GroupCallInvite,
      });
    },
    [me]
  );

  const broadcastRingEnd = useCallback((chatId: string, callId: string) => {
    const ring = ringChannelsRef.current.get(chatId);
    if (!ring) return;
    void ring.send({
      type: "broadcast",
      event: "group-call-end",
      payload: { chatId, callId },
    });
  }, []);

  useEffect(() => {
    const engine = new GroupCallEngine({
      onSessionChange: (s) => setSession({ ...s, participants: new Map(s.participants) }),
    });
    engineRef.current = engine;
    engine.resetSession();
    engine.setSendSignal((chatId, callId, partial) => {
      const key = `${chatId}:${callId}`;
      const ch = channelsRef.current.get(key);
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "group-webrtc", payload: { ...partial, chatId, callId } });
    });
    return () => {
      void engine.endCall();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setMeId(me?.id ?? "");
  }, [me?.id]);

  const ensureChannel = useCallback(
    (chatId: string, callId: string) => {
      if (!me || !callId) return;
      const key = `${chatId}:${callId}`;
      if (channelsRef.current.has(key)) return;

      const channel = supabase
        .channel(`webrtc-group:${chatId}:${callId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "group-webrtc" }, ({ payload }) => {
          const signal = payload as GroupCallSignal;
          if (signal.to !== "*" && signal.to !== me.id) return;

          if (signal.type === "group-end") {
            clearIncomingForCall(signal.chatId, signal.callId);
          }

          if (
            isOnboardingComplete() &&
            signal.type === "group-start" &&
            signal.from !== me.id &&
            !engineRef.current?.isActive()
          ) {
            if (isGroupCallDismissed(signal.callId)) return;
            hostRef.current = {
              id: signal.from,
              username: signal.participants?.[0]?.username ?? "Host",
              avatar_url: signal.participants?.[0]?.avatar_url ?? null,
            };
            hostIdRef.current = signal.from;
            setIncoming({
              chatId: signal.chatId,
              callId: signal.callId,
              groupTitle: signal.groupTitle ?? "Group call",
              hostId: signal.from,
            });
            return;
          }
          void engineRef.current?.handleSignal(signal, {
            id: me.id,
            username: me.username,
            avatar_url: me.avatar_url,
          });
        })
        .subscribe();

      channelsRef.current.set(key, channel);
    },
    [me, clearIncomingForCall]
  );

  const handleInvite = useCallback(
    (invite: GroupCallInvite) => {
      if (!me || invite.hostId === me.id) return;
      if (!isOnboardingComplete()) return;
      if (isGroupCallDismissed(invite.callId)) return;
      ensureChannel(invite.chatId, invite.callId);
      if (engineRef.current?.isActive()) return;
      hostRef.current = {
        id: invite.hostId,
        username: invite.hostUsername,
        avatar_url: invite.hostAvatar,
      };
      hostIdRef.current = invite.hostId;
      setIncoming({
        chatId: invite.chatId,
        callId: invite.callId,
        groupTitle: invite.groupTitle,
        hostId: invite.hostId,
      });
    },
    [me, ensureChannel]
  );

  const subscribeGroupRing = useCallback(
    async (chatId: string) => {
      if (!me) return;
      const existing = ringChannelsRef.current.get(chatId);
      if (existing) {
        if (existing.state !== "joined") {
          await waitForChannelSubscribed(existing).catch(() => {});
        }
        return;
      }

      const channel = supabase
        .channel(`webrtc-group-ring:${chatId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "group-call-invite" }, ({ payload }) => {
          handleInvite(payload as GroupCallInvite);
        })
        .on("broadcast", { event: "group-call-end" }, ({ payload }) => {
          const p = payload as { chatId: string; callId: string };
          if (p.chatId && p.callId) clearIncomingForCall(p.chatId, p.callId);
        });

      ringChannelsRef.current.set(chatId, channel);
      await waitForChannelSubscribed(channel).catch(() => {});
    },
    [me, handleInvite, clearIncomingForCall]
  );

  const unsubscribeRings = useCallback(() => {
    ringChannelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    ringChannelsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!me) {
      unsubscribeRings();
      return;
    }

    let alive = true;

    const setup = async () => {
      try {
        const chats = await listChatsForUser(me.id);
        if (!alive) return;
        for (const c of chats.filter((g) => g.chat_type === "group")) {
          await subscribeGroupRing(c.id);
        }
      } catch (e) {
        console.error("Group call ring setup failed:", e);
      }
    };

    void setup();

    const inbox = supabase
      .channel(`group-call-inbox:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_members" }, (payload) => {
        const row = payload.new as { profile_id?: string };
        if (row.profile_id === me.id) void setup();
      })
      .subscribe();

    const notifChannel = supabase
      .channel(`group-call-notifs:${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_notifications",
          filter: `recipient_id=eq.${me.id}`,
        },
        (payload) => {
          const row = payload.new as {
            type?: string;
            chat_id?: string;
            payload?: {
              callId?: string;
              groupTitle?: string;
              hostId?: string;
              hostUsername?: string;
              hostAvatar?: string | null;
            };
          };
          if (row.type !== "group_call" || !row.chat_id || !row.payload?.callId || !row.payload.hostId) return;
          handleInvite({
            chatId: row.chat_id,
            callId: row.payload.callId,
            groupTitle: row.payload.groupTitle ?? "Group call",
            hostId: row.payload.hostId,
            hostUsername: row.payload.hostUsername ?? "Host",
            hostAvatar: row.payload.hostAvatar ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(inbox);
      supabase.removeChannel(notifChannel);
      unsubscribeRings();
    };
  }, [me?.id, subscribeGroupRing, unsubscribeRings, handleInvite]);

  useEffect(() => {
    if (session.chatId && session.callId) {
      ensureChannel(session.chatId, session.callId);
    }
  }, [session.chatId, session.callId, ensureChannel]);

  useEffect(() => {
    if (incoming) {
      playCallSound("groupIncoming");
    } else if (session.phase === "idle") {
      stopCallSound();
    }
  }, [incoming, session.phase]);

  // Dismiss incoming UI when the call ends (host hung up or we left)
  useEffect(() => {
    if (session.phase !== "ended") return;
    setIncoming(null);
    stopCallSound();
  }, [session.phase]);

  useEffect(() => {
    if (!me) return;
    const s = session;

    if (
      s.isHost &&
      s.phase === "outgoing" &&
      s.callId &&
      s.chatId &&
      (!callLogRef.current || callLogRef.current.callId !== s.callId)
    ) {
      callLogRef.current = { callId: s.callId, chatId: s.chatId, sentStart: true, wasActive: false };
      hostIdRef.current = me.id;
      void (async () => {
        const messageId = await sendCallLogMessage({
          chatId: s.chatId,
          senderId: me.id,
          meta: {
            callId: s.callId,
            kind: "group",
            status: "ringing",
            initiatorId: me.id,
            groupTitle: s.groupTitle,
            joinedUserIds: [me.id],
          },
        });
        if (messageId && callLogRef.current?.callId === s.callId) {
          callLogRef.current.messageId = messageId;
          await registerGroupActiveCall({
            chatId: s.chatId,
            callId: s.callId,
            hostId: me.id,
            messageId,
            groupTitle: s.groupTitle,
          });
        }
      })();
    }

    if (s.isHost && s.phase === "active" && callLogRef.current?.callId === s.callId && callLogRef.current.messageId) {
      callLogRef.current.wasActive = true;
      const joinedUserIds = [...s.participants.keys()];
      void updateCallLogMessage(callLogRef.current.messageId, {
        chatId: s.chatId,
        senderId: me.id,
        meta: {
          callId: s.callId,
          kind: "group",
          status: "live",
          initiatorId: me.id,
          groupTitle: s.groupTitle,
          joinedUserIds,
        },
      });
    }

    if (s.isHost && s.phase === "ended" && callLogRef.current?.callId === s.callId) {
      const tracker = callLogRef.current;
      const status = finalGroupCallStatus(s, tracker, true);
      const meta = {
        callId: s.callId,
        kind: "group" as const,
        status,
        initiatorId: me.id,
        groupTitle: s.groupTitle,
        joinedUserIds: [...s.participants.keys()],
      };
      void endGroupActiveCall(s.chatId);
      if (tracker.messageId) {
        void updateCallLogMessage(tracker.messageId, { chatId: s.chatId, senderId: me.id, meta });
      }
      callLogRef.current = null;
      hostIdRef.current = null;
    }
  }, [session.phase, session.callId, session.chatId, session.isHost, session.participants, me]);

  const startGroupCall = useCallback(
    async (chatId: string, groupTitle: string) => {
      if (!me || !engineRef.current) return;
      try {
        await subscribeGroupRing(chatId);
        const members = await getGroupMembers(chatId);
        const notifyIds = members.map((m) => m.id).filter((id) => id !== me.id);
        await engineRef.current.startGroupCall(chatId, groupTitle, notifyIds, {
          id: me.id,
          username: me.username,
          avatar_url: me.avatar_url,
        });
        const { callId } = engineRef.current.getSession();
        if (callId) {
          ensureChannel(chatId, callId);
          broadcastRingInvite(chatId, callId, groupTitle);
          window.setTimeout(() => broadcastRingInvite(chatId, callId, groupTitle), 400);
          window.setTimeout(() => broadcastRingInvite(chatId, callId, groupTitle), 1200);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start group call");
      }
    },
    [me, subscribeGroupRing, ensureChannel, broadcastRingInvite]
  );

  const acceptGroupCall = useCallback(async () => {
    if (!me || !incoming || !engineRef.current) return;
    ensureChannel(incoming.chatId, incoming.callId);
    const host = hostRef.current ?? { id: incoming.hostId, username: "Host", avatar_url: null };
    await engineRef.current.handleSignal(
      {
        type: "group-start",
        callId: incoming.callId,
        chatId: incoming.chatId,
        from: incoming.hostId,
        to: me.id,
        groupTitle: incoming.groupTitle,
      },
      { id: me.id, username: me.username, avatar_url: me.avatar_url }
    );
    await engineRef.current.acceptIncoming(host, {
      id: me.id,
      username: me.username,
      avatar_url: me.avatar_url,
    });
    await addGroupCallParticipant(incoming.chatId, me.id);
    setIncoming(null);
  }, [me, incoming, ensureChannel]);

  const rejoinGroupCall = useCallback(
    async (opts: { chatId: string; callId: string; groupTitle: string; hostId: string }) => {
      if (!me || !engineRef.current) return;
      await subscribeGroupRing(opts.chatId);
      ensureChannel(opts.chatId, opts.callId);
      hostRef.current = hostRef.current ?? {
        id: opts.hostId,
        username: "Host",
        avatar_url: null,
      };
      await engineRef.current.joinGroupCall(
        opts.chatId,
        opts.callId,
        opts.groupTitle,
        hostRef.current
      );
      await addGroupCallParticipant(opts.chatId, me.id);
      setIncoming(null);
    },
    [me, subscribeGroupRing, ensureChannel]
  );

  const value = useMemo<GroupCallContextValue>(
    () => ({
      session,
      startGroupCall,
      acceptGroupCall,
      rejoinGroupCall,
      endGroupCall: async () => {
        const inc = incoming;
        const endChatId = session.chatId || inc?.chatId;
        const endCallId = session.callId || inc?.callId;
        if (endCallId) dismissGroupCall(endCallId);
        setIncoming(null);
        const wasHost = session.isHost;
        await engineRef.current?.endCall();
        if (endChatId && endCallId) broadcastRingEnd(endChatId, endCallId);
        if (wasHost && endChatId) await endGroupActiveCall(endChatId);
        channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
        channelsRef.current.clear();
      },
      toggleMute: () => engineRef.current?.toggleMute(),
      incomingGroupCall: incoming,
    }),
    [session, startGroupCall, acceptGroupCall, rejoinGroupCall, incoming, broadcastRingEnd]
  );

  return <GroupCallContext.Provider value={value}>{children}</GroupCallContext.Provider>;
}

export function useGroupCall() {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error("useGroupCall must be used within GroupCallProvider");
  return ctx;
}
