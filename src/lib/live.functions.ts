import { createServerFn } from "@tanstack/react-start";

export const getLiveConditions = createServerFn({ method: "GET" })
  .inputValidator((input: { id?: string; state: string; waterbody: string }) => ({
    id: input.id ? String(input.id).slice(0, 40) : undefined,
    state: String(input.state).slice(0, 60),
    waterbody: String(input.waterbody).slice(0, 160),
  }))
  .handler(async ({ data }) => {
    const { readLive } = await import("@/lib/live.server");
    return await readLive(data);
  });

export const getPipelinePulse = createServerFn({ method: "GET" }).handler(async () => {
  const { bindingsFile } = await import("@/lib/bindings");
  const { loadSnapshotMeta } = await import("@/lib/live.server");
  const snapshot = await loadSnapshotMeta();
  const ingestedAt = snapshot?.ingestedAt ?? null;
  const ageMinutes =
    ingestedAt && !Number.isNaN(new Date(ingestedAt).getTime())
      ? Math.max(0, Math.round((Date.now() - new Date(ingestedAt).getTime()) / 60000))
      : null;
  return {
    bindings: {
      generatedAt: bindingsFile.generatedAt,
      doctrine: bindingsFile.doctrine,
      ...bindingsFile.stats,
    },
    ingest: {
      ingestedAt,
      ageMinutes,
      cadenceMinutes: snapshot?.cadenceMinutes ?? 30,
      boundStations: snapshot?.stats.boundStations ?? 0,
      withReadings: snapshot?.stats.withReadings ?? 0,
      emptyOrError: snapshot?.stats.emptyOrError ?? 0,
      stale: ageMinutes == null ? true : ageMinutes > 45,
    },
  };
});
