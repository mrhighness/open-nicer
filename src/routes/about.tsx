import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, Code2, Globe, Crown, Mail, Github, Sparkle, Lock, Zap } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { StatusBar } from "@/components/StatusBar";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Nicer Chat" },
      { name: "description", content: "About Nicer Chat and the developer behind it, Highness Chinedu — Founder & CEO of All Things Web Technology Inc." },
      { property: "og:title", content: "About — Nicer Chat" },
      { property: "og:description", content: "Meet Highness Chinedu, the developer behind Nicer Chat — a free, open-source, no-signup messaging app." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MobileFrame>
      <StatusBar />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
        <Link to="/profile" className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">About</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-12">
        {/* Hero */}
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="mx-auto size-20 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Sparkle className="size-10 text-primary-foreground" fill="currentColor" />
          </div>
          <h2 className="text-3xl font-bold font-display">
            Nicer <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">Chat</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto leading-relaxed">
            A beautiful, free, open-source messaging experience. No accounts. No friction. Just chat.
          </p>
        </div>

        {/* Feature pills */}
        <div className="px-5 grid grid-cols-3 gap-2 mb-8">
          <FeaturePill icon={Lock} label="Private" />
          <FeaturePill icon={Zap} label="Real-time" />
          <FeaturePill icon={Heart} label="Free forever" />
        </div>

        {/* Developer card */}
        <div className="px-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">The developer</div>
          <div className="bg-card/60 border border-border/60 rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
                <Crown className="size-8 text-primary-foreground" fill="currentColor" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-lg leading-tight">Highness Chinedu</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Full-Stack Software Engineer</p>
              </div>
            </div>

            <p className="text-sm text-foreground/85 leading-relaxed mt-4">
              Highness Chinedu is the <span className="text-foreground font-semibold">Founder &amp; CEO of All Things Web Technology Inc.</span> — a company on a mission to build beautiful, accessible, and modern web experiences for everyone.
            </p>

            <p className="text-sm text-foreground/85 leading-relaxed mt-3">
              Nicer Chat was crafted from the ground up to prove that elegant, real-time messaging doesn't need accounts, sign-ups, or compromises on design.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="bg-background/40 border border-border/40 rounded-2xl p-3">
                <Code2 className="size-4 text-primary mb-1" />
                <div className="text-xs font-semibold">Full-Stack</div>
                <div className="text-[10px] text-muted-foreground">Engineer</div>
              </div>
              <div className="bg-background/40 border border-border/40 rounded-2xl p-3">
                <Globe className="size-4 text-primary mb-1" />
                <div className="text-xs font-semibold">All Things Web</div>
                <div className="text-[10px] text-muted-foreground">Technology Inc.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Open source card */}
        <div className="px-5 mt-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Open source</div>
          <div className="bg-card/60 border border-border/60 rounded-3xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center">
                <Github className="size-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Free for everyone</div>
                <div className="text-[11px] text-muted-foreground">MIT License · Copy, fork, ship</div>
              </div>
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed">
              Nicer Chat is fully open source. Anyone is welcome to copy, fork, modify, or use this project — for personal, educational, or commercial purposes.
            </p>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-5 mt-8 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            Made with <Heart className="size-3 text-primary" fill="currentColor" /> by Highness Chinedu
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            © {new Date().getFullYear()} All Things Web Technology Inc.
          </p>
        </div>
      </div>
    </MobileFrame>
  );
}

function FeaturePill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="bg-card/60 border border-border/60 rounded-2xl py-3 flex flex-col items-center gap-1">
      <Icon className="size-4 text-primary" />
      <div className="text-[11px] font-semibold">{label}</div>
    </div>
  );
}
