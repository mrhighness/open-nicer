/**
 * ResponsiveLayout — full-screen on mobile; centered card on desktop.
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
    <div className="min-h-dvh min-h-screen w-full max-w-[100vw] box-border overflow-x-hidden bg-background lg:flex lg:items-center lg:justify-center lg:p-6 lg:px-[max(1.5rem,env(safe-area-inset-left,0px))] lg:pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] lg:pt-[max(1.5rem,env(safe-area-inset-top,0px))]">
      <div
        className={`flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-background lg:h-[min(90dvh,56rem)] lg:max-h-[min(90dvh,56rem)] lg:max-w-6xl lg:rounded-[24px] lg:border lg:border-border/40 lg:shadow-[0_30px_80px_-20px_rgba(132,30,180,0.4)] relative ${className}`}
        style={{ backgroundImage: "var(--gradient-app)" }}
        onContextMenu={blockNativeContextMenu}
      >
        {children}
      </div>
    </div>
  );
}
