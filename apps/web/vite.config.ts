import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const httpsPfxPath = resolve(process.cwd(), env.VITE_DEV_PFX_PATH ?? "../../certs/localhost-dev.pfx");
  const httpsPassphrase = env.VITE_DEV_PFX_PASSPHRASE ?? "zmp-local-dev";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      https: existsSync(httpsPfxPath)
        ? {
            pfx: readFileSync(httpsPfxPath),
            passphrase: httpsPassphrase,
          }
        : undefined,
    },
  };
});
