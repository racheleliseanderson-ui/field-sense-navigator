import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { Destination } from "@/lib/catalog";
import { getLiveConditions } from "@/lib/live.functions";
import {
  NO_TEMPERATURE,
  TARGET_URL,
  buildHandoffSteps,
  handoffUrl,
  temperatureFrom,
  type HandoffContext,
  type HandoffStep,
  type HandoffTarget,
  type LiveConditionsLike,
  type PacketTemperature,
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

/**
 * The official temperature for one water, ready to attach to a packet.
 *
 * This shares the `["live", id]` query key with the live-conditions panel, so
 * on a page that already shows conditions it costs no extra request. It is
 * opt-in (`enabled`) because list pages render many handoff links at once and
 * must not fan out one live pull per card.
 *
 * A failed or empty lookup returns NO_TEMPERATURE — the packet then says
 * "unknown", which is the truthful answer. It never falls back to an estimate.
 */
export function useHandoffTemperature(d: Destination, enabled = true): PacketTemperature {
  const call = useServerFn(getLiveConditions);
  const { data } = useQuery({
    queryKey: ["live", d.id],
    queryFn: () => call({ data: { id: d.id, state: d.state, waterbody: d.waterbody } }),
    enabled,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  return useMemo(
    () => (data ? temperatureFrom(data as unknown as LiveConditionsLike) : NO_TEMPERATURE),
    [data],
  );
}

export function useHandoffUrl(
  d: Destination,
  target: HandoffTarget,
  ctx: HandoffContext = {},
): string {
  const mounted = useMounted();
  const { job, species, level, temperature } = ctx;
  return useMemo(
    () =>
      mounted
        ? handoffUrl(d, target, {
            job: job ?? null,
            species: species ?? null,
            ...(level ? { level } : {}),
            ...(temperature ? { temperature } : {}),
          })
        : TARGET_URL[target],
    [mounted, d, target, job, species, level, temperature],
  );
}

export function useHandoffSteps(d: Destination, ctx: HandoffContext = {}): HandoffStep[] {
  const mounted = useMounted();
  const { job, species, level, temperature } = ctx;
  return useMemo(() => {
    const steps = buildHandoffSteps(d, {
      job: job ?? null,
      species: species ?? null,
      ...(level ? { level } : {}),
      ...(temperature ? { temperature } : {}),
    });
    if (mounted) return steps;
    return steps.map((s) => ({ ...s, url: TARGET_URL[s.id] }));
  }, [mounted, d, job, species, level, temperature]);
}
