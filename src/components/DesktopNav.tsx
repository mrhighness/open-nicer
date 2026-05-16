import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Phone, CircleDot, User } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { BrandTitle } from "@/components/BrandTitle";
import { NotificationBadge } from "@/components/NotificationBadge";
import { useUnread } from "@/contexts/unread-context";
import { cn } from "@/lib/utils";

interface DesktopNavProps {
  active: "chats" | "calls" | "status" | "profile";
  trailing?: ReactNode;
}

export function DesktopNav({ active, trailing }: DesktopNavProps) {
  const { totalUnread } = useUnread();
  const items = [
    { key: "chats" as const, label: "Chats", icon: MessageCircle, to: "/" },
    { key: "calls" as const, label: "Calls", icon: Phone, to: "/calls" },
    { key: "status" as const, label: "Status", icon: CircleDot, to: "/status" },
    { key: "profile" as const, label: "Profile", icon: User, to: "/profile" },
  ];

  return (
    <header className="hidden lg:flex w-full shrink-0 items-center gap-6 border-b border-border/40 px-6 xl:px-10 py-3">
      <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3 sm:min-w-[180px] lg:min-w-[200px]">
        <AppLogo size="sm" />
        <BrandTitle size="md" />
      </Link>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5" aria-label="Main">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
              active === item.key
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span className="relative">
              <item.icon className="size-5" strokeWidth={active === item.key ? 2.6 : 2} />
              {item.key === "chats" && (
                <NotificationBadge count={totalUnread} className="-top-1.5 -right-2.5" pulse={totalUnread > 0} />
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:min-w-[140px] lg:min-w-[200px]">{trailing}</div>
    </header>
  );
}
