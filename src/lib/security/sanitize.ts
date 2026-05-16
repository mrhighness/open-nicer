const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip control characters and normalize whitespace for message text. */
export function sanitizeMessageContent(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").replace(/\r\n/g, "\n").trim();
}

export function sanitizeUsername(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").trim();
}

export function sanitizeFilename(raw: string): string {
  const base = raw.replace(CONTROL_CHARS, "").replace(/[/\\]/g, "_").trim();
  return base.slice(0, 120) || "file";
}

/** Strip control chars for profile bio (preserve newlines). */
export function sanitizeBio(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").replace(/\r\n/g, "\n").trim();
}
