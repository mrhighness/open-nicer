import { useEffect, useState } from "react";
import { CallOverlay } from "@/components/call/CallOverlay";
import { GroupCallOverlay } from "@/components/call/GroupCallOverlay";
import { GlobalCallBanner } from "@/components/GlobalCallBanner";
import { clearJustFinishedOnboarding, isJustFinishedOnboarding } from "@/lib/onboarding";

/** Call overlays — delayed briefly after onboarding so signup never flashes group-call UI. */
export function CallUiLayer() {
  const [show, setShow] = useState(!isJustFinishedOnboarding());

  useEffect(() => {
    if (!isJustFinishedOnboarding()) {
      setShow(true);
      return;
    }
    const t = window.setTimeout(() => {
      clearJustFinishedOnboarding();
      setShow(true);
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <>
      <GlobalCallBanner />
      <CallOverlay />
      <GroupCallOverlay />
    </>
  );
}
