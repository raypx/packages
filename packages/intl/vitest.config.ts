import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus/test/config";

import { workspaceTests } from "../../test.config.js";

const shared = workspaceTests();

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    // Project discovery is explicit; do not merge the root's broad pattern into both environments.
    include: [],
    projects: [
      {
        test: {
          name: "core",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/client/**"],
          execArgv: ["--no-env-file", "--no-install"],
        },
      },
      {
        test: {
          name: "client",
          environment: "jsdom",
          include: ["src/client/**/*.{test,spec}.{ts,tsx}"],
          execArgv: [
            "--no-env-file",
            "--no-install",
            "--preload",
            fileURLToPath(new URL("../../scripts/testing/jsdom-preload.ts", import.meta.url)),
          ],
        },
      },
    ],
  },
});
