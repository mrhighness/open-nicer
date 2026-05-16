const KEY = "nicer-dismissed-group-calls";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Entry = { at: number };

function read(): Record<string, Entry> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, Entry>;
  } catch {
    return {};
  }
}

function write(map: Record<string, Entry>) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(map));
}

export function isGroupCallDismissed(callId: string): boolean {
  const map = read();
  const entry = map[callId];
  if (!entry) return false;
  if (Date.now() - entry.at > MAX_AGE_MS) {
    delete map[callId];
    write(map);
    return false;
  }
  return true;
}

export function dismissGroupCall(callId: string) {
  const map = read();
  const now = Date.now();
  map[callId] = { at: now };
  for (const [id, e] of Object.entries(map)) {
    if (now - e.at > MAX_AGE_MS) delete map[id];
  }
  write(map);
}
