import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

// Bundlers and declaration builders resolve presets through Node package exports.
for (const probe of await readdir(new URL("presets/", import.meta.url))) {
  const preset = probe.replace(/\.ts$/, ".json");
  const specifier = `@voidmix/tsconfig/${preset}`;
  assert.ok(import.meta.resolve(specifier).endsWith(`/${preset}`));
  const { default: config } = await import(specifier, { with: { type: "json" } });
  assert.equal(typeof config.compilerOptions, "object");
}
