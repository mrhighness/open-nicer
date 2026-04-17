import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, MoreVertical, Camera, Pin, MessageCircle, Phone, Sparkles, CircleDot, User } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/use-me";
import { listChatsForUser } from "@/lib/chats";
import type { ChatWithMeta } from "@/lib/types";
import { formatChatListTime } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nicer Chat — Instant messaging, no sign-up" },
      { name: "description", content: "A beautiful, instant messaging experience. No accounts, just chat." },
      { property: "og:title", content: "Nicer Chat — Instant messaging, no sign-up" },
      { property: "og:description", content: "A beautiful, instant messaging experience. No accounts, just chat." },
    ],
  }),
  component: ChatListPage,
});

const FILTERS = ["All", "Unread", "Groups", "Favorites"] as const;
type Filter = typeof FILTERS[number];

function ChatListPage() {
  const { me, loading } = useMe();
  const [chats, setChats] = useState<ChatWithMeta[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!me) return;
    let alive = true;
    const refresh = () => listChatsForUser(me.id).then((c) => { if (alive) setChats(c); }).catch(console.error);
    refresh();

    // Realtime: any new message refreshes the list
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, refresh)
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [me]);

  const filtered = (chats ?? []).filter((c) => {
    if (search && !c.other.username.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <MobileFrame>
      <StatusBar />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <MessageCircle className="size-5 text-primary-foreground" strokeWidth={2.5} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-display">
              Nicer <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">Chat</span>
            </h1>
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

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
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
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
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
      <div className="flex-1 overflow-y-auto scrollbar-none pb-24">
        {loading || chats === null ? (
          <ChatListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="px-2">
            {filtered.map((c) => <ChatRow key={c.id} chat={c} />)}
          </ul>
        )}
      </div>

      {/* FAB - new chat */}
      <Link
        to="/new"
        className="absolute right-5 bottom-24 size-14 rounded-2xl bg-gradient-primary shadow-fab flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-transform"
        aria-label="New chat"
      >
        <Sparkles className="size-6" />
      </Link>

      {/* Bottom nav */}
      <BottomNav active="chats" />
    </MobileFrame>
  );
}

function ChatRow({ chat }: { chat: ChatWithMeta }) {
  const last = chat.lastMessage;
  const time = last ? formatChatListTime(last.created_at) : formatChatListTime(chat.created_at);
  return (
    <li>
      <Link
        to="/chat/$chatId"
        params={{ chatId: chat.id }}
        className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-card/40 active:bg-card/60 transition-colors"
      >
        <Avatar src={chat.other.avatar_url} name={chat.other.username} size={52} online={chat.other.is_online} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate">{chat.other.username}</h3>
            <span className="text-[11px] text-muted-foreground shrink-0">{time}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground truncate">
              {last ? (last.is_deleted ? "Message deleted" : last.content) : "Say hi 👋"}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function ChatListSkeleton() {
  return (
    <ul className="px-2 space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
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
      <div className="mx-auto size-20 rounded-3xl bg-gradient-primary/20 flex items-center justify-center mb-4">
        <Sparkles className="size-9 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">No chats yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[260px] mx-auto">
        Tap the sparkle button to start a new conversation with anyone on Nicer Chat.
      </p>
    </div>
  );
}

function BottomNav({ active }: { active: "chats" | "calls" | "ai" | "status" | "profile" }) {
  const items = [
    { key: "chats" as const, label: "Chats", icon: MessageCircle, to: "/" },
    { key: "calls" as const, label: "Calls", icon: Phone, to: "/" },
    { key: "ai" as const, label: "AI", icon: Sparkles, to: "/" },
    { key: "status" as const, label: "Status", icon: CircleDot, to: "/" },
    { key: "profile" as const, label: "Profile", icon: User, to: "/profile" },
  ];
  return (
    <nav className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-card/80 border-t border-border/60 px-2 pt-2 pb-3 flex items-center justify-around">
      {items.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
            active === it.key ? "text-primary" : "text-muted-foreground"
          )}
        >
          <it.icon className="size-5" strokeWidth={active === it.key ? 2.6 : 2} fill={active === it.key && it.key === "chats" ? "currentColor" : "none"} />
          <span className="text-[10px] font-semibold">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
