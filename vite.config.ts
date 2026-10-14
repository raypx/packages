import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["docs/src/routeTree.gen.ts"] },
  lint: {
    ignorePatterns: [
      "packages/*/dist/**",
      "docs/content/**",
      "docs/.output/**",
      "docs/.source/**",
      "docs/src/routeTree.gen.ts",
      // Probes compile against packed archives in disposable consumers.
      "scripts/package-checks/fixtures/**",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
  },
});
