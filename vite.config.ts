import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["docs/src/routeTree.gen.ts"] },
  lint: {
    ignorePatterns: [
      "packages/*/dist/**",
      // Public consumer contracts resolve installed tarballs, not workspace source.
      // check-packages.ts type-checks these in their isolated dependency environment.
      "packages/*/fixtures/consumer/**",
      "docs/content/**",
      "docs/.output/**",
      "docs/.source/**",
      "docs/src/routeTree.gen.ts",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
  },
});
