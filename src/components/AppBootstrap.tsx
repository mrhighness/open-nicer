import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { SplashPreloader } from "@/components/SplashPreloader";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

import { SuspendedAccount } from "@/components/SuspendedAccount";

import { bootstrapApp } from "@/lib/identity";

import { isOnboardingComplete, completeOnboarding } from "@/lib/onboarding";
import { recordSignupClientInfo } from "@/lib/signup-telemetry";

import { PRODUCT } from "@/lib/product";

import type { Profile } from "@/lib/use-me";
import { setCachedMe } from "@/lib/use-me";



const MIN_SPLASH_MS = 1500;

const EXIT_MS = 480;



type Phase = "splash" | "exit" | "ready";



export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hcBypass = pathname.startsWith("/hc");

  const [phase, setPhase] = useState<Phase>("splash");

  const [profile, setProfile] = useState<Profile | null>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);



  useEffect(() => {

    if (typeof window === "undefined") return;



    const preload = [PRODUCT.logoUrl, PRODUCT.nicleLogoUrl];

    preload.forEach((src) => {

      const img = new Image();

      img.src = src;

    });



    const started = performance.now();

    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    let readyTimer: ReturnType<typeof setTimeout> | undefined;



    const finish = () => {

      const elapsed = performance.now() - started;

      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);

      exitTimer = setTimeout(() => {

        setPhase("exit");

        readyTimer = setTimeout(() => {

          setPhase("ready");

          if (typeof window !== "undefined" && window.location.pathname.startsWith("/hc")) {
            setShowOnboarding(false);
          } else if (!isOnboardingComplete()) {
            setShowOnboarding(true);
          }

        }, EXIT_MS);

      }, wait);

    };



    bootstrapApp()

      .then((p) => setProfile(p as Profile))

      .catch(console.error)

      .finally(finish);



    return () => {

      if (exitTimer) clearTimeout(exitTimer);

      if (readyTimer) clearTimeout(readyTimer);

    };

  }, []);

  useEffect(() => {
    if (phase !== "ready" || !profile || hcBypass) return;
    if (profile.suspended_at) return;
    void recordSignupClientInfo();
  }, [phase, profile?.id, profile?.suspended_at, hcBypass]);

  const handleOnboardingFinished = (updated: Profile, opts?: { openRetainAccount?: boolean; openRecoverAccount?: boolean }) => {
    completeOnboarding();
    setCachedMe(updated);
    setProfile(updated);
    setShowOnboarding(false);
    if (opts?.openRecoverAccount) {
      queueMicrotask(() => {
        void navigate({ to: "/recover-account" });
      });
    } else if (opts?.openRetainAccount) {
      queueMicrotask(() => {
        void navigate({ to: "/retain-account" });
      });
    }
  };

  const openExistingAccountLogin = () => {
    setShowOnboarding(false);
    queueMicrotask(() => {
      void navigate({ to: "/recover-account" });
    });
  };



  const suspended = Boolean(profile?.suspended_at) && !hcBypass;
  const showOnb = Boolean(phase === "ready" && showOnboarding && profile && !hcBypass);
  const showChildren = Boolean(phase === "ready" && !suspended && (hcBypass || !showOnboarding));

  return (

    <>

      {phase !== "ready" && <SplashPreloader exiting={phase === "exit"} />}

      {phase === "ready" && suspended ? <SuspendedAccount /> : null}

      {showOnb ? (

        <OnboardingFlow
          profile={profile}
          onFinished={handleOnboardingFinished}
          onOpenExistingAccountLogin={openExistingAccountLogin}
        />

      ) : null}

      {showChildren ? children : null}

    </>

  );

}

