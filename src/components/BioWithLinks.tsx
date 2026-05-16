import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Detect http(s) and www. URLs; trailing punctuation is kept as plain text. */
const URL_RE = /https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi;

function stripTrailingPunctuation(raw: string): { core: string; trailing: string } {
  let core = raw;
  let trailing = "";
  const punct = /[.,;:!?\)\]]+$/;
  for (;;) {
    const m = core.match(punct);
    if (!m) break;
    trailing = m[0] + trailing;
    core = core.slice(0, -m[0].length);
    if (!core) break;
  }
  return { core, trailing };
}

function safeExternalHref(core: string): string | null {
  const s = core.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : /^www\./i.test(s) ? `https://${s}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

type Props = {
  text: string;
  className?: string;
  linkClassName?: string;
};

/**
 * Renders bio text with http(s) and www. links as safe external anchors (no HTML injection).
 */
export function BioWithLinks({ text, className, linkClassName }: Props) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const src = text;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(src)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={`t-${key++}`} className="[overflow-wrap:anywhere]">
          {src.slice(last, match.index)}
        </span>
      );
    }
    const raw = match[0];
    const { core, trailing } = stripTrailingPunctuation(raw);
    const href = safeExternalHref(core);
    if (href) {
      parts.push(
        <a
          key={`a-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("underline underline-offset-2 [overflow-wrap:anywhere]", linkClassName)}
        >
          {core}
        </a>
      );
      if (trailing) {
        parts.push(
          <span key={`s-${key++}`} className="[overflow-wrap:anywhere]">
            {trailing}
          </span>
        );
      }
    } else {
      parts.push(
        <span key={`r-${key++}`} className="[overflow-wrap:anywhere]">
          {raw}
        </span>
      );
    }
    last = match.index + raw.length;
  }
  if (last < src.length) {
    parts.push(
      <span key={`t-${key++}`} className="[overflow-wrap:anywhere]">
        {src.slice(last)}
      </span>
    );
  }
  return <div className={cn("whitespace-pre-wrap break-words", className)}>{parts}</div>;
}
