import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { getSocialShareOptions, copyProfileInvite, canUseNativeShare, shareProfileInvite } from "@/lib/share-invite";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
};

export function InviteSocialSheet({ open, onClose, userId, username }: Props) {
  const [copied, setCopied] = useState(false);
  const options = getSocialShareOptions(userId, username);

  const onNativeShare = async () => {
    const result = await shareProfileInvite({ userId, username });
    if (result === "shared") onClose();
  };

  const onCopy = async () => {
    try {
      await copyProfileInvite(userId, username);
      setCopied(true);
      toast.success("Invite copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 flex items-end lg:items-center lg:justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="w-full lg:max-w-md bg-popover/95 backdrop-blur-xl border-t lg:border border-border rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40 mx-auto mb-4 lg:hidden" />
            <h2 className="text-lg font-bold font-display text-center">Share invite</h2>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-5">
              Pick an app to invite friends to Open Nicer
            </p>

            {canUseNativeShare() && (
              <button
                type="button"
                onClick={() => void onNativeShare()}
                className="w-full mb-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                <Share2 className="size-5" />
                More apps on this device
              </button>
            )}

            <div className="grid grid-cols-3 gap-3">
              {options.map((opt) => (
                <a
                  key={opt.id}
                  href={opt.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-muted/40 active:scale-95 transition-all"
                >
                  <div
                    className={`size-14 rounded-2xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-white text-lg font-bold shadow-lg`}
                  >
                    {opt.label[0]}
                  </div>
                  <span className="text-[11px] font-medium text-center leading-tight">{opt.label}</span>
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void onCopy()}
              className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted/40"
            >
              {copied ? <Check className="size-4 text-online" /> : <Copy className="size-4" />}
              {copied ? "Copied!" : "Copy link"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Native share sheet on phone; social app grid on desktop. */
export async function requestInviteShare(
  userId: string,
  username: string
): Promise<"done" | "show-picker"> {
  const result = await shareProfileInvite({ userId, username });
  if (result === "shared" || result === "cancelled") return "done";
  return "show-picker";
}
