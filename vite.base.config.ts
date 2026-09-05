/**
 * Vite base config for this TanStack Start app.
 *
 * This repository owns its build. It assembles the full plugin set and the
 * resolved options for local development and for production builds — Tailwind,
 * TanStack Start (with server-only import protection),
 * Nitro on build, React Fast Refresh, `VITE_*` env inlining, build identity
 * stamping, the `@` -> `src` alias and React/TanStack deduping — with no
 * third-party build service, sandbox hooks, telemetry or devtools source
 * injection in the pipeline.
 *
 * Keep this file boring. It is deliberately a thin, readable assembly so the
 * build stays inspectable and owned by this repository.
 */
import { fileURLToPath } from "node:url";
import { loadEnv, mergeConfig, type ConfigEnv, type PluginOption, type UserConfig } from "vite";

export interface AppViteConfigOptions {
  /** Extra Vite config, merged over the base (wins on conflict). */
  vite?: UserConfig;
  /** Options forwarded to the TanStack Start plugin. */
  tanstackStart?: Record<string, unknown>;
  /** Options forwarded to `@vitejs/plugin-react`. */
  react?: Record<string, unknown>;
  /** `false` disables the Nitro build plugin; an object configures it. */
  nitro?: false | Record<string, unknown>;
  /** `false` skips inlining `VITE_*` vars into `import.meta.env`. */
  envDefine?: false;
  /** `false` skips the `__BUILD_*` identity constants. */
  buildStamp?: false;
  /** Extra plugins, appended after the base set. */
  plugins?: PluginOption[];
}

const SRC_DIR = fileURLToPath(new URL("./src", import.meta.url));

/**
 * Build identity.
 *
 * A deployed application that cannot say which commit it is has to be
 * diagnosed by guesswork: a reader reports something the code no longer does,
 * and there is no way to tell whether they are on the current build, a cached
 * shell from three deploys ago, or a preview. These constants are inlined at
 * build time and surfaced by `src/lib/build-info.ts` and `/api/version`.
 *
 * The sha comes from `scripts/build-id.mjs`, which `scripts/stamp-sw.mjs`
 * also reads — the service worker's cache key and the version endpoint have to
 * agree about which build this is, and they run in different processes.
 *
 * FLEET PATTERN. Same constant names in every Hook app that has this file.
 */
async function buildIdentity(): Promise<Record<string, string>> {
  const { buildSha, buildRef, buildEnv } = await import("./scripts/build-id.mjs");
  return {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_REF__: JSON.stringify(buildRef()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_ENV__: JSON.stringify(buildEnv()),
  };
}

/** React/TanStack singletons that must not be duplicated across the graph. */
const DEDUPE = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@tanstack/react-query",
  "@tanstack/query-core",
];

export function defineConfig(options: AppViteConfigOptions = {}) {
  return async ({ command, mode }: ConfigEnv): Promise<UserConfig> => {
    const plugins: PluginOption[] = [];

    const tailwindcss = (await import("@tailwindcss/vite")).default;
    plugins.push(tailwindcss());

    const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");
    plugins.push(
      tanstackStart(
        mergeConfig(
          {
            // Server-only modules must never be reachable from a client bundle.
            importProtection: {
              behavior: "error",
              client: { files: ["**/server/**"], specifiers: ["server-only"] },
            },
          },
          options.tanstackStart ?? {},
        ) as Parameters<typeof tanstackStart>[0],
      ),
    );

    if (command === "build" && options.nitro !== false) {
      const { nitro } = await import("nitro/vite");
      const userNitro = typeof options.nitro === "object" && options.nitro ? options.nitro : {};
      plugins.push(
        // Production is Vercel. `defaultPreset` is only the fallback for a build
        // run outside a host that advertises itself -- a local `npm run build`,
        // say -- so it points at the real target instead of a worker for a
        // platform this app is never deployed to. A host's own detection
        // (Vercel, Netlify, Cloudflare) still wins over it.
        nitro({ defaultPreset: "vercel", ...userNitro }) as PluginOption,
      );
    }

    const react = (await import("@vitejs/plugin-react")).default;
    plugins.push(react(options.react as Parameters<typeof react>[0]));

    const define: Record<string, string> = {};
    if (options.buildStamp !== false) Object.assign(define, await buildIdentity());
    if (options.envDefine !== false) {
      for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
        define[`import.meta.env.${key}`] = JSON.stringify(value);
      }
    }

    const base: UserConfig = {
      define,
      css: { transformer: "lightningcss" },
      // Vite resolves tsconfig `paths` natively; the explicit alias stays as the
      // belt-and-braces mapping the app has always relied on.
      resolve: { alias: { "@": SRC_DIR }, dedupe: DEDUPE, tsconfigPaths: true },
      optimizeDeps: {
        include: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
        ],
        ignoreOutdatedRequests: true,
      },
      server: {
        host: "::",
        port: 8080,
        // Debounce the watcher so a file still being written (sync clients,
        // editors that save in two passes) does not trigger a partial reload.
        watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
      },
      plugins: [...plugins, ...(options.plugins ?? [])],
    };

    return options.vite ? mergeConfig(base, options.vite) : base;
  };
}
