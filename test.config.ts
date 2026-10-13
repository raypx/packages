import { defineConfig } from "vite-plus/test/config";

/** Library tests have no Raypx application plugins or runtime preloads. */
export function workspaceTests() {
  return defineConfig({
    test: {
      environment: "node",
      maxWorkers: 2,
      execArgv: ["--no-env-file", "--no-install"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: { reporter: ["text", "json", "lcov"] },
    },
  });
}
