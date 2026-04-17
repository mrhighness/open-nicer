import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Reply, Smile, Copy, Trash2, X, Check, CheckCheck } from "lucide-react";
import type { Message, Reaction } from "@/lib/types";
import { formatMessageTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AttachmentView } from "./AttachmentView";

const REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

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
}: MessageBubbleProps) {
  const x = useMotionValue(0);
  const replyOpacity = useTransform(x, isMine ? [-80, 0] : [0, 80], [1, 0]);
  const replyScale = useTransform(x, isMine ? [-80, -20, 0] : [0, 20, 80], [1, 0.5, 0.3]);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const startedAt = useRef(0);

  const handlePointerDown = () => {
    startedAt.current = Date.now();
    longPressTimer.current = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(15);
      setMenuOpen(true);
    }, 380);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    const triggered = isMine ? info.offset.x < -60 : info.offset.x > 60;
    if (triggered) {
      if (navigator.vibrate) navigator.vibrate(10);
      onReply(message);
    }
    animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
  };

  // Group reactions by emoji
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className={cn("flex w-full px-3 mb-1 animate-message-in", isMine ? "justify-end" : "justify-start")}>
        {/* Reply hint that appears when swiping */}
        <motion.div
          style={{ opacity: replyOpacity, scale: replyScale }}
          className={cn(
            "absolute size-9 rounded-full bg-primary/30 flex items-center justify-center pointer-events-none",
            isMine ? "right-3" : "left-3"
          )}
        >
          <Reply className="size-4 text-primary" />
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: isMine ? -100 : 0, right: isMine ? 0 : 100 }}
          dragElastic={0.4}
          dragMomentum={false}
          style={{ x }}
          onDragEnd={handleDragEnd}
          onPointerDown={handlePointerDown}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          className={cn(
            "max-w-[78%] rounded-2xl px-3 py-2 relative select-none touch-pan-y",
            isMine
              ? "bg-gradient-bubble-me text-bubble-me-foreground shadow-bubble"
              : "bg-bubble-them text-bubble-them-foreground",
            showTail && (isMine ? "rounded-br-md" : "rounded-bl-md")
          )}
        >
          {replyTo && (
            <div className={cn(
              "mb-1.5 px-2 py-1.5 rounded-lg border-l-2 text-xs",
              isMine ? "bg-black/20 border-white/60" : "bg-primary/10 border-primary"
            )}>
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
              {message.content && (
                <div className="text-[15px] leading-snug whitespace-pre-wrap break-words">
                  {message.content}
                  <span className="inline-block w-12" />
                </div>
              )}
            </>
          )}

          <div className={cn(
            "absolute bottom-1 right-2 flex items-center gap-1 text-[10px] opacity-80",
            isMine ? "text-bubble-me-foreground" : "text-muted-foreground"
          )}>
            <span>{formatMessageTime(message.created_at)}</span>
            {isMine && !message.is_deleted && (
              <CheckCheck className="size-3" strokeWidth={2.5} />
            )}
          </div>

          {/* Reactions chip */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={cn(
              "absolute -bottom-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-popover border border-border shadow-lg animate-reaction-pop",
              isMine ? "right-2" : "left-2"
            )}>
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <span key={emoji} className="text-xs">
                  {emoji}{count > 1 && <span className="text-[10px] ml-0.5 text-muted-foreground">{count}</span>}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Long-press action menu */}
      <AnimatePresence>
        {menuOpen && (
          <ReactionSheet
            message={message}
            isMine={isMine}
            onClose={() => setMenuOpen(false)}
            onReact={(emoji) => { onReact(message, emoji); setMenuOpen(false); }}
            onReply={() => { onReply(message); setMenuOpen(false); }}
            onCopy={() => {
              navigator.clipboard.writeText(message.content);
              toast.success("Copied");
              setMenuOpen(false);
            }}
            onDelete={() => { onDelete(message); setMenuOpen(false); }}
          />
        )}
      </AnimatePresence>
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
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reactions row */}
        <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-3xl p-2 flex items-center justify-around shadow-2xl">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="size-12 rounded-full hover:bg-muted flex items-center justify-center text-2xl active:scale-90 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Action menu */}
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
  icon: Icon, label, onClick, destructive, disabled,
}: { icon: typeof Reply; label: string; onClick: () => void; destructive?: boolean; disabled?: boolean }) {
  return (
    <button
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
