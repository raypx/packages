import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    tsconfig: "tsconfig.build.json",
    entry: {
      index: "src/index.ts",
      client: "src/client.ts",
      browser: "src/browser.ts",
      server: "src/server.ts",
      "types-entry": "src/types-entry.ts",
      testing: "src/testing.ts",
    },
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      // React stays a peer so the application owns the only renderer and context.
      neverBundle: [/^react(?:\/|$)/],
      // Inlined third-party code.
      onlyBundle: [
        "use-intl",
        "intl-messageformat",
        "@formatjs/icu-messageformat-parser",
        "@formatjs/icu-skeleton-parser",
        "@formatjs/fast-memoize",
        "@schummar/icu-type-parser",
      ],
    },
  },
});
