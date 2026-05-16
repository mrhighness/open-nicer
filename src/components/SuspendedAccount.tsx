import { ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredMeLocal } from "@/lib/identity";
import { PRODUCT } from "@/lib/product";

export function SuspendedAccount() {
  const signOutAndReload = async () => {
    clearStoredMeLocal();
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-b from-slate-950 via-violet-950/40 to-slate-950 text-center">
      <div className="max-w-md rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-10 shadow-2xl">
        <div className="mx-auto size-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
          <ShieldOff className="size-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold font-display text-white">Account suspended</h1>
        <p className="mt-3 text-sm text-white/70 leading-relaxed">
          This {PRODUCT.name} profile has been suspended. If you think this is a mistake, contact support.
        </p>
        <button
          type="button"
          onClick={() => void signOutAndReload()}
          className="mt-8 w-full rounded-2xl bg-white py-3.5 text-sm font-semibold text-slate-900 hover:bg-white/90 transition-colors"
        >
          Sign out and return home
        </button>
      </div>
    </div>
  );
}
