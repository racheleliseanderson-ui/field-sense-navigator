import { Link } from "@tanstack/react-router";
import { Anchor, Check, Contrast, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { useT } from "@/lib/i18n";

const NAV = [
  { to: "/", key: "nav.instrument", label: "Instrument" },
  { to: "/plan", key: "nav.plan", label: "Plan a day" },
  { to: "/explore", key: "nav.catalog", label: "Catalog" },
  { to: "/watchlist", key: "nav.watchlist", label: "Watchlist" },
  { to: "/boundary", key: "nav.boundary", label: "Boundary" },
] as const;

const SWATCH: Record<Theme, string> = {
  dark: "bg-[oklch(0.178_0.014_262)] border-[oklch(0.6_0.02_262)]",
  light: "bg-[oklch(0.968_0.009_85)] border-[oklch(0.5_0.02_262)]",
  black: "bg-black border-white",
  white: "bg-white border-black",
  cvd: "bg-[linear-gradient(135deg,oklch(0.7_0.13_245)_50%,oklch(0.78_0.14_72)_50%)] border-[oklch(0.6_0.02_262)]",
};

/** Display control: five grounds, motion and interface language in one panel. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, setTheme, motion, setMotion, lang, setLang } = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("chrome.displayMode", "Display mode")}
        className="tap grid h-11 w-11 shrink-0 place-items-center border border-hairline bg-panel/60 text-foreground hover:border-brass/50"
      >
        <Contrast className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("chrome.display", "Display")}
          className="panel absolute right-0 z-50 mt-2 w-[17.5rem] p-4"
        >
          <p className="tick text-[0.55rem]">{t("chrome.displayMode", "Display mode")}</p>
          <ul className="mt-2 space-y-1">
            {THEMES.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setTheme(m.id)}
                  aria-pressed={theme === m.id}
                  className={`tap flex min-h-11 w-full items-center gap-3 border px-3 text-left ${
                    theme === m.id
                      ? "border-brass/60 bg-brass/10"
                      : "border-transparent hover:border-hairline"
                  }`}
                >
                  <span aria-hidden="true" className={`h-4 w-4 shrink-0 border ${SWATCH[m.id]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{m.label}</span>
                    <span className="block truncate text-[0.68rem] text-muted-foreground">
                      {m.hint}
                    </span>
                  </span>
                  {theme === m.id && (
                    <Check className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="rule-top mt-4 pt-3">
            <p className="tick text-[0.55rem]">{t("chrome.motion", "Motion")}</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {(["on", "off"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotion(m)}
                  aria-pressed={motion === m}
                  className={`tap min-h-11 border text-xs uppercase tracking-[0.12em] ${
                    motion === m
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-hairline text-muted-foreground"
                  }`}
                >
                  {m === "on" ? t("chrome.motionOn", "Full") : t("chrome.motionOff", "Reduced")}
                </button>
              ))}
            </div>
          </div>

          <div className="rule-top mt-4 pt-3">
            <p className="tick text-[0.55rem]">{t("chrome.language", "Language")}</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {([
                { id: "en", label: "English" },
                { id: "es", label: "Español" },
              ] as const).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLang(l.id)}
                  aria-pressed={lang === l.id}
                  lang={l.id}
                  className={`tap min-h-11 border text-xs uppercase tracking-[0.12em] ${
                    lang === l.id
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-hairline text-muted-foreground"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground">
              {t(
                "chrome.sourceNote",
                "Interface only. Waterbody names and official agency notices stay in their published wording.",
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const t = useT();

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
              className="tap inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-brass"
            >
              {t(item.key, item.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 border border-hairline px-3 py-1.5 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-clear" />
            <span className="tick text-[0.6rem]">
              {t("chrome.publicOnly", "Public waters only")}
            </span>
          </span>
          <ThemeSwitch />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={
              open ? t("chrome.closeMenu", "Close menu") : t("chrome.openMenu", "Open menu")
            }
            className="tap grid h-11 w-11 shrink-0 place-items-center border border-hairline bg-panel/60 text-foreground md:hidden"
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
                  className="tap flex min-h-12 items-center text-sm text-muted-foreground data-[status=active]:text-brass"
                >
                  {t(item.key, item.label)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="tick mt-3 text-[0.58rem]">
            {t("chrome.failClosed", "Public waters only · fail closed")}
          </p>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer data-print="hide" className="mt-24 border-t border-hairline bg-abyss">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground">
            {t("footer.headline", "Named public waters. Nothing else.")}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t(
              "footer.blurb",
              "No private spots, no coordinates, no live-condition claims, no catch guarantees. Where a check cannot be completed, the water is treated as not-go.",
            )}
          </p>
        </div>
        <div>
          <p className="tick">{t("footer.instrument", "Instrument")}</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>
              <Link to="/plan" className="tap inline-flex min-h-11 items-center hover:text-foreground">
                {t("footer.planDay", "Plan a day")}
              </Link>
            </li>
            <li>
              <Link to="/explore" className="tap inline-flex min-h-11 items-center hover:text-foreground">
                {t("footer.fullCatalog", "Full catalog")}
              </Link>
            </li>
            <li>
              <Link to="/boundary" className="tap inline-flex min-h-11 items-center hover:text-foreground">
                {t("footer.boundaryMethod", "Boundary & method")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="tick">{t("footer.record", "Record")}</p>
          <ul className="data mt-3 space-y-2 text-sm text-muted-foreground">
            <li>{t("footer.schema", "Schema 0.4.0")}</li>
            <li>{t("footer.waters", "318 named waters")}</li>
            <li>{t("footer.states", "16 states")}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-hairline">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground sm:px-8">
          {t(
            "footer.legal",
            "Honey Hole Intelligence — built for Hook the Horizon. Official agency sources are authoritative; posted signage on the day wins over anything printed here.",
          )}
        </p>
      </div>
    </footer>
  );
}