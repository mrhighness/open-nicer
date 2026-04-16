import { motion, AnimatePresence } from "framer-motion";
import { Image, Camera, Bot, Tv, MapPin, FileText, User } from "lucide-react";

const ITEMS = [
  { icon: Image, label: "Photos", color: "from-pink-500 to-rose-500" },
  { icon: Camera, label: "Camera", color: "from-purple-500 to-indigo-500" },
  { icon: Bot, label: "AI Image", color: "from-violet-500 to-fuchsia-500" },
  { icon: Tv, label: "Watch Together", color: "from-amber-500 to-red-500" },
  { icon: MapPin, label: "Location", color: "from-sky-500 to-blue-500" },
  { icon: FileText, label: "Document", color: "from-teal-500 to-emerald-500" },
  { icon: User, label: "Contact", color: "from-orange-500 to-pink-500" },
];

export function AttachmentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            className="w-full bg-popover/95 backdrop-blur-xl border-t border-border rounded-t-3xl p-5 pb-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40 mx-auto mb-5" />
            <div className="grid grid-cols-4 gap-3">
              {ITEMS.map((it) => (
                <button
                  key={it.label}
                  className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                  onClick={onClose}
                >
                  <div className={`size-14 rounded-2xl bg-gradient-to-br ${it.color} flex items-center justify-center shadow-lg`}>
                    <it.icon className="size-6 text-white" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{it.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
