import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { byText, runModules, type PackageCheck } from "./shared.js";

export const env: PackageCheck = {
  assertArchive({ manifest, packed }) {
    assert.equal(packed.peerDependencies?.zod, manifest.devDependencies?.zod);
    assert.notEqual(packed.peerDependenciesMeta?.zod?.optional, true);
    assert.ok(!Object.hasOwn(packed.dependencies || {}, "zod"));
    assert.deepEqual(Object.keys(packed.exports).sort(byText), [".", "./runtime"]);
  },
  async afterRuntime({ consumer, packed }) {
    // Vite inlines only VITE_-prefixed values; SECRET must stay out of the bundle.
    // The repository ignores .env.* files, so the mode file is written here.
    const browser = join(consumer, "browser");
    await writeFile(
      join(browser, ".env.test"),
      "VITE_API_URL=https://api.example.test\nVITE_APP_NAME=artifact-client\nSECRET=private-browser-placeholder\n",
    );
    const { build } = await import("vite-plus");
    await build({
      configFile: false,
      root: browser,
      mode: "test",
      logLevel: "silent",
      build: {
        outDir: "dist",
        target: "es2022",
        minify: false,
        rolldownOptions: {
          input: join(browser, "browser.ts"),
          preserveEntrySignatures: "strict",
          output: { entryFileNames: "browser.mjs" },
        },
      },
    });
    assert.ok(
      !(await readFile(join(browser, "dist/browser.mjs"), "utf8")).includes(
        "private-browser-placeholder",
      ),
      "@voidmix/env: Vite must not expose unprefixed environment values",
    );
    await runModules(browser);
    console.log(`${packed.name}@${packed.version}: Vite browser environment passed`);
  },
};
