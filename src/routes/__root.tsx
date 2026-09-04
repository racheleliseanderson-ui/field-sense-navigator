import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FIELD_MODE_BOOT_SCRIPT, FieldModeProvider } from "../lib/field-mode";
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
import { SupportLink } from "../components/support-link";
import { DisplayControl } from "../components/display-control";
import { reportClientError } from "../lib/error-reporting";
import { ThemeProvider, themeBootstrapScript } from "../lib/theme";
import { OfflineBanner, ServiceWorkerRegistrar } from "@/components/offline";

/** Every dead end offers the same three ways back into the instrument. */
const WAYS_BACK = [
  { to: "/", label: "Check a water" },
  { to: "/explore", label: "Explore the catalog" },
  { to: "/plan", label: "Plan a day" },
] as const;

function WaysBack() {
  return (
    <ul className="mt-7 flex flex-wrap justify-center gap-2">
      {WAYS_BACK.map((w, i) => (
        <li key={w.to}>
          <Link
            to={w.to}
            className={`tap inline-flex min-h-12 items-center border px-5 text-xs uppercase tracking-[0.14em] transition-colors ${
              i === 0
                ? "border-brass/60 bg-selected text-selected-foreground hover:bg-selected/85"
                : "border-hairline text-foreground hover:border-brass/50"
            }`}
          >
            {w.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-md text-center">
        <p className="tick text-brass">No record at this address</p>
        <h1 className="mt-4 font-display text-[clamp(2rem,7vw,3rem)] font-bold leading-[0.95] tracking-[-0.04em] text-foreground">
          That water is not on the catalog.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Either the address is wrong, or the record was never here. Nothing is invented to fill the
          page — start again from a search or from a declared job.
        </p>
        <WaysBack />
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-md text-center">
        <p className="tick text-alert">This page did not load</p>
        <h1 className="mt-4 font-display text-[clamp(1.8rem,6vw,2.6rem)] font-bold leading-[1] tracking-[-0.04em] text-foreground">
          Something broke on our side.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Nothing on this screen should be treated as a reading. Try again, and if it keeps failing,
          go to the official source for the water directly.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tap inline-flex min-h-12 items-center border border-brass/60 bg-selected px-5 text-xs uppercase tracking-[0.14em] text-selected-foreground hover:bg-selected/85"
          >
            Try again
          </button>
        </div>
        <WaysBack />
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Field Sense Navigator — Read Public Waters Before You Go" },
      {
        name: "description",
        content:
          "A field guide for named public waters: readiness, how to read the water, access and launches, and a printable brief.",
      },
      { name: "author", content: "Hook the Horizon" },
      { name: "theme-color", content: "#10141b" },
      { property: "og:site_name", content: "Hook the Horizon" },
      { property: "og:title", content: "Field Sense Navigator" },
      {
        property: "og:description",
        content:
          "Layered intelligence for named public waters. No private spots, no invented conditions.",
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
        {/* Field mode before first paint, so a phone never flashes the desk layout. */}
        <script dangerouslySetInnerHTML={{ __html: FIELD_MODE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
        <noscript>
          <style>{`[data-reveal],[data-reveal-crop],[data-reveal-rule]{opacity:1!important;transform:none!important;clip-path:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {children}
        <SupportLink />
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
        {/* Reading mode wraps the control as well as the pages: DisplayControl
            is where a reader changes it, so it has to be inside. */}
        <FieldModeProvider>
          {/* The craft survives a lost signal; the readings deliberately do not. */}
          <ServiceWorkerRegistrar />
          <OfflineBanner />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          {/* The instrument's ONE appearance and accessibility control. */}
          <DisplayControl />
        </FieldModeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
