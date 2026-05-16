import { Ban, BellOff, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockPeer, isPeerBlocked, isPeerMuted, mutePeer, unmutePeer } from "@/lib/chat-settings";
import { toast } from "sonner";

type Props = {
  meId: string;
  peerId: string;
  peerName: string;
  onBlocked?: () => void;
  trigger: React.ReactNode;
};

export function ChatPeerMenu({ meId, peerId, peerName, onBlocked, trigger }: Props) {
  const blocked = isPeerBlocked(peerId);
  const muted = isPeerMuted(peerId);

  const toggleMute = async () => {
    try {
      if (muted) {
        await unmutePeer(meId, peerId);
        toast.success(`Unmuted ${peerName}`);
      } else {
        await mutePeer(meId, peerId);
        toast.success(`Muted ${peerName} — no notifications from this chat`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update mute");
    }
  };

  const toggleBlock = async () => {
    if (blocked) return;
    try {
      await blockPeer(meId, peerId);
      toast.success(`${peerName} blocked — chat removed`);
      onBlocked?.();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't block user");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => void toggleMute()} className="gap-2">
          {muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          {muted ? "Unmute notifications" : "Mute notifications"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void toggleBlock()}
          disabled={blocked}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Ban className="size-4" />
          {blocked ? "Already blocked" : "Block user"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
