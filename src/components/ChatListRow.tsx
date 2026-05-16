import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { NotificationBadge } from "@/components/NotificationBadge";
import type { ChatWithMeta } from "@/lib/types";
import { formatChatListTime } from "@/lib/format";
import { isStickerMessage } from "@/lib/stickers";
import { shouldShowOnline } from "@/lib/privacy";
import { callLogLabel, isCallLogMessage, parseCallLogMessage } from "@/lib/call-messages";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 480;

export function ChatListRow({
  chat,
  viewerId,
  unreadCount,
  isTyping,
  selectMode,
  selected,
  onToggleSelect,
  onEnterSelect,
}: {
  chat: ChatWithMeta;
  viewerId: string;
  unreadCount: number;
  isTyping: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEnterSelect: () => void;
}) {
  const navigate = useNavigate();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const last = chat.lastMessage;
  const time = last ? formatChatListTime(last.created_at) : formatChatListTime(chat.created_at);
  const hasUnread = unreadCount > 0 && !selectMode;

  const preview = isTyping
    ? "typing…"
    : last
      ? last.is_deleted
        ? "Message deleted"
        : isCallLogMessage(last)
          ? (() => {
              const cm = parseCallLogMessage(last);
              return cm && viewerId ? callLogLabel(cm, viewerId) : last.content || "Call";
            })()
          : isStickerMessage(last)
            ? `Sticker ${last.content}`
            : last.content || (last.attachment_url ? "Attachment" : "Say hi 👋")
      : "Say hi 👋";

  const openChat = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selectMode) {
      onToggleSelect();
      return;
    }
    navigate({ to: "/chat/$chatId", params: { chatId: chat.id } });
  };

  const onPointerDown = () => {
    if (selectMode) return;
    longPressRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      onEnterSelect();
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={openChat}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openChat();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors lg:border lg:border-border/40 lg:bg-card/20",
          selectMode ? "cursor-pointer" : "hover:bg-card/40 active:bg-card/60 lg:hover:bg-card/60",
          selected && "bg-primary/15 ring-2 ring-primary/50",
          hasUnread && !selected && "bg-primary/5 lg:bg-card/30"
        )}
      >
        {selectMode && (
          <div
            className={cn(
              "size-6 rounded-full border-2 flex items-center justify-center shrink-0",
              selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50"
            )}
          >
            {selected && <Check className="size-3.5" strokeWidth={3} />}
          </div>
        )}
        <div className="relative shrink-0">
          <Avatar
            src={chat.other.avatar_url}
            name={chat.other.username}
            size={52}
            online={shouldShowOnline(chat.other) && chat.other.is_online && !isTyping}
          />
          {!selectMode && <NotificationBadge count={unreadCount} className="top-0 right-0" pulse />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn("truncate", hasUnread || isTyping ? "font-bold text-foreground" : "font-semibold")}>
              {chat.other.username}
            </h3>
            <span
              className={cn(
                "text-[11px] shrink-0",
                isTyping ? "text-primary font-semibold" : hasUnread ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {isTyping ? "now" : time}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p
              className={cn(
                "text-sm truncate flex-1",
                isTyping ? "text-primary font-medium italic" : hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {preview}
            </p>
            {hasUnread && (
              <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
