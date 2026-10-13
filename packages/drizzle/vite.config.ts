import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      index: "src/index.ts",
      postgres: "src/postgres.ts",
      errors: "src/errors.ts",
      results: "src/results.ts",
      diagnostics: "src/diagnostics.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: { neverBundle: [/^drizzle-orm(?:\/|$)/, /^postgres(?:\/|$)/] },
  },
});
