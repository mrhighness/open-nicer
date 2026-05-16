import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, MoreVertical, Camera, Plus, Users } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { BrandTitle } from "@/components/BrandTitle";
import { homePageHead } from "@/lib/seo";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { DesktopNav } from "@/components/DesktopNav";
import { BottomNav } from "@/components/BottomNav";
import { useUnread } from "@/contexts/unread-context";
import { StatusBar } from "@/components/StatusBar";
import { useMe } from "@/lib/use-me";
import { listChatsForUser } from "@/lib/chats";
import { debounce } from "@/lib/debounce";
import { invalidateInbox, setCachedInbox } from "@/lib/inbox-cache";
import type { ChatWithMeta, Message } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NewChatActionSheet } from "@/components/NewChatActionSheet";
import { ChatListSelectionBar } from "@/components/ChatListSelectionBar";
import { loadChatSettings, deleteChats, blockPeers, mutePeers } from "@/lib/chat-settings";
import { subscribeInboxTyping } from "@/lib/typing-inbox";
import { isPeerMuted } from "@/lib/chat-settings";
import { toast } from "sonner";
import { ChatListRow } from "@/components/ChatListRow";

export const Route = createFileRoute("/")({
  head: () => homePageHead(),
  component: ChatListPage,
});

const FILTERS = ["All", "Unread", "Groups", "Favorites"] as const;
type Filter = typeof FILTERS[number];

