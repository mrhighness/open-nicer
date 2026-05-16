import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { formatStatusTime } from "@/lib/format";
import type { StatusGroup } from "@/lib/status";
import { markStatusViewed } from "@/lib/status";
import { cn } from "@/lib/utils";

const SLIDE_MS = 5000;

type Props = {
  groups: StatusGroup[];
  groupIndex: number;
  itemIndex: number;
  viewerId: string;
  onClose: () => void;
  onChange: (groupIndex: number, itemIndex: number) => void;
};

export function StatusViewer({ groups, groupIndex, itemIndex, viewerId, onClose, onChange }: Props) {
  const group = groups[groupIndex];
  const item = group?.items[itemIndex];
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const markedRef = useRef<Set<string>>(new Set());

  const goNext = useCallback(() => {
    if (!group) return;
    if (itemIndex < group.items.length - 1) {
      onChange(groupIndex, itemIndex + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      onChange(groupIndex + 1, 0);
      return;
    }
    onClose();
  }, [group, groupIndex, groups.length, itemIndex, onChange, onClose]);

  const goPrev = useCallback(() => {
    if (itemIndex > 0) {
      onChange(groupIndex, itemIndex - 1);
      return;
    }
    if (groupIndex > 0) {
      const prev = groups[groupIndex - 1];
      onChange(groupIndex - 1, prev.items.length - 1);
    }
  }, [groupIndex, groups, itemIndex, onChange]);

  useEffect(() => {
    if (!item) return;
    if (!markedRef.current.has(item.id)) {
      markedRef.current.add(item.id);
      void markStatusViewed([item.id], viewerId).catch(console.error);
    }
  }, [item, viewerId]);

  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const started = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - started;
      const p = Math.min(1, elapsed / SLIDE_MS);
      setProgress(p);
      if (p >= 1) goNext();
    }, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [groupIndex, itemIndex, goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!group || !item) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
      >
        <img src={item.image_url} alt="" className="w-full h-full object-contain bg-black" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
      >
        <div className="flex gap-1 mb-3">
          {group.items.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div
                className={cn(
                  "h-full bg-white rounded-full transition-none",
                  i < itemIndex && "w-full",
                  i > itemIndex && "w-0"
                )}
                style={
                  i === itemIndex
                    ? { width: `${progress * 100}%` }
                    : i < itemIndex
                      ? { width: "100%" }
                      : { width: "0%" }
                }
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Avatar src={group.user.avatar_url} name={group.user.username} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{group.user.username}</p>
            <p className="text-white/70 text-xs">{formatStatusTime(item.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-10 rounded-full bg-black/40 flex items-center justify-center text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      </motion.div>

      <div className="flex-1 relative z-10 flex">
        <button type="button" className="w-1/3 h-full" aria-label="Previous" onClick={goPrev} />
        <button type="button" className="w-2/3 h-full" aria-label="Next" onClick={goNext} />
      </div>
    </div>
  );
}

export function StatusViewerRoot(props: Props | null) {
  return (
    <AnimatePresence>
      {props ? (
        <StatusViewer key={`${props.groupIndex}-${props.itemIndex}`} {...props} />
      ) : null}
    </AnimatePresence>
  );
}
