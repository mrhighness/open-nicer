import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Wait until a Supabase channel is subscribed (or timeout). */
export function waitForChannelSubscribed(
  channel: RealtimeChannel,
  timeoutMs = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Realtime channel subscribe timeout"));
    }, timeoutMs);

    if (channel.state === "joined") {
      window.clearTimeout(timer);
      resolve();
      return;
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timer);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        window.clearTimeout(timer);
        reject(new Error(`Realtime channel error: ${status}`));
      }
    });
  });
}

export function removeChannel(channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}
