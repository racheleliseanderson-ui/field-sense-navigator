import { createServerFn } from "@tanstack/react-start";

export const getLiveConditions = createServerFn({ method: "GET" })
  .validator((input: { id?: string; state: string; waterbody: string }) => ({
    ...(input.id ? { id: String(input.id).slice(0, 40) } : {}),
    state: String(input.state).slice(0, 60),
    waterbody: String(input.waterbody).slice(0, 160),
  }))
  .handler(async ({ data }) => {
    const { readLive } = await import("@/lib/live.server");
    return await readLive(data);
  });

export const getPipelinePulse = createServerFn({ method: "GET" }).handler(async () => {
  const { bindingsFile } = await import("@/lib/bindings");
  const { loadSnapshotMeta, loadStatusMeta, loadClosureMeta } = await import("@/lib/live.server");
  const snapshot = await loadSnapshotMeta();
  const status = await loadStatusMeta();
  const closures = await loadClosureMeta();
  const ingestedAt = status?.ingestedAt ?? snapshot?.ingestedAt ?? null;
  const ageMinutes =
    ingestedAt && !Number.isNaN(new Date(ingestedAt).getTime())
      ? Math.max(0, Math.round((Date.now() - new Date(ingestedAt).getTime()) / 60000))
      : null;
  const scannedAt = closures?.scannedAt ?? null;
  const scanAge =
    scannedAt && !Number.isNaN(new Date(scannedAt).getTime())
      ? Math.max(0, Math.round((Date.now() - new Date(scannedAt).getTime()) / 60000))
      : null;
  const usbr = status?.usbr ?? {
    bound: snapshot?.stats.byAgency?.["USBR"]?.bound ?? 0,
    withReadings: snapshot?.stats.byAgency?.["USBR"]?.withReadings ?? 0,
    timeouts: 0,
  };
  return {
    bindings: {
      generatedAt: bindingsFile.generatedAt,
      doctrine: bindingsFile.doctrine,
      ...bindingsFile.stats,
    },
    ingest: {
      ingestedAt,
      ageMinutes,
      cadenceMinutes: status?.cadenceMinutes ?? snapshot?.cadenceMinutes ?? 30,
      criticalCadenceMinutes: status?.criticalCadenceMinutes ?? 10,
      fullCadenceMinutes: status?.fullCadenceMinutes ?? 30,
      mode: status?.mode ?? snapshot?.mode ?? "all",
      boundStations: snapshot?.stats.boundStations ?? 0,
      withReadings: snapshot?.stats.withReadings ?? 0,
      withStaleOnly: snapshot?.stats.withStaleOnly ?? 0,
      emptyOrError: snapshot?.stats.emptyOrError ?? 0,
      byAgency: snapshot?.stats.byAgency ?? bindingsFile.stats.byAgency ?? {},
      nwsStations: snapshot?.stats.nwsStations ?? 0,
      nwsWithObs: snapshot?.stats.nwsWithObs ?? 0,
      stale: ageMinutes == null ? true : ageMinutes > 45,
      degraded: status?.degraded ?? false,
      errorCount: status?.errorCount ?? 0,
      hardErrorCount: status?.hardErrorCount ?? 0,
      usbr,
      archiveRetentionHours: status?.archiveRetentionHours ?? 24,
      errors: (status?.errors ?? []).slice(0, 8),
    },
    closures: {
      scannedAt,
      scanAgeMinutes: scanAge,
      stale: scanAge == null ? true : scanAge > 36 * 60,
      ...(closures?.stats ?? { scanned: 0, hit: 0, none: 0, unreachable: 0 }),
    },
  };
});
