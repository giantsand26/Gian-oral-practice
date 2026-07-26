import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const localHost = process.env.GIAN_BIND_HOST ?? "127.0.0.1";
const localApiPort = process.env.GIAN_API_PORT ?? "8787";

export default defineConfig(() => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  return {
    server: {
      host: localHost,
      // The development server still binds to localhost by default. This lets
      // users reach it through their own Tailscale Serve hostname.
      allowedHosts: true as const,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${localApiPort}`,
          changeOrigin: false,
        },
      },
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
        },
      }),
    ],
  };
});
