import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Check, KeyRound, Shield } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { DesktopNav } from "@/components/DesktopNav";
import { BottomNav } from "@/components/BottomNav";
import { RecoverAccountPanel } from "@/components/RecoverAccountPanel";
import { useMe } from "@/lib/use-me";
import { activateRetentionPin, retentionErrorMessage } from "@/lib/retention";
import { PRODUCT } from "@/lib/product";
import { EM_DASH, pageHead } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/retain-account")({
  head: () =>
    pageHead({
      title: `Account retention ${EM_DASH} ${PRODUCT.name}`,
      description: `Save your ${PRODUCT.name} Account ID and Nicer PIN to sign back in on a new browser.`,
      path: "/retain-account",
      index: false,
    }),
  component: RetainAccountPage,
});

function formatAccountId(n: number | null | undefined): string | null {
  if (n == null || Number.isNaN(n)) return null;
  return String(n).padStart(5, "0");
}

function RetainAccountPage() {
  const { me } = useMe();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!me) {
    return (
      <ResponsiveLayout>
        <StatusBar />
        <DesktopNav active="profile" />
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </ResponsiveLayout>
    );
  }

  const accountId = formatAccountId(me.retention_public_id);
  const pinSet = Boolean(me.retention_enabled_at);

  const copyId = async () => {
    if (!accountId) return;
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      toast.success("Account ID copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(pin2)) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== pin2) {
      toast.error("PINs do not match.");
      return;
    }
    if (pinSet) {
      if (!/^\d{4}$/.test(oldPin)) {
        toast.error("Enter your current 4-digit PIN to change it.");
        return;
      }
    }
    setSaving(true);
    try {
      await activateRetentionPin({
        pin,
        oldPin: pinSet ? oldPin : null,
        profileId: me.id,
        claimToken: me.claim_token,
      });
      toast.success(pinSet ? "PIN updated" : "Nicer PIN saved — you can recover this account on any device");
      setPin("");
      setPin2("");
      setOldPin("");
      window.location.reload();
    } catch (e) {
      toast.error(retentionErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveLayout>
      <StatusBar />
      <DesktopNav active="profile" />

      <div className="flex min-w-0 items-center gap-3 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] py-3">
        <Link to="/profile" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted/60">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 truncate text-lg font-bold">Retain account</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pb-24 lg:pb-8">
        <div className="max-w-md mx-auto space-y-6 pt-2">
          {!accountId ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Account retention is not available until the latest database migration is applied. Ask your host to run
              Supabase migrations.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Shield className="size-3.5 text-primary" />
                  Your Account ID
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Save this 5-digit ID somewhere safe. With your Nicer PIN, you can sign back in after clearing your browser
                  or switching devices.
                </p>
                <button
                  type="button"
                  onClick={() => void copyId()}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3 font-mono text-2xl font-bold tracking-widest"
                >
                  {accountId}
                  {copied ? <Check className="size-5 text-online shrink-0" /> : <Copy className="size-5 text-muted-foreground shrink-0" />}
                </button>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="size-3.5 text-primary" />
                  Nicer PIN
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pinSet
                    ? "Enter your current PIN, then choose a new 4-digit PIN."
                    : "Choose a 4-digit PIN. You'll need it together with your Account ID to recover this account."}
                </p>
                {pinSet ? (
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Current PIN"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="w-full h-11 rounded-xl border border-border bg-background/50 px-3 text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : null}
                <input
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={pinSet ? "New PIN" : "4-digit PIN"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full h-11 rounded-xl border border-border bg-background/50 px-3 text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Confirm PIN"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full h-11 rounded-xl border border-border bg-background/50 px-3 text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void savePin()}
                  className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? "Saving…" : pinSet ? "Update PIN" : "Save Nicer PIN"}
                </button>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-primary/25 bg-card/40 p-4 space-y-3">
            <h2 className="text-sm font-bold">Sign in to a saved account</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you already have an Account ID and Nicer PIN from another device, sign in here. This page will reload
              into that account.
            </p>
            <RecoverAccountPanel />
          </div>
        </div>
      </div>

      <BottomNav active="profile" />
    </ResponsiveLayout>
  );
}
