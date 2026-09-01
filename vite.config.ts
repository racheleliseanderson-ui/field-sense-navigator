// Build config for this app. The plugin assembly lives in ./vite.base.config.ts;
// this file only carries the options that are specific to this project.
import { defineConfig } from "./vite.base.config.ts";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  // Production is Vercel-only (AGENTS.project.md). Pin the preset so a build
  // outside Vercel's own CI never silently emits a Cloudflare worker.
  nitro: { preset: "vercel" },
});
