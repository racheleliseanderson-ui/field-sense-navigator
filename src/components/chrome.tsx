import { Link } from "@tanstack/react-router";
import { Anchor, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";

import { useTheme } from "@/lib/theme";

const NAV = [
  { to: "/", label: "Instrument" },
  { to: "/plan", label: "Plan a day" },
  { to: "/explore", label: "Catalog" },
  { to: "/boundary", label: "Boundary" },
] as const;

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to field daylight" : "Switch to dark instrument"}
      title={dark ? "Field daylight" : "Dark instrument"}
      className={`group inline-flex h-9 shrink-0 items-center gap-1 border border-hairline bg-panel/60 px-1.5 transition-colors hover:border-brass/50 ${className}`}
    >
      <span
        className={`grid h-6 w-6 place-items-center transition-colors ${dark ? "bg-brass/15 text-brass" : "text-muted-foreground"}`}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span
        className={`grid h-6 w-6 place-items-center transition-colors ${dark ? "text-muted-foreground" : "bg-brass/15 text-brass"}`}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header
      data-print="hide"
      className="sticky top-0 z-40 border-b border-hairline bg-abyss/80 backdrop-blur-xl"
    >
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:px-8 md:flex md:gap-6">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass/40 bg-brass/10 text-brass">
            <Anchor className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block truncate font-display text-[0.85rem] font-bold uppercase tracking-[0.18em] text-foreground sm:text-[0.95rem]">
              Honey Hole
            </span>
            <span className="tick mt-1 block text-[0.6rem]">Field intelligence</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-brass"
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
          <ThemeSwitch />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-9 w-9 shrink-0 place-items-center border border-hairline bg-panel/60 text-foreground md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-hairline bg-abyss/95 px-5 py-3 md:hidden">
          <ul className="divide-y divide-hairline">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm text-muted-foreground data-[status=active]:text-brass"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="tick mt-3 text-[0.58rem]">Public waters only · fail closed</p>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer
      data-print="hide"
      className="mt-24 border-t border-hairline bg-abyss"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground">
            Named public waters. Nothing else.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            No private spots, no coordinates, no live-condition claims, no catch
            guarantees. Where a check cannot be completed, the water is treated as
            not-go.
          </p>
        </div>
        <div>
          <p className="tick">Instrument</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/plan" className="hover:text-foreground">Plan a day</Link></li>
            <li><Link to="/explore" className="hover:text-foreground">Full catalog</Link></li>
            <li><Link to="/boundary" className="hover:text-foreground">Boundary & method</Link></li>
          </ul>
        </div>
        <div>
          <p className="tick">Record</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground data">
            <li>Schema 0.4.0</li>
            <li>277 named waters</li>
            <li>16 states</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-hairline">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground sm:px-8">
          Honey Hole Intelligence — built for Hook the Horizon. Official agency
          sources are authoritative; posted signage on the day wins over anything
          printed here.
        </p>
      </div>
    </footer>
  );
}