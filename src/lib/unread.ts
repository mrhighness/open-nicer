import { supabase } from "@/integrations/supabase/client";
import { isPeerMuted } from "@/lib/chat-settings";
import type { Message } from "./types";

const STORAGE_PREFIX = "nicer.unread.";

type PersistedUnread = {
  lastReadAt: Record<string, string>;
  bootstrapped: boolean;
};

type Listener = () => void;

class UnreadStore {
  userId: string | null = null;
  activeChatId: string | null = null;
  lastReadAt: Record<string, string> = {};
  counts: Record<string, number> = {};
  bootstrapped = false;
  private listeners = new Set<Listener>();
  private syncInFlight: Promise<void> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
    this.updateDocumentTitle();
  }

  private storageKey() {
    return `${STORAGE_PREFIX}${this.userId}`;
  }

  private persist() {
    if (!this.userId || typeof window === "undefined") return;
    const data: PersistedUnread = {
      lastReadAt: this.lastReadAt,
      bootstrapped: this.bootstrapped,
    };
    window.localStorage.setItem(this.storageKey(), JSON.stringify(data));
  }

  init(userId: string) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.counts = {};
    this.lastReadAt = {};
    this.bootstrapped = false;

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(this.storageKey());
        if (raw) {
          const parsed = JSON.parse(raw) as PersistedUnread;
          this.lastReadAt = parsed.lastReadAt ?? {};
          this.bootstrapped = parsed.bootstrapped ?? false;
        }
      } catch {
        this.lastReadAt = {};
      }
    }
    this.notify();
  }

  reset() {
    this.userId = null;
    this.activeChatId = null;
    this.lastReadAt = {};
    this.counts = {};
    this.bootstrapped = false;
    this.notify();
  }

  setActiveChatId(chatId: string | null) {
    if (this.activeChatId === chatId) return;
    this.activeChatId = chatId;
    if (chatId) this.markChatRead(chatId);
  }

  getCount(chatId: string) {
    return this.counts[chatId] ?? 0;
  }

  getTotal() {
    return Object.values(this.counts).reduce((sum, n) => sum + n, 0);
  }

  setCounts(counts: Record<string, number>) {
    this.counts = counts;
    this.notify();
  }

  markChatRead(chatId: string, at?: string) {
    const timestamp = at ?? new Date().toISOString();
    this.lastReadAt[chatId] = timestamp;
    if (this.counts[chatId]) {
      const next = { ...this.counts };
      delete next[chatId];
      this.counts = next;
    }
    this.persist();
    this.notify();
  }

  handleIncomingMessage(message: Pick<Message, "chat_id" | "sender_id" | "created_at" | "is_deleted">, meId: string) {
    if (message.is_deleted || message.sender_id === meId) return;
    if (isPeerMuted(message.sender_id)) return;

    if (message.chat_id === this.activeChatId) {
      this.markChatRead(message.chat_id, message.created_at);
      return;
    }

    const lastRead = this.lastReadAt[message.chat_id];
    if (lastRead && new Date(message.created_at) <= new Date(lastRead)) return;

    this.counts = {
      ...this.counts,
      [message.chat_id]: (this.counts[message.chat_id] ?? 0) + 1,
    };
    this.notify();
  }

  async sync(meId: string, chatIds: string[]) {
    if (!meId || chatIds.length === 0) {
      this.setCounts({});
      return;
    }

    if (this.syncInFlight) return this.syncInFlight;

    this.syncInFlight = (async () => {
      if (!this.bootstrapped) {
        await this.bootstrapLastRead(meId, chatIds);
      }
      const counts = await fetchUnreadCounts(meId, this.lastReadAt, chatIds);
      this.setCounts(counts);
    })().finally(() => {
      this.syncInFlight = null;
    });

    return this.syncInFlight;
  }

  private async bootstrapLastRead(meId: string, chatIds: string[]) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("chat_id, created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false });

    const latestByChat = new Map<string, string>();
    for (const m of msgs ?? []) {
      if (!latestByChat.has(m.chat_id)) latestByChat.set(m.chat_id, m.created_at);
    }

    const { data: chats } = await supabase.from("chats").select("id, created_at").in("id", chatIds);
    const now = new Date().toISOString();

    for (const chatId of chatIds) {
      if (!this.lastReadAt[chatId]) {
        this.lastReadAt[chatId] = latestByChat.get(chatId) ?? chats?.find((c) => c.id === chatId)?.created_at ?? now;
      }
    }

    this.bootstrapped = true;
    this.persist();
  }

  private updateDocumentTitle() {
    if (typeof document === "undefined") return;
    const total = this.getTotal();
    const base = "Open Nicer";
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }
}

export const unreadStore = new UnreadStore();

export async function fetchUnreadCounts(
  meId: string,
  lastReadAt: Record<string, string>,
  chatIds: string[]
): Promise<Record<string, number>> {
  if (!chatIds.length) return {};

  const { data, error } = await supabase.rpc("get_unread_counts_for_chats", {
    p_me_id: meId,
    p_chat_ids: chatIds,
    p_last_read: lastReadAt,
  });

  if (!error && data) {
    const counts: Record<string, number> = {};
    for (const row of data as { chat_id: string; unread_count: number }[]) {
      if (row.unread_count > 0) counts[row.chat_id] = Number(row.unread_count);
    }
    return counts;
  }

  const { data: msgs, error: fallbackErr } = await supabase
    .from("messages")
    .select("chat_id, created_at")
    .in("chat_id", chatIds)
    .neq("sender_id", meId)
    .eq("is_deleted", false);

  if (fallbackErr) throw fallbackErr;

  const counts: Record<string, number> = {};
  for (const m of msgs ?? []) {
    const lastRead = lastReadAt[m.chat_id];
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      counts[m.chat_id] = (counts[m.chat_id] ?? 0) + 1;
    }
  }
  return counts;
}

export async function syncUnreadForUser(meId: string) {
  const [{ data: dmRows }, { data: memberships }] = await Promise.all([
    supabase.from("chats").select("id").or(`user_a.eq.${meId},user_b.eq.${meId}`),
    supabase.from("chat_members").select("chat_id").eq("profile_id", meId),
  ]);
  const ids = new Set<string>();
  for (const c of dmRows ?? []) ids.add(c.id);
  for (const m of memberships ?? []) ids.add(m.chat_id);
  await unreadStore.sync(meId, [...ids]);
}
