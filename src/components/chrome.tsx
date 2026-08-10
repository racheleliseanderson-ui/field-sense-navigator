import { Link } from "@tanstack/react-router";
import { Anchor } from "lucide-react";

const NAV = [
  { to: "/", label: "Instrument" },
  { to: "/plan", label: "Plan a day" },
  { to: "/explore", label: "Catalog" },
  { to: "/boundary", label: "Boundary" },
] as const;

export function SiteHeader() {
  return (
    <header
      data-print="hide"
      className="sticky top-0 z-40 border-b border-hairline bg-abyss/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center border border-brass/40 bg-brass/10 text-brass">
            <Anchor className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="leading-none">
            <span className="block font-display text-[0.95rem] font-bold uppercase tracking-[0.18em] text-foreground">
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

        <span className="ml-auto hidden items-center gap-2 border border-hairline px-3 py-1.5 md:ml-0 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-clear" />
          <span className="tick text-[0.6rem]">Public waters only</span>
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-hairline px-5 py-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground data-[status=active]:text-brass"
          >
            {item.label}
          </Link>
        ))}
      </div>
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