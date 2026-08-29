import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Five grounds. Deep water is the signature and the default. */
export type Theme = "dark" | "light" | "black" | "white" | "cvd";
export type Motion = "on" | "off";
export type Lang = "en" | "es";

export const THEME_STORAGE_KEY = "hhi-theme";
export const MOTION_STORAGE_KEY = "hhi-motion";
export const LANG_STORAGE_KEY = "hhi-lang";

export const THEMES: Array<{ id: Theme; label: string; hint: string }> = [
  { id: "dark", label: "Deep water", hint: "Dark navy, low glare" },
  { id: "light", label: "Field daylight", hint: "Warm paper white" },
  { id: "black", label: "High-contrast black", hint: "Pure black, white ink" },
  { id: "white", label: "High-contrast white", hint: "Pure white, black ink" },
  { id: "cvd", label: "Color-blind safe", hint: "Blue / orange signal scale" },
];

/** Grounds that sit on a dark base and therefore keep the `dark` class. */
const DARK_BASE: Theme[] = ["dark", "black", "cvd"];

export const themeClasses = (t: Theme) => ({
  dark: DARK_BASE.includes(t),
  black: t === "black",
  white: t === "white",
  cvd: t === "cvd",
});

/** Runs before hydration so the page never flashes the wrong ground. */
export const themeBootstrapScript = `(function(){try{var v=["dark","light","black","white","cvd"];var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(v.indexOf(t)<0){t="dark"}var e=document.documentElement;e.classList.toggle("dark",t==="dark"||t==="black"||t==="cvd");e.classList.toggle("mode-black",t==="black");e.classList.toggle("mode-white",t==="white");e.classList.toggle("mode-cvd",t==="cvd");e.dataset.theme=t;var m=localStorage.getItem("${MOTION_STORAGE_KEY}");if(m!=="off"&&m!=="on"){m=window.matchMedia("(prefers-reduced-motion: reduce)").matches?"off":"on"}e.dataset.motion=m;var l=localStorage.getItem("${LANG_STORAGE_KEY}");if(l!=="es"){l="en"}e.lang=l;e.dataset.lang=l}catch(_){document.documentElement.classList.add("dark")}})();`;

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  motion: Motion;
  setMotion: (m: Motion) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  setTheme: () => {},
  toggle: () => {},
  motion: "on",
  setMotion: () => {},
  lang: "en",
  setLang: () => {},
});

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the session still switches */
  }
}

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  const c = themeClasses(theme);
  el.classList.toggle("dark", c.dark);
  el.classList.toggle("mode-black", c.black);
  el.classList.toggle("mode-white", c.white);
  el.classList.toggle("mode-cvd", c.cvd);
  el.dataset['theme'] = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [motion, setMotionState] = useState<Motion>("on");
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const storedTheme = read(THEME_STORAGE_KEY) as Theme | null;
    const next: Theme =
      storedTheme && THEMES.some((t) => t.id === storedTheme) ? storedTheme : "dark";
    setThemeState(next);
    applyTheme(next);

    const storedMotion = read(MOTION_STORAGE_KEY);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m: Motion =
      storedMotion === "on" || storedMotion === "off"
        ? storedMotion
        : prefersReduced
          ? "off"
          : "on";
    setMotionState(m);
    document.documentElement.dataset['motion'] = m;

    const storedLang = read(LANG_STORAGE_KEY);
    const l: Lang = storedLang === "es" ? "es" : "en";
    setLangState(l);
    document.documentElement.lang = l;
    document.documentElement.dataset['lang'] = l;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    write(THEME_STORAGE_KEY, t);
  }, []);

  const setMotion = useCallback((m: Motion) => {
    setMotionState(m);
    document.documentElement.dataset['motion'] = m;
    write(MOTION_STORAGE_KEY, m);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    document.documentElement.dataset['lang'] = l;
    write(LANG_STORAGE_KEY, l);
  }, []);

  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setTheme]);

  return (
    <Ctx.Provider
      value={{ theme, setTheme, toggle, motion, setMotion, lang, setLang }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);