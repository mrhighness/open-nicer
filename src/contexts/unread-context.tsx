import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { unreadStore, syncUnreadForUser } from "@/lib/unread";
import type { Message } from "@/lib/types";

type UnreadContextValue = {
  getCount: (chatId: string) => number;
  totalUnread: number;
  markChatRead: (chatId: string, at?: string) => void;
  refresh: () => Promise<void>;
};

const UnreadContext = createContext<UnreadContextValue | null>(null);

const SYNC_INTERVAL_MS = 20_000;

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeChatId = pathname.startsWith("/chat/") ? pathname.split("/")[2] ?? null : null;
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => unreadStore.subscribe(() => rerender()), []);

  useEffect(() => {
    if (!me) {
      unreadStore.reset();
      return;
    }
    unreadStore.init(me.id);
    void syncUnreadForUser(me.id);
  }, [me?.id]);

  useEffect(() => {
    unreadStore.setActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (!me) return;

    const channel = supabase
      .channel(`unread-global-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          unreadStore.handleIncomingMessage(msg, me.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          void syncUnreadForUser(me.id);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        void syncUnreadForUser(me.id);
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible" && meRef.current) {
        void syncUnreadForUser(meRef.current.id);
      }
    };

    const onFocus = () => {
      if (meRef.current) void syncUnreadForUser(meRef.current.id);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && meRef.current) {
        void syncUnreadForUser(meRef.current.id);
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [me?.id]);

  const refresh = useCallback(async () => {
    if (!me) return;
    await syncUnreadForUser(me.id);
  }, [me?.id]);

  const totalUnread = unreadStore.getTotal();

  const value = useMemo<UnreadContextValue>(
    () => ({
      getCount: (chatId) => unreadStore.getCount(chatId),
      totalUnread,
      markChatRead: (chatId, at) => unreadStore.markChatRead(chatId, at),
      refresh,
    }),
    [totalUnread, refresh]
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnread must be used within UnreadProvider");
  return ctx;
}
