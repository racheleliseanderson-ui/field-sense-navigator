import { createServerFn } from "@tanstack/react-start";
import type { StationIds } from "@/lib/live.server";

export const getLiveConditions = createServerFn({ method: "GET" })
  .inputValidator((input: StationIds) => ({
    usgsSiteId: input.usgsSiteId ? String(input.usgsSiteId).slice(0, 20) : null,
    noaaCoopsStationId: input.noaaCoopsStationId
      ? String(input.noaaCoopsStationId).slice(0, 20)
      : null,
    ndbcBuoyId: input.ndbcBuoyId ? String(input.ndbcBuoyId).slice(0, 20) : null,
    waterbody: String(input.waterbody ?? "").slice(0, 120),
    state: String(input.state ?? "").slice(0, 60),
  }))
  .handler(async ({ data }) => {
    const { readLive } = await import("@/lib/live.server");
    return await readLive(data);
  });
