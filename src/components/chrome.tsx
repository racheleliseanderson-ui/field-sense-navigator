import { Link } from "@tanstack/react-router";
import { Anchor, ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { NAMED_WATER_COUNT, provinces, usStates } from "@/lib/catalog";
import { HOUSE_LEGAL_URL, HOUSE_NAME, HOUSE_URL, THIS_APP, THIS_PUBLICATION } from "@/lib/fleet";
import { CommandPalette } from "@/components/command-palette";

/**
 * Application chrome.
 *
 * Appearance and accessibility live in exactly one place — the floating
 * control in the lower-right corner, mounted once by the root shell. Do not
 * add a theme, contrast, motion or language switch here.
 */

/** The five places a reader works. */
const PRIMARY_NAV = [
  { to: "/", label: "Check a water" },
  { to: "/plan", label: "Plan a day" },
  { to: "/explore", label: "Explore waters" },
  { to: "/compare", label: "Compare" },
  { to: "/watchlist", label: "Watchlist" },
] as const;

/** Method and scope — reachable everywhere, but not competing for the header. */
const SECONDARY_NAV = [
  { to: "/pipeline", label: "How a decision comes together" },
  { to: "/boundary", label: "Limits & sources" },
] as const;

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  // A route change or a resize past the breakpoint must not strand the sheet open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onWide = () => {
      if (mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <header
      data-print="hide"
      className="sticky top-0 z-40 border-b border-hairline bg-abyss/80 backdrop-blur-xl"
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:border focus:border-brass/60 focus:bg-panel focus:px-4 focus:py-2 focus:text-xs focus:uppercase focus:tracking-[0.14em] focus:text-brass"
      >
        Skip to content
      </a>
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:px-8 md:flex md:gap-6">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass/40 bg-brass/10 text-brass">
            <Anchor className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block truncate font-display text-[0.85rem] font-bold uppercase tracking-[0.18em] text-foreground sm:text-[0.95rem]">
              Field Sense
            </span>
            <span className="tick mt-1 block text-[0.6rem]">Public-water planning</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="tap inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-brass"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 border border-hairline px-3 py-1.5 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-clear" />
            <span className="tick text-[0.6rem]">Public waters only</span>
          </span>
          <CommandPalette />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="tap grid grid-cols-1 h-11 w-11 shrink-0 place-items-center border border-hairline bg-panel/60 text-foreground md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-menu"
          aria-label="All sections"
          className="page-in max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-hairline bg-abyss/95 px-safe pb-8 pt-2 backdrop-blur-xl md:hidden"
        >
          <ul className="divide-y divide-hairline">
            {ALL_NAV.map((item, i) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="tap group flex min-h-14 items-center gap-4 font-display text-xl font-bold tracking-tight text-foreground/85 data-[status=active]:text-brass"
                >
                  <span className="data text-[0.65rem] text-brass/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-3">
            <span className="h-px w-8 bg-brass" />
            <p className="tick text-[0.58rem]">
              Public waters only · uncertain information stays marked for confirmation
            </p>
          </div>
          <p className="tick mt-6 text-[0.55rem] text-brass">Hook the Horizon</p>
          <ul className="mt-2 divide-y divide-hairline">
            {THIS_PUBLICATION.apps
              .filter((a) => a.name !== THIS_APP)
              .map((a) => (
                <li key={a.url}>
                  <a
                    href={a.url}
                    className="tap flex min-h-12 items-center justify-between gap-3 text-sm text-muted-foreground hover:text-brass"
                  >
                    {a.name}
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            <li>
              <a
                href={THIS_PUBLICATION.publication.url}
                className="tap flex min-h-12 items-center justify-between gap-3 text-sm text-muted-foreground hover:text-brass"
              >
                {THIS_PUBLICATION.publication.name} — the publication
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer
      data-print="hide"
      className="relative mt-24 overflow-hidden border-t border-hairline bg-abyss"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brass/60 to-transparent"
      />
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid grid-cols-1 max-w-7xl gap-10 px-safe py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-brass/40 bg-brass/10 text-brass">
              <Anchor className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="tick text-brass">Hook the Horizon</span>
          </div>
          <p className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">
            Named public waters. Nothing else.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            No private spots, exact coordinates, catch guarantees, or invented live
            conditions. If current access or safety information cannot be confirmed,
            Field Sense tells you what still needs checking instead of guessing.
          </p>
          <dl className="data mt-6 space-y-1 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <dt className="sr-only">Named waters</dt>
              <dd>{NAMED_WATER_COUNT} named waters</dd>
            </div>
            <div className="flex gap-2">
              <dt className="sr-only">Jurisdictions</dt>
              <dd>
                {usStates.length} states + {provinces.length} provinces &amp; territories
              </dd>
            </div>
          </dl>
        </div>

        <nav aria-label="Sections">
          <p className="tick">This instrument</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {ALL_NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="tap inline-flex min-h-11 items-center hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Hook the Horizon instruments">
          <p className="tick">Next in the workflow</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {THIS_PUBLICATION.apps
              .filter((a) => a.name !== THIS_APP)
              .map((a) => (
                <li key={a.url}>
                  <a
                    href={a.url}
                    className="tap inline-flex min-h-11 items-center gap-1.5 hover:text-brass"
                  >
                    {a.name}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
          </ul>
        </nav>

        <nav aria-label="Publication and house">
          <p className="tick">Elsewhere</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>
              <a
                href={THIS_PUBLICATION.publication.url}
                className="tap inline-flex min-h-11 items-center gap-1.5 hover:text-brass"
              >
                {THIS_PUBLICATION.publication.name}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            </li>
            <li>
              <a
                href={HOUSE_URL}
                className="tap inline-flex min-h-11 items-center gap-1.5 hover:text-brass"
              >
                {HOUSE_NAME}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            </li>
            <li>
              <a
                href={HOUSE_LEGAL_URL}
                className="tap inline-flex min-h-11 items-center gap-1.5 hover:text-brass"
              >
                Legal &amp; accessibility
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="relative border-t border-hairline">
        <p className="mx-auto max-w-7xl px-safe py-5 text-xs leading-relaxed text-muted-foreground sm:px-8">
          Field Sense Navigator — built for Hook the Horizon. Official agency sources
          are authoritative; posted signage on the day wins over anything printed here.
        </p>
      </div>
    </footer>
  );
}
