const ONBOARDING_KEY = "nicer.onboarding.done";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

const JUST_FINISHED_KEY = "nicer.onboarding.justFinished";

export function completeOnboarding() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, "1");
  window.sessionStorage.setItem(JUST_FINISHED_KEY, "1");
}

/** True briefly after onboarding — used to suppress call UI flash on first entry. */
export function isJustFinishedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(JUST_FINISHED_KEY) === "1";
}

export function clearJustFinishedOnboarding() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(JUST_FINISHED_KEY);
}
