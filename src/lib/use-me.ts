import { useEffect, useState } from "react";
import { bootstrapApp } from "./identity";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

let cached: Profile | null = null;
const listeners = new Set<(p: Profile) => void>();

export function setCachedMe(p: Profile) {
  cached = p;
  listeners.forEach((l) => l(p));
}

export function useMe() {
  const [me, setMe] = useState<Profile | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let alive = true;
    if (!cached) {
      bootstrapApp()
        .then((p) => {
          if (!alive) return;
          cached = p as Profile;
          setMe(p as Profile);
          setLoading(false);
          listeners.forEach((l) => l(p as Profile));
        })
        .catch((e) => {
          const msg =
            e && typeof e === "object" && "message" in e
              ? String((e as { message?: string }).message)
              : String(e);
          console.error("Failed to init me:", msg || e);
          setLoading(false);
        });
    }
    const listener = (p: Profile) => alive && setMe(p);
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  return { me, loading, setMe: (p: Profile) => { cached = p; listeners.forEach((l) => l(p)); } };
}
