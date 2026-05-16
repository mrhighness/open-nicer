import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type TypingPayload = {
  userId: string;
  username: string;
  typing: boolean;
};

const TYPING_EVENT = "typing";
const IDLE_MS = 2_000;

export function subscribeTyping(
  chatId: string,
  myId: string,
  onOtherTyping: (payload: TypingPayload | null) => void
) {
  const channel = supabase
    .channel(`typing:${chatId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: TYPING_EVENT }, ({ payload }) => {
      const p = payload as TypingPayload;
      if (p.userId === myId) return;
      onOtherTyping(p.typing ? p : null);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function createTypingBroadcaster(chatId: string, userId: string, username: string) {
  let channel: RealtimeChannel | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let isTyping = false;

  const getChannel = () => {
    if (!channel) {
      channel = supabase.channel(`typing:${chatId}`, { config: { broadcast: { self: false } } });
      void channel.subscribe();
    }
    return channel;
  };

  const send = (typing: boolean) => {
    if (isTyping === typing) return;
    isTyping = typing;
    void getChannel().send({
      type: "broadcast",
      event: TYPING_EVENT,
      payload: { userId, username, typing } satisfies TypingPayload,
    });
  };

  return {
    signalTyping() {
      send(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => send(false), IDLE_MS);
    },
    stopTyping() {
      if (idleTimer) clearTimeout(idleTimer);
      send(false);
    },
    destroy() {
      if (idleTimer) clearTimeout(idleTimer);
      send(false);
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}
