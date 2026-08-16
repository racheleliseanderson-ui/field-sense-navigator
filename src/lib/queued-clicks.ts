/**
 * Captures clicks that land between first paint and React hydration.
 *
 * Server-rendered controls have no listeners attached until hydration
 * finishes, so a tap in that first moment is silently dropped. This module
 * registers a capture-phase listener as soon as the client bundle evaluates —
 * strictly earlier than hydration — records which control was pressed, and
 * reveals that control's queued notice so the reader gets feedback instantly.
 * The component drains the queue on mount and replays the intent.
 */
const queued = new Set<string>();

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const trigger = target?.closest?.("[data-queue-click]");
      const key = trigger?.getAttribute("data-queue-click");
      if (!key) return;
      queued.add(key);
      (trigger as HTMLElement).setAttribute("aria-busy", "true");
      document
        .querySelector(`[data-queue-notice="${CSS.escape(key)}"]`)
        ?.removeAttribute("hidden");
    },
    { capture: true },
  );
}

export function consumeQueuedClick(key: string) {
  if (!queued.has(key)) return false;
  queued.delete(key);
  return true;
}
