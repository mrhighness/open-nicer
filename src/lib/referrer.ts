const REFERRER_KEY = "nicer_referrer_id";

export function setProfileReferrer(profileId: string) {
  if (typeof window === "undefined" || !profileId) return;
  try {
    window.localStorage.setItem(REFERRER_KEY, profileId);
  } catch {
    /* ignore */
  }
}

export function consumeReferrerProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(REFERRER_KEY);
    if (!v) return null;
    window.localStorage.removeItem(REFERRER_KEY);
    return v;
  } catch {
    return null;
  }
}
