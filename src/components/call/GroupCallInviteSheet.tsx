import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Share2, Users } from "lucide-react";
import { getChattedPeerIds, groupInviteUrl, addMemberToGroup } from "@/lib/groups";
import { useMe } from "@/lib/use-me";
import { getGroupById } from "@/lib/groups";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  chatId: string;
  groupTitle: string;
};

export function GroupCallInviteSheet({ open, onClose, chatId, groupTitle }: Props) {
  const { me } = useMe();
  const [mode, setMode] = useState<"pick" | "social" | null>(null);
  const [peers, setPeers] = useState<Profile[]>([]);
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const loadPeers = async () => {
    if (!me) return;
    const list = await getChattedPeerIds(me.id);
    setPeers(list);
    setMode("pick");
  };

  const loadCode = async () => {
    const g = await getGroupById(chatId);
    setInviteCode(g?.invite_code ?? null);
    setMode("social");
  };

  const shareUrl = inviteCode ? groupInviteUrl(inviteCode) : "";

  const onCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(
      `Join our group on Open Nicer: ${groupTitle}\n${shareUrl}`
    );
    setCopied(true);
    toast.success("Group link copied");
    setTimeout(() => setCopied(false), 1600);
  };

  const addPeer = async (peer: Profile) => {
    try {
      await addMemberToGroup(chatId, peer.id, groupTitle);
      toast.success(`${peer.username} added to group`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't add member");
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
            className="fixed inset-0 z-[120] bg-black/50 flex items-end lg:items-center lg:justify-center"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full lg:max-w-md bg-popover/95 backdrop-blur-xl border-t lg:border border-border rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              {!mode && (
                <>
                  <h3 className="text-lg font-semibold mb-4">Invite to call</h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => void loadPeers()}
                      className="w-full h-12 rounded-2xl bg-card/60 border border-border/50 flex items-center gap-3 px-4 text-left"
                    >
                      <Users className="size-5 text-primary" />
                      Someone you&apos;ve chatted with
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadCode()}
                      className="w-full h-12 rounded-2xl bg-card/60 border border-border/50 flex items-center gap-3 px-4 text-left"
                    >
                      <Share2 className="size-5 text-primary" />
                      Share group link (social / new users)
                    </button>
                  </div>
                </>
              )}

              {mode === "pick" && (
                <>
                  <button type="button" className="text-sm text-primary mb-3" onClick={() => setMode(null)}>
                    ← Back
                  </button>
                  <h3 className="font-semibold mb-3">Add from your chats</h3>
                  <ul className="max-h-64 overflow-y-auto space-y-1">
                    {peers.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => void addPeer(p)}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted/50 font-medium"
                        >
                          {p.username}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {mode === "social" && shareUrl && (
                <>
                  <button type="button" className="text-sm text-primary mb-3" onClick={() => setMode(null)}>
                    ← Back
                  </button>
                  <p className="text-xs text-muted-foreground font-mono truncate mb-3">{shareUrl}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onCopy()}
                      className="flex-1 h-11 rounded-xl border border-border flex items-center justify-center gap-2"
                    >
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: groupTitle,
                            text: `Join ${groupTitle} on Open Nicer`,
                            url: shareUrl,
                          });
                        } catch {
                          void onCopy();
                        }
                      }}
                      className="flex-1 h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold"
                    >
                      Share
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
