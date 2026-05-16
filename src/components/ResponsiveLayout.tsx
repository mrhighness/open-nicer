/**
 * ResponsiveLayout ? full-screen on mobile; centered card on desktop.
 * Children render once (no duplicate mounts / double subscriptions).
 */
import type { ReactNode } from "react";

interface ResponsiveLayoutProps {
  children: ReactNode;
  className?: string;
}

const blockNativeContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
};

export function ResponsiveLayout({ children, className = "" }: ResponsiveLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-background lg:flex lg:items-center lg:justify-center lg:p-6">
      <div
        className={`min-h-screen w-full lg:min-h-0 lg:h-[90vh] lg:max-w-6xl lg:rounded-[24px] lg:border lg:border-border/40 lg:shadow-[0_30px_80px_-20px_rgba(132,30,180,0.4)] bg-background overflow-hidden relative flex flex-col ${className}`}
        style={{ backgroundImage: "var(--gradient-app)" }}
        onContextMenu={blockNativeContextMenu}
      >
        {children}
      </div>
    </div>
  );
}
