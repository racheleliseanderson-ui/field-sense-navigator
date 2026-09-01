import { useCallback, useEffect, useState } from "react";

import { READ_LEVELS, type ReadLevel } from "@/lib/water-reading";

const KEY = "hhi-read-level";
const EVENT = "hhi-read-level-change";

function parse(value: string | null): ReadLevel | null {
  return READ_LEVELS.some((l) => l.id === value) ? (value as ReadLevel) : null;
}

function read(): ReadLevel {
  if (typeof window === "undefined") return "working";
  try {
    return parse(localStorage.getItem(KEY)) ?? "working";
  } catch {
    return "working";
  }
}

/**
 * How much water-reading detail this reader wants, held on the device and
 * shared by every record they open. Beginner → competent → advanced is a
 * setting, not a separate product.
 */
export function useReadLevel() {
  const [level, setLevelState] = useState<ReadLevel>("working");

  useEffect(() => {
    const sync = () => setLevelState(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLevel = useCallback((next: ReadLevel) => {
    setLevelState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable — the session still switches */
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  return { level, setLevel };
}
