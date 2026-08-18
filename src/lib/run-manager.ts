import { useCallback, useMemo, useRef, useState } from "react";

import type { ProbeResult } from "@/lib/pipeline";

export type RunState = "idle" | "running" | "paused" | "stopped" | "complete";

export interface RunRecord {
  id: string;
  scope: string;
  startedAt: number;
  durationMs: number;
  planned: number;
  probed: number;
  matched: number;
  unmatched: number;
  errors: number;
  outcome: Exclude<RunState, "idle" | "running" | "paused">;
}

export interface RunTarget {
  id: string;
  name: string;
  state: string;
  waterbody: string;
  /** Official agency page cited by the record, used by source verification runs. */
  sourceUrl?: string;
}

export type Probe = (target: RunTarget) => Promise<ProbeResult>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Bounded worker pool with pause/resume/stop. Nothing is inferred about a target
 * that was never reached: it is simply reported as unreached.
 */
export function useRunManager(probe: Probe) {
  const [state, setState] = useState<RunState>("idle");
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [planned, setPlanned] = useState(0);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const paused = useRef(false);
  const stopped = useRef(false);

  const pause = useCallback(() => {
    paused.current = true;
    setState((s) => (s === "running" ? "paused" : s));
  }, []);

  const resume = useCallback(() => {
    paused.current = false;
    setState((s) => (s === "paused" ? "running" : s));
  }, []);

  const stop = useCallback(() => {
    stopped.current = true;
    paused.current = false;
  }, []);

  const start = useCallback(
    async (targets: RunTarget[], opts: { concurrency: number; scope: string; append?: boolean }) => {
      if (targets.length === 0) return;
      stopped.current = false;
      paused.current = false;
      setState("running");
      if (!opts.append) setResults([]);
      setPlanned(targets.length);

      const startedAt = Date.now();
      const collected: ProbeResult[] = [];
      let cursor = 0;

      const worker = async () => {
        for (;;) {
          while (paused.current && !stopped.current) await wait(120);
          if (stopped.current) return;
          const i = cursor++;
          const target = targets[i];
          if (!target) return;
          const row = await probe(target);
          collected.push(row);
          setResults((prev) => [...prev, row]);
        }
      };

      await Promise.all(
        Array.from({ length: Math.max(1, Math.min(opts.concurrency, targets.length)) }, worker),
      );

      const outcome: RunRecord["outcome"] = stopped.current ? "stopped" : "complete";
      setState(outcome);
      setHistory((prev) =>
        [
          {
            id: `${startedAt}`,
            scope: opts.scope,
            startedAt,
            durationMs: Date.now() - startedAt,
            planned: targets.length,
            probed: collected.length,
            matched: collected.filter((r) => r.status === "matched").length,
            unmatched: collected.filter((r) => r.status === "unmatched").length,
            errors: collected.filter((r) => r.status === "error").length,
            outcome,
          },
          ...prev,
        ].slice(0, 5),
      );
    },
    [probe],
  );

  const reset = useCallback(() => {
    setResults([]);
    setPlanned(0);
    setState("idle");
  }, []);

  const counts = useMemo(
    () => ({
      probed: results.length,
      matched: results.filter((r) => r.status === "matched").length,
      unmatched: results.filter((r) => r.status === "unmatched").length,
      errors: results.filter((r) => r.status === "error").length,
      unreached: Math.max(0, planned - results.length),
    }),
    [results, planned],
  );

  return { state, results, planned, counts, history, start, pause, resume, stop, reset };
}

/** Client-side CSV of a run ledger. No server round trip, no reformatting of values. */
export function runToCsv(results: ProbeResult[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["name", "state", "status", "station", "readings", "note"].join(",");
  const body = results.map((r) =>
    [r.name, r.state, r.status, r.station, r.readings, r.note].map(esc).join(","),
  );
  return [head, ...body].join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
