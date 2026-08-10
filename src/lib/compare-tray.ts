import { useCallback, useEffect, useState } from "react";
import { destinations, type Destination } from "@/lib/catalog";

const KEY = "hhi-compare";
const EVENT = "hhi-compare-change";

/** Four columns is the most that stays readable on a phone in landscape. */
export const COMPARE_LIMIT = 4;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, COMPARE_LIMIT) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, COMPARE_LIMIT)));
  } catch {
    /* storage unavailable — the session still holds the selection */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** The comparison tray: up to four waters held side by side. */
export function useCompareTray() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    if (cur.includes(id)) write(cur.filter((x) => x !== id));
    else if (cur.length < COMPARE_LIMIT) write([...cur, id]);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((x) => x !== id));
  }, []);

  const set = useCallback((next: string[]) => write(next), []);
  const clear = useCallback(() => write([]), []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const full = ids.length >= COMPARE_LIMIT;

  const records: Destination[] = ids
    .map((id) => destinations.find((d) => d.id === id))
    .filter((d): d is Destination => Boolean(d));

  return { ids, records, has, toggle, remove, set, clear, full };
}