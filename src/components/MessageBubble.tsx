import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Reply, Smile, Copy, Trash2, X, Check, CheckCheck } from "lucide-react";
import type { Message, Reaction } from "@/lib/types";
import { formatMessageTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AttachmentView } from "./AttachmentView";
import { isStickerMessage } from "@/lib/stickers";

const REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];
const SWIPE_REPLY_THRESHOLD = 52;
const LONG_PRESS_MS = 420;

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  reactions: Reaction[];
  myId: string;
  showTail: boolean;
  replyTo: { content: string; sender_id: string; isMine: boolean } | null;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onDelete: (m: Message) => void;
  suppressEntryAnimation?: boolean;
}

export function MessageBubble({
  message,
  isMine,
  reactions,
  showTail,
  replyTo,
  onReply,
  onReact,
  onDelete,
  suppressEntryAnimation = false,
}: MessageBubbleProps) {
  const x = useMotionValue(0);
  // Hidden at rest (x = 0); only visible while swiping toward reply
  const replyOpacity = useTransform(
    x,
    isMine ? [-72, -12, 0] : [0, 12, 72],
    isMine ? [1, 0.45, 0] : [0, 0.45, 1]
  );
  const replyScale = useTransform(
    x,
    isMine ? [-72, -12, 0] : [0, 12, 72],
    isMine ? [1, 0.65, 0.25] : [0.25, 0.65, 1]
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const swiping = useRef(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openMenu = () => {
    cancelLongPress();
    if (navigator.vibrate) navigator.vibrate(12);
    setMenuOpen(true);
  };

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    swiping.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(openMenu, LONG_PRESS_MS);
    bubbleRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) cancelLongPress();

    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!horizontal) return;

    swiping.current = true;
    const maxDrag = 96;
    const clamped = isMine
      ? Math.max(-maxDrag, Math.min(0, dx))
      : Math.min(maxDrag, Math.max(0, dx));

    if ((isMine && dx < 0) || (!isMine && dx > 0)) {
      x.set(clamped);
      if (Math.abs(clamped) > 8) e.preventDefault();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    cancelLongPress();
    bubbleRef.current?.releasePointerCapture(e.pointerId);

    const dx = e.clientX - pointerStart.current.x;
    const triggered = isMine ? dx <= -SWIPE_REPLY_THRESHOLD : dx >= SWIPE_REPLY_THRESHOLD;

    if (swiping.current && triggered) {
      if (navigator.vibrate) navigator.vibrate(10);
      onReply(message);
    }

    swiping.current = false;
    animate(x, 0, { type: "spring", stiffness: 520, damping: 38 });
  };

  const handlePointerCancel = () => {
    cancelLongPress();
    swiping.current = false;
    animate(x, 0, { type: "spring", stiffness: 520, damping: 38 });
  };

  const isSticker = isStickerMessage(message);

  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div
        className={cn(
          "relative flex w-full px-3 mb-1",
          !suppressEntryAnimation && "animate-message-in",
          isMine ? "justify-end" : "justify-start"
        )}
      >
        <motion.div
          style={{ opacity: replyOpacity, scale: replyScale }}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 size-9 rounded-full bg-primary/25 flex items-center justify-center pointer-events-none z-0",
            isMine ? "right-2" : "left-2"
          )}
          aria-hidden
        >
          <Reply className="size-4 text-primary" />
        </motion.div>

        <motion.div
          ref={bubbleRef}
          style={{ x, touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={cancelLongPress}
          onContextMenu={handleContextMenu}
          className={cn(
            "message-bubble max-w-[78%] relative z-[1] select-none",
            isSticker
              ? "px-1 py-1 bg-transparent shadow-none"
              : cn(
                  "rounded-2xl px-3 py-2",
                  isMine
                    ? "bg-gradient-bubble-me text-bubble-me-foreground shadow-bubble"
                    : "bg-bubble-them text-bubble-them-foreground",
                  showTail && (isMine ? "rounded-br-md" : "rounded-bl-md")
                )
          )}
        >
          {replyTo && (
            <div
              className={cn(
                "mb-1.5 px-2 py-1.5 rounded-lg border-l-2 text-xs",
                isMine ? "bg-black/20 border-white/60" : "bg-primary/10 border-primary"
              )}
            >
              <div className="font-semibold opacity-80">{replyTo.isMine ? "You" : "Them"}</div>
              <div className="opacity-80 line-clamp-2">{replyTo.content}</div>
            </div>
          )}

          {message.is_deleted ? (
            <div className="text-sm italic opacity-70">🚫 This message was deleted</div>
          ) : (
            <>
              {message.attachment_url && (
                <AttachmentView
                  url={message.attachment_url}
                  type={message.attachment_type}
                  name={message.attachment_name}
                  size={message.attachment_size}
                  duration={message.attachment_duration}
                  isMine={isMine}
                />
              )}
              {message.content &&
                (isSticker ? (
                  <div className="text-[72px] leading-none py-1 px-1 min-w-[80px]">{message.content}</div>
                ) : (
                  <div className="text-[15px] leading-snug whitespace-pre-wrap break-words">
                    {message.content}
                    <span className="inline-block w-12" />
                  </div>
                ))}
            </>
          )}

          <div
            className={cn(
              "flex items-center gap-1 text-[10px] opacity-80",
              isSticker ? "justify-end mt-0.5 px-1" : "absolute bottom-1 right-2",
              isMine && !isSticker ? "text-bubble-me-foreground" : "text-muted-foreground"
            )}
          >
            <span>{formatMessageTime(message.created_at)}</span>
            {isMine && !message.is_deleted && <CheckCheck className="size-3" strokeWidth={2.5} />}
          </div>

          {Object.keys(groupedReactions).length > 0 && (
            <div
              className={cn(
                "absolute -bottom-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-popover border border-border shadow-lg animate-reaction-pop",
                isMine ? "right-2" : "left-2"
              )}
            >
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <span key={emoji} className="text-xs">
                  {emoji}
                  {count > 1 && <span className="text-[10px] ml-0.5 text-muted-foreground">{count}</span>}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {menuOpen && (
              <ReactionSheet
                message={message}
                isMine={isMine}
                onClose={() => setMenuOpen(false)}
                onReact={(emoji) => {
                  onReact(message, emoji);
                  setMenuOpen(false);
                }}
                onReply={() => {
                  onReply(message);
                  setMenuOpen(false);
                }}
                onCopy={() => {
                  void navigator.clipboard.writeText(message.content);
                  toast.success("Copied");
                  setMenuOpen(false);
                }}
                onDelete={() => {
                  onDelete(message);
                  setMenuOpen(false);
                }}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function ReactionSheet({
  message,
  isMine,
  onClose,
  onReact,
  onReply,
  onCopy,
  onDelete,
}: {
  message: Message;
  isMine: boolean;
  onClose: () => void;
  onReact: (e: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end touch-none"
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="w-full p-4 pb-8 space-y-3 max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-3xl p-2 flex items-center justify-around shadow-2xl">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="size-12 rounded-full hover:bg-muted flex items-center justify-center text-2xl active:scale-90 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-2xl">
          <ActionRow icon={Reply} label="Reply" onClick={onReply} />
          <ActionRow icon={Copy} label="Copy" onClick={onCopy} disabled={message.is_deleted} />
          <ActionRow icon={Smile} label="Add reaction" onClick={() => onReact("❤️")} />
          {isMine && !message.is_deleted && (
            <ActionRow icon={Trash2} label="Delete for everyone" onClick={onDelete} destructive />
          )}
          <ActionRow icon={X} label="Cancel" onClick={onClose} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  destructive,
  disabled,
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-3.5 text-left text-[15px] transition-colors",
        "hover:bg-muted/60 active:bg-muted disabled:opacity-40",
        destructive ? "text-destructive" : "text-foreground"
      )}
    >
      <Icon className="size-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}
