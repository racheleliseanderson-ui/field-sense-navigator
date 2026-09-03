import { Check, Contrast, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { FIELD_MODE_LABEL, FIELD_MODE_NOTE, useFieldMode } from "@/lib/field-mode";

/**
 * The instrument's ONE appearance and accessibility control.
 *
 * Fleet standard: a single floating control in the lower-right corner covering
 * light, dark and colour-vision / high-contrast modes plus motion. Nothing else
 * in the application may offer a second theme, appearance or accessibility
 * switch — mount this once, in the root shell, and leave the page chrome alone.
 *
 * It sits above the phone action bar on record pages via `--dock-h`, which
 * `DockOffset` sets while such a bar is mounted.
 */

const SWATCH: Record<Theme, string> = {
  light: "bg-[oklch(0.968_0.009_85)] border-[oklch(0.5_0.02_262)]",
  dark: "bg-[oklch(0.178_0.014_262)] border-[oklch(0.6_0.02_262)]",
  cvd: "bg-[linear-gradient(135deg,oklch(0.7_0.13_245)_50%,oklch(0.78_0.14_72)_50%)] border-[oklch(0.6_0.02_262)]",
  black: "bg-black border-white",
  white: "bg-white border-black",
};

const GROUND = THEMES.filter((t) => t.group === "ground");
const ACCESS = THEMES.filter((t) => t.group === "access");

export function DisplayControl() {
  const { theme, setTheme, motion, setMotion } = useTheme();
  const { setting: fieldSetting, set: setFieldMode } = useFieldMode();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = THEMES.find((t) => t.id === theme);

  const row = (t: (typeof THEMES)[number]) => (
    <li key={t.id}>
      <button
        type="button"
        onClick={() => setTheme(t.id)}
        aria-pressed={theme === t.id}
        className={`tap flex min-h-11 w-full items-center gap-3 border px-3 py-2 text-left ${
          theme === t.id
            ? "border-brass/60 bg-brass/10"
            : "border-transparent hover:border-hairline"
        }`}
      >
        <span aria-hidden="true" className={`h-4 w-4 shrink-0 border ${SWATCH[t.id]}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{t.label}</span>
          <span className="block truncate text-[0.68rem] text-muted-foreground">{t.hint}</span>
        </span>
        {theme === t.id && <Check className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />}
      </button>
    </li>
  );

  return (
    <div
      ref={box}
      data-print="hide"
      className="display-dock fixed right-4 z-[60] print:hidden sm:right-6"
    >
      {open && (
        <div
          role="dialog"
          aria-label="Display and accessibility"
          className="panel absolute bottom-full right-0 mb-3 max-h-[70dvh] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="tick text-[0.55rem]">Display &amp; accessibility</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
              aria-label="Close display settings"
              className="tap -mr-1 -mt-1 grid grid-cols-1 h-9 w-9 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Reading mode belongs in this panel and nowhere else: it changes
              how the page looks, and this instrument keeps every such control
              behind one affordance. */}
          <div className="mt-3">
            <p className="tick text-[0.55rem]">Reading</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {(["off", "auto", "on"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFieldMode(m)}
                  aria-pressed={fieldSetting === m}
                  className={`tap min-h-11 border text-xs uppercase tracking-[0.12em] ${
                    fieldSetting === m
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-hairline text-muted-foreground hover:border-brass/40"
                  }`}
                >
                  {FIELD_MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground">
              {FIELD_MODE_NOTE[fieldSetting]}
            </p>
          </div>

          <div className="rule-top mt-4 pt-3">
            <p className="tick text-[0.55rem]">Ground</p>
            <ul className="mt-2 space-y-1">{GROUND.map(row)}</ul>
          </div>

          <div className="rule-top mt-4 pt-3">
            <p className="tick text-[0.55rem]">Accessibility modes</p>
            <ul className="mt-2 space-y-1">{ACCESS.map(row)}</ul>
            <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground">
              Status is carried by shape as well as colour in every mode, so a reading never depends
              on hue alone.
            </p>
          </div>

          <div className="rule-top mt-4 pt-3">
            <p className="tick text-[0.55rem]">Motion</p>
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
                      : "border-hairline text-muted-foreground hover:border-brass/40"
                  }`}
                >
                  {m === "on" ? "Full" : "Reduced"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Display and accessibility settings — currently ${active?.label ?? "Dark"}`}
        title="Display and accessibility"
        className="tap grid grid-cols-1 h-12 w-12 place-items-center border border-hairline bg-panel/95 text-foreground shadow-lg backdrop-blur transition-colors hover:border-brass/60 hover:text-brass"
      >
        <Contrast className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Lifts the floating control clear of a page-level action bar fixed to the
 * bottom of the viewport (the phone thumb bar on a record). Render it inside
 * the page that owns that bar.
 */
export function DockOffset({ height = "3.5rem" }: { height?: string }) {
  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--dock-h", height);
    return () => {
      el.style.removeProperty("--dock-h");
    };
  }, [height]);
  return null;
}
