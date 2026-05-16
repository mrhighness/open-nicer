import { motion } from "framer-motion";
import { AppLogo } from "@/components/AppLogo";
import { BrandTitle } from "@/components/BrandTitle";
import { PRODUCT } from "@/lib/product";

interface SplashPreloaderProps {
  exiting?: boolean;
}

export function SplashPreloader({ exiting = false }: SplashPreloaderProps) {
  return (
    <motion.div
      className="splash-screen fixed inset-0 z-[9999] flex flex-col items-center justify-between overflow-hidden px-6 py-10 safe-area-pad"
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      aria-live="polite"
      aria-busy={!exiting}
      aria-label="Loading Open Nicer"
    >
      <div className="splash-orb splash-orb-a" aria-hidden />
      <div className="splash-orb splash-orb-b" aria-hidden />
      <div className="splash-orb splash-orb-c" aria-hidden />

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <motion.div
          initial={{ scale: 0.82, opacity: 0, y: 12 }}
          animate={{ scale: exiting ? 0.96 : 1, opacity: exiting ? 0 : 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
          className="relative"
        >
          <div className="splash-logo-ring" aria-hidden />
          <AppLogo size="xl" className="relative z-10 shadow-2xl" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: exiting ? 0 : 1, y: exiting ? -6 : 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-6 text-center"
        >
          <BrandTitle as="h1" size="lg" />
          <p className="text-sm text-muted-foreground mt-1.5">{PRODUCT.tagline}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          transition={{ delay: 0.45 }}
          className="mt-8 flex items-center gap-2"
          aria-hidden
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="splash-dot size-2 rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: exiting ? 0 : 1, y: exiting ? 10 : 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
        className="w-full max-w-xs flex flex-col items-center gap-2 pb-2"
        role="contentinfo"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">Presented by</p>
        <img
          src={PRODUCT.nicleLogoUrl}
          alt="Nicle Inc."
          className="h-10 w-auto max-w-[200px] object-contain opacity-95"
          width={200}
          height={40}
          decoding="async"
        />
      </motion.div>
    </motion.div>
  );
}
