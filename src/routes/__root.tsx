import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { UnreadProvider } from "@/contexts/unread-context";
import { CallProvider } from "@/contexts/call-context";
import { CallUiLayer } from "@/components/CallUiLayer";
import { GroupCallProvider } from "@/contexts/group-call-context";
import { AppBootstrap } from "@/components/AppBootstrap";

import appCss from "../styles.css?url";
import { homePageHead } from "@/lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => {
    const seo = homePageHead();
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
        { name: "theme-color", content: "#1a0d2e" },
        {
          name: "author",
          content: "Mr. Highness Chinedu (Mr. Highness HC) — Nicle Inc. & All Things Web Technology Inc.",
        },
        ...seo.meta,
      ],
      links: [
        { rel: "icon", type: "image/png", href: "/open-nicer.png" },
        { rel: "apple-touch-icon", href: "/open-nicer.png" },
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap",
        },
        ...seo.links,
      ],
      scripts: seo.scripts,
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AppBootstrap>
      <UnreadProvider>
        <CallProvider>
          <GroupCallProvider>
            <Outlet />
            <CallUiLayer />
            <Toaster position="top-center" theme="dark" />
          </GroupCallProvider>
        </CallProvider>
      </UnreadProvider>
    </AppBootstrap>
  );
}
