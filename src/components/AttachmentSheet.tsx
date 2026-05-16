import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Camera, Film, MapPin, FileText, User } from "lucide-react";

export function AttachmentSheet({
  open,
  onClose,
  onPick,
  onCameraClick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (files: FileList, source: "gallery" | "camera" | "video" | "document") => void;
  onCameraClick?: () => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const items = [
    { icon: Image, label: "Photos", color: "from-pink-500 to-rose-500", action: () => galleryRef.current?.click() },
    { icon: Camera, label: "Camera", color: "from-purple-500 to-indigo-500", action: () => { onClose(); onCameraClick?.(); } },
    { icon: Film, label: "Video", color: "from-violet-500 to-fuchsia-500", action: () => videoRef.current?.click() },
    { icon: FileText, label: "Document", color: "from-teal-500 to-emerald-500", action: () => docRef.current?.click() },
    { icon: MapPin, label: "Location", color: "from-sky-500 to-blue-500", action: onClose },
    { icon: User, label: "Contact", color: "from-orange-500 to-pink-500", action: onClose },
  ];

  return (
    <>
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) { onPick(e.target.files, "gallery"); onClose(); } e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files?.length) { onPick(e.target.files, "camera"); onClose(); } e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" multiple hidden onChange={(e) => { if (e.target.files?.length) { onPick(e.target.files, "video"); onClose(); } e.target.value = ""; }} />
      <input ref={docRef} type="file" hidden multiple onChange={(e) => { if (e.target.files?.length) { onPick(e.target.files, "document"); onClose(); } e.target.value = ""; }} />

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
                {items.map((it) => (
                  <button
                    key={it.label}
                    onClick={it.action}
                    className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
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
    </>
  );
}
