import { cn } from "@/lib/utils";

export function NotificationBadge({
  count,
  className,
  pulse,
}: {
  count: number;
  className?: string;
  pulse?: boolean;
}) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "absolute flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full",
        "bg-red-500 text-white text-[10px] font-bold leading-none",
        "shadow-sm ring-2 ring-background",
        pulse && "animate-pulse",
        className
      )}
      aria-label={`${count} unread`}
    >
      {label}
    </span>
  );
}
