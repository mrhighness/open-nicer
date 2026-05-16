import { Link } from "@tanstack/react-router";
import { MessageCircle, Phone, CircleDot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnread } from "@/contexts/unread-context";
import { NotificationBadge } from "@/components/NotificationBadge";

type NavKey = "chats" | "calls" | "status" | "profile";

const ITEMS: { key: NavKey; label: string; icon: typeof MessageCircle; to: string }[] = [
  { key: "chats", label: "Chats", icon: MessageCircle, to: "/" },
  { key: "calls", label: "Calls", icon: Phone, to: "/calls" },
  { key: "status", label: "Status", icon: CircleDot, to: "/status" },
  { key: "profile", label: "Profile", icon: User, to: "/profile" },
];

export function BottomNav({ active }: { active: NavKey }) {
  const { totalUnread } = useUnread();

  return (
    <nav
      className="lg:hidden absolute bottom-0 left-0 right-0 z-40 flex min-w-0 items-stretch justify-around border-t border-border/60 bg-card/80 px-1 pt-2 backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.25rem,env(safe-area-inset-left,0px))] pr-[max(0.25rem,env(safe-area-inset-right,0px))]"
      aria-label="Primary"
    >
      {ITEMS.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className={cn(
            "relative flex min-w-0 flex-1 max-w-[28vw] flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors sm:px-2",
            active === it.key ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span className="relative shrink-0">
            <it.icon
              className="size-5"
              strokeWidth={active === it.key ? 2.6 : 2}
              fill={active === it.key && it.key === "chats" ? "currentColor" : "none"}
            />
            {it.key === "chats" && (
              <NotificationBadge count={totalUnread} className="-top-1.5 -right-2" pulse={totalUnread > 0} />
            )}
          </span>
          <span className="w-full truncate text-center text-[9px] font-semibold sm:text-[10px]">
            {it.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
