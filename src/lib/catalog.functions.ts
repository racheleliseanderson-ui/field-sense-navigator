import { createServerFn } from "@tanstack/react-start";

/**
 * Ask the catalog replica to rank a text query.
 *
 * Returns null whenever the replica cannot answer, which the catalog treats as
 * "keep the results this device already computed". Nothing renders from this.
 */
export const matchCatalog = createServerFn({ method: "GET" })
  .validator((input: { q: string }) => ({ q: String(input.q ?? "").slice(0, 120) }))
  .handler(async ({ data }) => {
    const { matchIds } = await import("@/lib/catalog.server");
    return await matchIds(data.q);
  });
