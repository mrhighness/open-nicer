import { Trash2, X, MoreVertical, Ban, BellOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onMute: () => void;
};

export function ChatListSelectionBar({ count, onCancel, onDelete, onBlock, onMute }: Props) {
  return (
    <div className="flex items-center gap-2 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] py-2 bg-card/80 border-b border-border/50 backdrop-blur-md">
      <button
        type="button"
        onClick={onCancel}
        className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
        aria-label="Cancel selection"
      >
        <X className="size-5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{count} selected</span>
      <button
        type="button"
        onClick={onDelete}
        disabled={count === 0}
        className="size-9 rounded-full hover:bg-destructive/20 text-destructive flex items-center justify-center disabled:opacity-40"
        aria-label="Delete chats"
      >
        <Trash2 className="size-5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={count === 0}
            className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center disabled:opacity-40"
            aria-label="More actions"
          >
            <MoreVertical className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onMute} className="gap-2">
            <BellOff className="size-4" />
            Mute
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onBlock} className="gap-2 text-destructive focus:text-destructive">
            <Ban className="size-4" />
            Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
