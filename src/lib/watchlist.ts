import { useCallback, useEffect, useState } from "react";
import { destinations, type Destination } from "@/lib/catalog";

const KEY = "hhi-watchlist";
const EVENT = "hhi-watchlist-change";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — the session still holds the list */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Watchlist ids, kept in step across every mounted component. */
export function useWatchlist() {
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
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);

  const clear = useCallback(() => write([]), []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const records: Destination[] = ids
    .map((id) => destinations.find((d) => d.id === id))
    .filter((d): d is Destination => Boolean(d));

  return { ids, records, has, toggle, clear };
}
