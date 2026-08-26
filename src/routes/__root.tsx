import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider, themeBootstrapScript } from "../lib/theme";

function FleetReturnBar() {
  return (
    <div
      role="region"
      aria-label="Hook the Horizon field tools"
      data-tool-manifest="https://hookthehorizon.blog/wp-json/hth/v1/tools"
      style={{
        position: "relative",
        zIndex: 60,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.45rem 1rem",
        padding: "0.55rem 1rem",
        background: "#071827",
        color: "#e3e1d9",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.75rem",
        lineHeight: 1.35,
      }}
    >
      <a href="https://hookthehorizon.blog/field-tools/" style={{ color: "#c7a257", fontWeight: 800, textDecoration: "none" }}>
        Hook the Horizon · All field tools
      </a>
      <span style={{ opacity: 0.78 }}>No exact fishing coordinates are required or passed between tools.</span>
      <a href="https://hookthehorizon.blog/field-tools/first-run/" style={{ marginLeft: "auto", color: "#c7a257", fontWeight: 800, textDecoration: "none" }}>
        90-second start →
      </a>
    </div>
  );
}

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Field Sense Navigator — Check a Public Water Before You Go" },
      {
        name: "description",
        content:
          "Check access, rules, standing hazards, crowding and the same-day conditions you still need to verify for a named public water. No private spots or fishing pins.",
      },
      { name: "author", content: "Hook the Horizon" },
      { property: "og:title", content: "Field Sense Navigator" },
      {
        property: "og:description",
        content: "Check whether a named public water is workable before you drive to it. No private spots or invented current conditions.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content:
          "https://i0.wp.com/hookthehorizon.blog/wp-content/uploads/2026/07/River-current-and-foam-lines-%E2%80%94-Jonas-Gerg.jpg?resize=1200%2C630&ssl=1",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "Looking down on a river showing foam lines and current seams between faster and slower water",
      },
      { property: "og:url", content: "https://waterways.hookthehorizon.blog/" },
      {
        name: "twitter:image",
        content:
          "https://i0.wp.com/hookthehorizon.blog/wp-content/uploads/2026/07/River-current-and-foam-lines-%E2%80%94-Jonas-Gerg.jpg?resize=1200%2C630&ssl=1",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
        <noscript>
          <style>{`[data-reveal],[data-reveal-crop],[data-reveal-rule]{opacity:1!important;transform:none!important;clip-path:none!important}`}</style>
        </noscript>
      </head>
      <body>
        <FleetReturnBar />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
