import { useEffect, useMemo, useState } from "react";

import type { Destination } from "@/lib/catalog";
import {
  TARGET_URL,
  buildHandoffSteps,
  handoffUrl,
  type HandoffContext,
  type HandoffStep,
  type HandoffTarget,
} from "@/lib/handoff";

/**
 * A handoff packet is stamped with the moment it was built, so a URL rendered
 * on the server can never match the one the client would render — React
 * reports that as a hydration mismatch and refuses to patch the attribute.
 *
 * These hooks render the plain instrument URL until the component has mounted,
 * then swap in the packet URL. Server and first client render agree, the link
 * is a real link the whole time, and a visitor without JavaScript still lands
 * on the right instrument — just without the context attached.
 */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useHandoffUrl(
  d: Destination,
  target: HandoffTarget,
  ctx: HandoffContext = {},
): string {
  const mounted = useMounted();
  const { job, species, level } = ctx;
  return useMemo(
    () =>
      mounted
        ? handoffUrl(d, target, { job: job ?? null, species: species ?? null, ...(level ? { level } : {}) })
        : TARGET_URL[target],
    [mounted, d, target, job, species, level],
  );
}

export function useHandoffSteps(
  d: Destination,
  ctx: HandoffContext = {},
): HandoffStep[] {
  const mounted = useMounted();
  const { job, species, level } = ctx;
  return useMemo(() => {
    const steps = buildHandoffSteps(d, {
      job: job ?? null,
      species: species ?? null,
      ...(level ? { level } : {}),
    });
    if (mounted) return steps;
    return steps.map((s) => ({ ...s, url: TARGET_URL[s.id] }));
  }, [mounted, d, job, species, level]);
}
