import type { ChatWithMeta } from "@/lib/types";

let cached: { userId: string; data: ChatWithMeta[]; at: number } | null = null;
const TTL_MS = 8_000;

export function getCachedInbox(userId: string): ChatWithMeta[] | null {
  if (!cached || cached.userId !== userId) return null;
  if (Date.now() - cached.at > TTL_MS) return null;
  return cached.data;
}

export function setCachedInbox(userId: string, data: ChatWithMeta[]) {
  cached = { userId, data, at: Date.now() };
}

export function invalidateInbox(userId?: string) {
  if (!userId || cached?.userId === userId) cached = null;
}

export function patchCachedInboxMessage(
  userId: string,
  chatId: string,
  patch: Partial<ChatWithMeta["lastMessage"]> & { created_at?: string }
) {
  if (!cached || cached.userId !== userId) return;
  cached.data = cached.data.map((c) => {
    if (c.id !== chatId) return c;
    const lastMessage = c.lastMessage
      ? { ...c.lastMessage, ...patch }
      : patch.id
        ? (patch as ChatWithMeta["lastMessage"])
        : null;
    return { ...c, lastMessage };
  });
  cached.at = Date.now();
}
