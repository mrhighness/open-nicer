import { cn } from "@/lib/utils";
import { PRODUCT } from "@/lib/product";

const SIZES = {
  xs: "size-8 rounded-xl",
  sm: "size-10 rounded-2xl",
  md: "size-16 rounded-2xl",
  lg: "size-20 rounded-3xl",
  xl: "size-28 rounded-3xl",
} as const;

type AppLogoSize = keyof typeof SIZES;

interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
  imgClassName?: string;
}

export function AppLogo({ size = "sm", className, imgClassName }: AppLogoProps) {
  return (
    <div className={cn("shrink-0 overflow-hidden shadow-glow", SIZES[size], className)}>
      <img
        src="/open-nicer.png"
        alt={`${PRODUCT.name} logo`}
        className={cn("size-full object-cover", imgClassName)}
        width={112}
        height={112}
        decoding="async"
      />
    </div>
  );
}
