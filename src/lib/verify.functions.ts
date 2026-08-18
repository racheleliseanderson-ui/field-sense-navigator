import { createServerFn } from "@tanstack/react-start";

export const checkSourceUrl = createServerFn({ method: "GET" })
  .inputValidator((input: { url: string }) => ({
    url: String(input.url).slice(0, 500),
  }))
  .handler(async ({ data }) => {
    const { verifySource } = await import("@/lib/verify.server");
    return await verifySource(data.url);
  });
