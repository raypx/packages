import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      index: "src/index.ts",
      client: "src/client.ts",
      server: "src/server.ts",
      "types-entry": "src/types-entry.ts",
      testing: "src/testing.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      neverBundle: [/^react(?:\/|$)/, /^use-intl(?:\/|$)/, /^@formatjs\//],
    },
  },
});
