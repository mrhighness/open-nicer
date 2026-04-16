/**
 * MobileFrame — wraps the app content in a phone-shaped frame on desktop,
 * full-screen on mobile.
 */
import type { ReactNode } from "react";

export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-stretch md:items-center justify-center md:p-6">
      <div
        className="
          w-full md:max-w-[420px] md:h-[860px] md:rounded-[40px] md:border md:border-border/40
          bg-background overflow-hidden relative flex flex-col
          md:shadow-[0_30px_80px_-20px_rgba(132,30,180,0.4)]
        "
        style={{ backgroundImage: "var(--gradient-app)" }}
      >
        {children}
      </div>
    </div>
  );
}
