import { BRAND } from "@/lib/product";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "text-lg leading-tight",
  md: "text-xl lg:text-2xl leading-tight",
  lg: "text-2xl lg:text-3xl leading-tight",
  xl: "text-3xl lg:text-4xl leading-tight",
} as const;

type BrandTitleProps = {
  size?: keyof typeof SIZES;
  className?: string;
  as?: "h1" | "h2" | "span" | "p";
};

/** App wordmark: "Open" + gradient "Nicer" — consistent sizing, no stray characters. */
export function BrandTitle({ size = "md", className, as: Tag = "span" }: BrandTitleProps) {
  return (
    <Tag className={cn("font-bold font-display tracking-tight", SIZES[size], className)}>
      {BRAND.lead}{" "}
      <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">
        {BRAND.accent}
      </span>
    </Tag>
  );
}
