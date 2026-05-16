import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { recoverAccountByRetention, retentionErrorMessage } from "@/lib/retention";
import { toast } from "sonner";

type Props = {
  className?: string;
  /** Tighter layout for embedded contexts (e.g. onboarding welcome). */
  compact?: boolean;
};

/**
 * Two-step recovery: 5-digit Account ID, then 4-digit Nicer PIN. Reloads app on success.
 */
export function RecoverAccountPanel({ className, compact }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accountId, setAccountId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submitStep1 = () => {
    const id = accountId.trim();
    if (!/^\d{5}$/.test(id)) {
      toast.error("Enter your 5-digit Account ID.");
      return;
    }
    setStep(2);
  };

  const submitRecover = async () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Nicer PIN must be exactly 4 digits.");
      return;
    }
    setBusy(true);
    try {
      await recoverAccountByRetention(parseInt(accountId.trim(), 10), pin);
    } catch (e) {
      toast.error(retentionErrorMessage(e));
      setBusy(false);
    }
  };

  const gap = compact ? "space-y-2" : "space-y-4";
  const inpH = compact ? "h-9 text-sm" : "h-12 text-lg sm:text-xl";
  const btnH = compact ? "h-9 text-xs" : "h-12 text-base";
  const descCls = compact ? "text-[10px] leading-snug" : "text-sm leading-relaxed";

  return (
    <div className={className}>
      {step === 1 ? (
        <div className={cn(gap, "text-left")}>
          <p className={cn("text-muted-foreground", descCls)}>
            {compact
              ? "Enter your saved 5-digit Account ID, then your Nicer PIN."
              : "Enter the 5-digit Account ID you saved from your profile or welcome screen, then your Nicer PIN."}
          </p>
          <input
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            placeholder="Account ID"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className={cn(
              "w-full rounded-2xl bg-background/80 border border-border px-3 text-center font-mono font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40",
              inpH
            )}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitStep1()}
            className={cn(
              "w-full rounded-2xl bg-card border border-primary/30 font-semibold hover:bg-card/80 transition-colors",
              btnH
            )}
          >
            Continue to PIN
          </button>
        </div>
      ) : (
        <div className={cn(gap, "text-left")}>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setStep(1);
              setPin("");
            }}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            <ArrowLeft className="size-3" />
            Back
          </button>
          <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-sm")}>
            Account ID <span className="font-mono font-semibold text-foreground">{accountId}</span>
          </p>
          <input
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="4-digit Nicer PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={cn(
              "w-full rounded-2xl bg-background/80 border border-border px-3 text-center font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40",
              compact ? "h-9 text-sm tracking-[0.25em]" : "h-12 text-lg tracking-[0.35em]"
            )}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitRecover()}
            className={cn(
              "w-full rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-fab flex items-center justify-center gap-2 disabled:opacity-60",
              btnH
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Signing in…" : "Sign in to my account"}
          </button>
        </div>
      )}
    </div>
  );
}
