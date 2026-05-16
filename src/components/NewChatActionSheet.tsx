import { motion, AnimatePresence } from "framer-motion";
import { Share2, MessageCirclePlus, Copy, Check } from "lucide-react";
import { useState } from "react";
import { InviteSocialSheet, requestInviteShare } from "@/components/InviteSocialSheet";
import { copyProfileInvite } from "@/lib/share-invite";
import { toast } from "sonner";

type Me = { id: string; username: string };

export function NewChatActionSheet({
  open,
  onClose,
  me,
  onNewChat,
}: {
  open: boolean;
  onClose: () => void;
  me: Me;
  onNewChat: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  const onInviteFriends = async () => {
    const next = await requestInviteShare(me.id, me.username);
    if (next === "done") {
      onClose();
      return;
    }
    setSocialOpen(true);
  };

  const copyInvite = async () => {
    try {
      await copyProfileInvite(me.id, me.username);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-end lg:items-center lg:justify-center"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="w-full lg:max-w-md bg-popover/95 backdrop-blur-xl border-t lg:border border-border rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40 mx-auto mb-4 lg:hidden" />
              <h2 className="text-lg font-bold font-display text-center mb-1">Get started</h2>
              <p className="text-sm text-muted-foreground text-center mb-5">
                Invite friends or find someone already on Open Nicer
              </p>

              <div className="space-y-2">
                <div className="w-full flex items-center gap-2 p-2 rounded-2xl bg-card/80 border border-border/60">
                  <button
                    type="button"
                    onClick={() => void onInviteFriends()}
                    className="flex flex-1 items-center gap-4 p-2 rounded-xl hover:bg-muted/30 active:scale-[0.99] transition-all text-left min-w-0"
                  >
                    <div className="size-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                      <Share2 className="size-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Invite friends</div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Share via WhatsApp, Instagram, Messages, and more
                      </p>
                    </div>
                  </button>
                  {copied ? (
                    <Check className="size-5 text-online shrink-0 mr-2" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => void copyInvite()}
                      className="size-9 rounded-xl border border-border/60 flex items-center justify-center shrink-0 hover:bg-muted/50 mr-1"
                      aria-label="Copy invite link"
                    >
                      <Copy className="size-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNewChat();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card/80 border border-border/60 hover:bg-card active:scale-[0.99] transition-all text-left"
                >
                  <div className="size-12 rounded-2xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                    <MessageCirclePlus className="size-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">New chat</div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Search for someone already using Open Nicer
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InviteSocialSheet
        open={socialOpen}
        onClose={() => {
          setSocialOpen(false);
          onClose();
        }}
        userId={me.id}
        username={me.username}
      />
    </>
  );
}
