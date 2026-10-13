import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: { index: "src/index.ts", runtime: "src/runtime.ts" },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: { neverBundle: [/^zod(?:\/|$)/] },
  },
});