function ChatListPage() {
  const { me, loading } = useMe();
  const navigate = useNavigate();
  const { getCount, refresh } = useUnread();
  const [chats, setChats] = useState<ChatWithMeta[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [newChatSheetOpen, setNewChatSheetOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [typingChats, setTypingChats] = useState<Record<string, boolean>>({});
  const hasNoChats = chats !== null && chats.length === 0;

  const reload = useCallback(
    (opts?: { skipCache?: boolean }) => {
      if (!me) return Promise.resolve();
      if (opts?.skipCache) invalidateInbox(me.id);
      return listChatsForUser(me.id, { skipCache: !!opts?.skipCache })
        .then((c) => {
          setChats(c);
          return refresh();
        })
        .catch(console.error);
    },
    [me, refresh]
  );

  const bumpChatPreview = useCallback(
    (m: Message) => {
      if (!me) return;
      setChats((prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((c) => c.id === m.chat_id);
        if (idx < 0) {
          void reload({ skipCache: true });
          return prev;
        }
        const next = [...prev];
        const row = { ...next[idx], lastMessage: m };
        next.splice(idx, 1);
        next.unshift(row);
        setCachedInbox(me.id, next);
        return next;
      });
      void refresh();
    },
    [me, reload, refresh]
  );

  const debouncedFullReload = useMemo(
    () =>
      debounce(() => {
        void reload({ skipCache: true });
      }, 600),
    [reload]
  );

  useEffect(() => {
    if (!me) return;
    void loadChatSettings(me.id);
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    void reload();

    const channel = supabase
      .channel("chat-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (!alive) return;
          bumpChatPreview(payload.new as Message);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          if (!alive) return;
          bumpChatPreview(payload.new as Message);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        if (!alive) return;
        void reload({ skipCache: true });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        if (!alive) return;
        debouncedFullReload();
      })
      .subscribe();

    return () => {
      alive = false;
      debouncedFullReload.cancel();
      supabase.removeChannel(channel);
    };
  }, [me, reload, bumpChatPreview, debouncedFullReload]);

  useEffect(() => {
    if (!me || !chats?.length) {
      setTypingChats({});
      return;
    }
    const ids = chats.map((c) => c.id);
    return subscribeInboxTyping(ids, me.id, (chatId, typing) => {
      setTypingChats((prev) => {
        if (!typing) {
          if (!prev[chatId]) return prev;
          const next = { ...prev };
          delete next[chatId];
          return next;
        }
        return { ...prev, [chatId]: true };
      });
    });
  }, [me?.id, chats]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (chatId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const selectedChats = (chats ?? []).filter((c) => selectedIds.has(c.id));
  const selectedPeerIds = [...new Set(selectedChats.map((c) => c.other.id))];

  const handleDeleteSelected = async () => {
    if (!me || selectedIds.size === 0) return;
    try {
      await deleteChats(me.id, [...selectedIds]);
      toast.success(`Deleted ${selectedIds.size} chat${selectedIds.size === 1 ? "" : "s"}`);
      exitSelectMode();
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't delete chats");
    }
  };

  const handleBlockSelected = async () => {
    if (!me || selectedPeerIds.length === 0) return;
    try {
      await blockPeers(me.id, selectedPeerIds);
      toast.success(`Blocked ${selectedPeerIds.length} user${selectedPeerIds.length === 1 ? "" : "s"}`);
      exitSelectMode();
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't block");
    }
  };

  const handleMuteSelected = async () => {
    if (!me || selectedPeerIds.length === 0) return;
    try {
      await mutePeers(me.id, selectedPeerIds);
      toast.success(`Muted ${selectedPeerIds.length} chat${selectedPeerIds.length === 1 ? "" : "s"}`);
      exitSelectMode();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't mute");
    }
  };

  const filtered = (chats ?? []).filter((c) => {
    if (search && !c.other.username.toLowerCase().includes(search.toLowerCase())) return false;
    const unread = getCount(c.id);
    if (filter === "Unread") return unread > 0;
    if (filter === "Groups") return !!c.isGroup;
    if (filter === "Favorites") return false;
    return true;
  });

  return (
    <ResponsiveLayout>
      <StatusBar />
      <DesktopNav
        active="chats"
        trailing={
          <>
            <button
              type="button"
              className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors"
            >
              <Camera className="size-5" />
            </button>
            <Link
              to="/profile"
              className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors"
            >
              <MoreVertical className="size-5" />
            </Link>
          </>
        }
      />

      {/* Header */}
      <div className="lg:hidden flex items-center justify-between px-5 pt-2 pb-3">
        <div className="flex items-center gap-3">
          <AppLogo size="sm" />
          <div>
            <BrandTitle as="h1" size="lg" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors">
            <Camera className="size-5" />
          </button>
          <Link to="/profile" className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center transition-colors">
            <MoreVertical className="size-5" />
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 xl:px-10 pb-2">
        <Link
          to="/groups/new"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <Users className="size-4" />
          Create a group
        </Link>
      </div>

      {selectMode && (
        <ChatListSelectionBar
          count={selectedIds.size}
          onCancel={exitSelectMode}
          onDelete={() => void handleDeleteSelected()}
          onBlock={() => void handleBlockSelected()}
          onMute={() => void handleMuteSelected()}
        />
      )}

      {/* Search */}
      <div className="px-4 lg:px-6 xl:px-10 pb-3">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages or users"
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-card/60 border border-border/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-4 lg:px-6 xl:px-10 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
              filter === f
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Chats */}
      <div className="flex-1 overflow-y-auto scrollbar-none pb-24 lg:pb-4">
        <div className="w-full px-2 lg:px-6 xl:px-10">
          {loading || chats === null ? (
            <ChatListSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-0.5 lg:space-y-1">
              {filtered.map((c) => (
                <ChatListRow
                  key={c.id}
                  chat={c}
                  viewerId={me?.id ?? ""}
                  unreadCount={isPeerMuted(c.other.id) ? 0 : getCount(c.id)}
                  isTyping={!!typingChats[c.id]}
                  selectMode={selectMode}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={() => toggleSelect(c.id)}
                  onEnterSelect={() => {
                    setSelectMode(true);
                    setSelectedIds(new Set([c.id]));
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FAB — hidden in selection mode */}
      {!selectMode && hasNoChats && me ? (
        <>
          <button
            type="button"
            onClick={() => setNewChatSheetOpen(true)}
            className="fixed lg:absolute right-5 lg:right-8 xl:right-10 bottom-24 lg:bottom-8 size-14 rounded-2xl bg-gradient-primary shadow-fab flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-transform z-50"
            aria-label="Start chatting"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
          <NewChatActionSheet
            open={newChatSheetOpen}
            onClose={() => setNewChatSheetOpen(false)}
            me={me}
            onNewChat={() => navigate({ to: "/new" })}
          />
        </>
      ) : !selectMode ? (
        <Link
          to="/new"
          className="fixed lg:absolute right-5 lg:right-8 xl:right-10 bottom-24 lg:bottom-8 size-14 rounded-2xl bg-gradient-primary shadow-fab flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-transform z-50"
          aria-label="New chat"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </Link>
      ) : null}

      {/* Bottom nav */}
      <BottomNav active="chats" />
    </ResponsiveLayout>
  );
}

function ChatListSkeleton() {
  return (
    <ul className="space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3 lg:border lg:border-border/40 lg:bg-card/20 lg:rounded-2xl">
          <div className="size-13 size-[52px] rounded-full bg-muted/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-muted/30 rounded animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <AppLogo size="lg" className="mx-auto mb-4" />
      <h3 className="font-semibold text-lg">No chats yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[280px] mx-auto">
        Tap + to invite friends or start a new chat.
      </p>
      <Link
        to="/about"
        className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
      >
        What is Open Nicer?
      </Link>
    </div>
  );
}

