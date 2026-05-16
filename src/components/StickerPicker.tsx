import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STICKER_PACKS } from "@/lib/stickers";
import { cn } from "@/lib/utils";

export function StickerPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (sticker: string) => void;
}) {
  const [activePack, setActivePack] = useState(STICKER_PACKS[0].id);
  const pack = STICKER_PACKS.find((p) => p.id === activePack) ?? STICKER_PACKS[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 bg-black/50 flex items-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="w-full bg-popover/95 backdrop-blur-xl border-t border-border rounded-t-3xl flex flex-col max-h-[55vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40 mx-auto mt-3 mb-2 shrink-0" />

            <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-none shrink-0">
              {STICKER_PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePack(p.id)}
                  className={cn(
                    "size-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors",
                    activePack === p.id ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted/60"
                  )}
                  aria-label={p.label}
                  title={p.label}
                >
                  {p.icon}
                </button>
              ))}
            </div>

            <div className="px-3 pb-2 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{pack.label}</p>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-none px-3 pb-5">
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                {pack.stickers.map((sticker) => (
                  <button
                    key={sticker}
                    type="button"
                    onClick={() => {
                      onSelect(sticker);
                      onClose();
                    }}
                    className="aspect-square rounded-xl hover:bg-muted/60 active:scale-90 transition-transform flex items-center justify-center text-[28px] leading-none"
                    aria-label={`Send ${sticker} sticker`}
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
