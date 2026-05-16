import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { isSpeakingLevel } from "@/hooks/use-audio-level";

const BAR_WEIGHTS = [0.55, 0.8, 1, 0.75, 0.5];

type Props = {
  level: number;
  /** When false (muted), bars stay idle. */
  active?: boolean;
  className?: string;
};

/** Compact voice activity bars — animates when the user is speaking. */
export function SpeakingWaveform({ level, active = true, className }: Props) {
  const speaking = active && isSpeakingLevel(level);

  return (
    <div
      className={cn("flex items-end justify-center gap-[3px] h-4", className)}
      aria-hidden
    >
      {BAR_WEIGHTS.map((weight, i) => {
        const idle = 3;
        const peak = 3 + level * 16 * weight;
        const height = speaking ? peak : idle;
        return (
          <motion.span
            key={i}
            className={cn(
              "w-[3px] rounded-full transition-colors",
              speaking ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" : "bg-muted-foreground/35"
            )}
            animate={{ height }}
            transition={{ duration: 0.07, ease: "easeOut" }}
            style={{ minHeight: 3 }}
          />
        );
      })}
    </div>
  );
}
