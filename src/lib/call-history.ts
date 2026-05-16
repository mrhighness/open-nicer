export type CallLogDirection = "incoming" | "outgoing" | "missed";

export type CallLogEntry = {
  id: string;
  callId: string;
  chatId: string;
  otherUserId: string;
  otherName: string;
  otherAvatar: string | null;
  direction: CallLogDirection;
  video: boolean;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
};

const STORAGE_KEY = "nicer.call.history";
const MAX_ENTRIES = 100;

function loadRaw(userId: string): CallLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}.${userId}`);
    return raw ? (JSON.parse(raw) as CallLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRaw(userId: string, entries: CallLogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_KEY}.${userId}`, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function getCallHistory(userId: string): CallLogEntry[] {
  return loadRaw(userId).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function addCallLogEntry(userId: string, entry: CallLogEntry) {
  const entries = [entry, ...loadRaw(userId)];
  saveRaw(userId, entries);
  return entries;
}

export function updateCallLogEntry(
  userId: string,
  callId: string,
  patch: Partial<Pick<CallLogEntry, "direction" | "endedAt" | "durationSec">>
) {
  const entries = loadRaw(userId).map((e) => (e.callId === callId ? { ...e, ...patch } : e));
  saveRaw(userId, entries);
  return entries;
}

export function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatCallListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
