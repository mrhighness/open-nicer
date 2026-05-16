/**
 * MobileFrame — wraps the app content in a phone-shaped frame on desktop,
 * full-screen on mobile.
 * 
 * DEPRECATED: Use ResponsiveLayout instead for proper responsive design.
 * This component is kept for backwards compatibility.
 */
import type { ReactNode } from "react";
import { ResponsiveLayout } from "./ResponsiveLayout";

export function MobileFrame({ children }: { children: ReactNode }) {
  return <ResponsiveLayout>{children}</ResponsiveLayout>;
}
