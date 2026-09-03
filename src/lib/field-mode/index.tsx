/**
 * Hook the Horizon — field mode.
 *
 * BYTE-IDENTICAL ACROSS THE FLEET. Canonical copy lives in field-ops-desk at
 * src/lib/field-mode/. Edit it there and run `node scripts/sync-fleet-shared.mjs`.
 *
 * Every instrument in this fleet is designed at a desk and used on rocks. The
 * gap between those two is not a matter of taste, it is a list of specific
 * physical facts:
 *
 *   Bright sun flattens contrast until mid-grey text disappears entirely.
 *   Wet hands miss anything under about 48 pixels, repeatedly.
 *   One hand is holding a rod, so nothing may require two.
 *   Wind and cold make reading a paragraph an unreasonable request.
 *   Signal is poor, so nothing may depend on arriving.
 *
 * So this is not a dark mode or a font-size slider. It is a declaration that
 * the reader is standing in water, and everything that follows from that:
 * larger type, ink instead of grey, targets that survive a wet thumb, prose
 * collapsed to the line that decides something, and the reasoning still one
 * tap away rather than deleted — because a beginner in the field needs the
 * reason more than a beginner at a desk does, not less.
 *
 * It persists per device, not per account. The phone in your pocket at the
 * river and the laptop on the kitchen table are two different situations and
 * should not share this setting.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const KEY = "hth-field-mode-v1";

/**
 * The three states are deliberate.
 *
 * `auto` is the default and means "decide from the screen": a phone-sized
 * viewport in a portrait orientation is somebody standing up. It is a guess,
 * and it is a good one often enough to be worth making — but it is always
 * overridable, because a phone on a desk and a tablet on a boat both exist and
 * neither is what the guess assumes.
 */
export type FieldModeSetting = "auto" | "on" | "off";

export type FieldModeValue = {
  /** What the reader chose. */
  setting: FieldModeSetting;
  /** What that resolves to right now. */
  active: boolean;
  /** True when `auto` is what turned it on, so the UI can say so. */
  byGuess: boolean;
  set: (next: FieldModeSetting) => void;
  /** Cycles off → on → auto, for a single control. */
  cycle: () => void;
};

const Ctx = createContext<FieldModeValue | null>(null);

function read(): FieldModeSetting {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "on" || raw === "off" ? raw : "auto";
  } catch {
    /* private window, blocked storage, embedded frame — the default is fine */
    return "auto";
  }
}

/**
 * Runs before first paint so field mode never flashes the desk layout.
 *
 * Inline this in the document head. It is deliberately tiny and deliberately
 * wrapped in its own try — a boot script that throws takes the whole page's
 * first paint with it, and this fleet has already shipped one that did.
 */
export const FIELD_MODE_BOOT_SCRIPT = `(function(){try{var s=null;try{s=window.localStorage.getItem('${KEY}')}catch(e){}var on=s==='on'||(s!=='off'&&window.matchMedia&&window.matchMedia('(max-width: 700px)').matches);if(on){document.documentElement.setAttribute('data-hthp-field','on')}}catch(e){}})();`;

export function FieldModeProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<FieldModeSetting>("auto");
  const [narrow, setNarrow] = useState(false);

  useEffect(() => setSetting(read()), []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const active = setting === "on" || (setting === "auto" && narrow);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (active) root.setAttribute("data-hthp-field", "on");
    else root.removeAttribute("data-hthp-field");
  }, [active]);

  const set = useCallback((next: FieldModeSetting) => {
    setSetting(next);
    try {
      if (next === "auto") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      /* the setting still applies for this session; it just will not persist */
    }
  }, []);

  const cycle = useCallback(() => {
    setSetting((prev) => {
      const next: FieldModeSetting = prev === "off" ? "on" : prev === "on" ? "auto" : "off";
      try {
        if (next === "auto") window.localStorage.removeItem(KEY);
        else window.localStorage.setItem(KEY, next);
      } catch {
        /* as above */
      }
      return next;
    });
  }, []);

  const value = useMemo<FieldModeValue>(
    () => ({ setting, active, byGuess: setting === "auto" && narrow, set, cycle }),
    [setting, active, narrow, set, cycle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Field mode, wherever you are in the tree.
 *
 * Safe outside a provider: it reports off rather than throwing, so a component
 * can be dropped into an app that has not adopted the provider yet and simply
 * behaves as it did before.
 */
export function useFieldMode(): FieldModeValue {
  const ctx = useContext(Ctx);
  const [fallback] = useState<FieldModeValue>(() => ({
    setting: "off",
    active: false,
    byGuess: false,
    set: () => {},
    cycle: () => {},
  }));
  return ctx ?? fallback;
}

export const FIELD_MODE_LABEL: Record<FieldModeSetting, string> = {
  auto: "Auto",
  on: "Field",
  off: "Desk",
};

export const FIELD_MODE_NOTE: Record<FieldModeSetting, string> = {
  auto: "On when the screen is phone-sized. Off at a desk.",
  on: "Bigger type, harder contrast, wet-hand targets. Reasoning is one tap away, not gone.",
  off: "Full layout, whatever the screen.",
};
