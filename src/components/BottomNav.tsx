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
    <nav className="lg:hidden absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-card/80 border-t border-border/60 px-2 pt-2 pb-3 flex items-center justify-around">
      {ITEMS.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className={cn(
            "relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
            active === it.key ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span className="relative">
            <it.icon
              className="size-5"
              strokeWidth={active === it.key ? 2.6 : 2}
              fill={active === it.key && it.key === "chats" ? "currentColor" : "none"}
            />
            {it.key === "chats" && (
              <NotificationBadge count={totalUnread} className="-top-1.5 -right-2" pulse={totalUnread > 0} />
            )}
          </span>
          <span className="text-[10px] font-semibold">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
