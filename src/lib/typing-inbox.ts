import { supabase } from "@/integrations/supabase/client";
import type { TypingPayload } from "@/lib/typing";

const TYPING_EVENT = "typing";

export function subscribeInboxTyping(
  chatIds: string[],
  myId: string,
  onUpdate: (chatId: string, typing: boolean) => void
) {
  const channels = chatIds.map((chatId) =>
    supabase
      .channel(`typing:${chatId}`)
      .on("broadcast", { event: TYPING_EVENT }, ({ payload }) => {
        const p = payload as TypingPayload;
        if (p.userId === myId) return;
        onUpdate(chatId, !!p.typing);
      })
      .subscribe()
  );

  return () => {
    channels.forEach((ch) => supabase.removeChannel(ch));
  };
}
