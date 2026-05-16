import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
  className?: string;
}

export function Avatar({ src, name, size = 48, online, ring, className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn("relative shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          "rounded-full overflow-hidden bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold",
          ring && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-online ring-2 ring-background"
          style={{ width: size * 0.27, height: size * 0.27 }}
        />
      )}
    </div>
  );
}
