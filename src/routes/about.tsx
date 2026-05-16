import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Heart,
  Code2,
  Globe,
  Crown,
  Github,
  Lock,
  Zap,
  MessageCircle,
  Phone,
  Shield,
  Users,
  Package,
  ExternalLink,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { OPEN_SOURCE_STATEMENT, PRODUCT, PRODUCT_SPEC } from "@/lib/product";
import { aboutPageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => aboutPageHead(),
  component: AboutPage,
});

function AboutPage() {
  return (
    <ResponsiveLayout>
      <StatusBar />

      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
        <Link to="/profile" className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">About</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-12">
        <div className="max-w-2xl mx-auto px-5 lg:px-8">
          <div className="pt-8 pb-6 text-center">
            <AppLogo size="lg" className="mx-auto mb-4" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">
              Open source · {PRODUCT.license} License
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold font-display">
              Open <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">Nicer</span>
            </h2>
            <p className="text-sm lg:text-base text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              {PRODUCT.shortDescription}
            </p>

            <div className="mt-6 pt-5 border-t border-border/40 flex flex-col items-center gap-2.5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/75">
                From All Things Web Technology Inc.
              </p>
              <a
                href={PRODUCT.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-2 hover:bg-card/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="Visit All Things Web Technology Inc."
              >
                <img
                  src={PRODUCT.atwTrademarkUrl}
                  alt="All Things Web Technology Inc."
                  className="h-9 w-auto max-w-[220px] object-contain opacity-90 hover:opacity-100 transition-opacity"
                  width={220}
                  height={36}
                  decoding="async"
                />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-8 max-w-md mx-auto">
            <FeaturePill icon={Lock} label="Private" />
            <FeaturePill icon={Zap} label="Real-time" />
            <FeaturePill icon={Heart} label="Free forever" />
          </div>

          <Section title="What is Open Nicer?">
            <div className="space-y-3">
              {PRODUCT_SPEC.whatItIs.map((p) => (
                <p key={p} className="text-sm text-foreground/85 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </Section>

          <Section title="Product specification">
            <ul className="space-y-3">
              {PRODUCT_SPEC.features.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Who is it for?">
            <ul className="space-y-2">
              {PRODUCT_SPEC.whoItIsFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground/85">
                  <Users className="size-4 text-primary shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Built with">
            <div className="flex flex-wrap gap-2">
              {PRODUCT_SPEC.techStack.map((t) => (
                <span
                  key={t}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Presented by">
            <div className="space-y-3">
              {PRODUCT.organizations.map((org) => (
                <div
                  key={org.name}
                  className="bg-background/40 border border-border/40 rounded-2xl p-4 flex items-center gap-3"
                >
                  <Package className="size-5 text-primary shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">{org.name}</div>
                    <p className="text-[11px] text-muted-foreground">{org.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Released by">
            <div className="bg-card/60 border border-border/60 rounded-3xl p-5 lg:p-6">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
                  <Crown className="size-8 text-primary-foreground" fill="currentColor" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg leading-tight">{PRODUCT.author.name}</h3>
                  <p className="text-xs text-primary font-medium mt-0.5">aka {PRODUCT.author.alias}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{PRODUCT.author.title}</p>
                </div>
              </div>

              <p className="text-sm text-foreground/85 leading-relaxed mt-4">
                <span className="font-semibold text-foreground">{PRODUCT.author.name}</span> ({PRODUCT.author.alias}) is the{" "}
                <span className="font-semibold text-foreground">Founder &amp; CEO</span> of{" "}
                <span className="font-semibold text-foreground">Nicle Inc.</span> and{" "}
                <span className="font-semibold text-foreground">All Things Web Technology Inc.</span> He released{" "}
                <span className="font-semibold text-foreground">Open Nicer</span> to the world as open-source software — free for
                everyone to use, learn from, and build upon.
              </p>

              <a
                href={PRODUCT.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Globe className="size-4" />
                allthingswebtech.com
                <ExternalLink className="size-3.5 opacity-70" />
              </a>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="bg-background/40 border border-border/40 rounded-2xl p-3">
                  <Code2 className="size-4 text-primary mb-1" />
                  <div className="text-xs font-semibold">Full-Stack</div>
                  <div className="text-[10px] text-muted-foreground">Engineer</div>
                </div>
                <div className="bg-background/40 border border-border/40 rounded-2xl p-3">
                  <MessageCircle className="size-4 text-primary mb-1" />
                  <div className="text-xs font-semibold">Open Source</div>
                  <div className="text-[10px] text-muted-foreground">Released worldwide</div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Open source promise">
            <div className="bg-card/60 border border-border/60 rounded-3xl p-5 lg:p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center">
                  <Github className="size-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Free for everyone</div>
                  <div className="text-[11px] text-muted-foreground">
                    {PRODUCT.license} License · Copy, fork, ship
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">{OPEN_SOURCE_STATEMENT}</p>
              <p className="text-sm text-foreground/85 leading-relaxed mt-3">
                Use it for personal projects, classrooms, startups, or enterprise — no permission needed. Attribution is
                appreciated but not required.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
                  <Shield className="size-3" /> Security-minded
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
                  <Phone className="size-3" /> Voice &amp; video
                </span>
              </div>
            </div>
          </Section>

          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              Made with <Heart className="size-3 text-primary" fill="currentColor" /> by {PRODUCT.author.name}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              © {new Date().getFullYear()} Nicle Inc. · All Things Web Technology Inc.
            </p>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</div>
      <div className="bg-card/60 border border-border/60 rounded-3xl p-5 lg:p-6">{children}</div>
    </div>
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
