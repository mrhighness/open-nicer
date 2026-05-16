import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { DesktopNav } from "@/components/DesktopNav";
import { BottomNav } from "@/components/BottomNav";
import { RecoverAccountPanel } from "@/components/RecoverAccountPanel";
import { PRODUCT } from "@/lib/product";
import { EM_DASH, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/recover-account")({
  head: () =>
    pageHead({
      title: `Sign in to saved account ${EM_DASH} ${PRODUCT.name}`,
      description: `Sign back in to ${PRODUCT.name} with your 5-digit Account ID and 4-digit Nicer PIN.`,
      path: "/recover-account",
      index: false,
    }),
  component: RecoverAccountPage,
});

function RecoverAccountPage() {
  return (
    <ResponsiveLayout>
      <StatusBar />
      <DesktopNav active="profile" />

      <div className="flex items-center gap-3 px-4 py-3">
        <Link to="/" className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold font-display">Saved account</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 lg:pb-8">
        <div className="max-w-md mx-auto space-y-5 pt-3">
          <div className="flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
              <KeyRound className="size-8 text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold font-display px-1">Sign in with ID & PIN</h2>
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed max-w-sm mx-auto px-1">
              Enter the 5-digit Account ID and 4-digit Nicer PIN you saved before. This page will reload into that
              account.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 space-y-3">
            <RecoverAccountPanel />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/" className="text-primary font-semibold hover:underline">
              Start fresh on the home screen
            </Link>
          </p>
        </div>
      </div>

      <BottomNav active="profile" />
    </ResponsiveLayout>
  );
}
