import { createServerFn } from "@tanstack/react-start";

export const getLiveConditions = createServerFn({ method: "GET" })
  .inputValidator((input: { state: string; waterbody: string }) => ({
    state: String(input.state).slice(0, 60),
    waterbody: String(input.waterbody).slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const { readLive } = await import("@/lib/live.server");
    return await readLive(data.state, data.waterbody);
  });
