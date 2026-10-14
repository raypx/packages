import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  byText,
  node,
  rootManifest,
  run,
  type ConsumerContext,
  type PackageCheck,
} from "./shared.js";

const presetProbes: Record<string, string> = {
  base: "",
  node: `
const platform: string = process.platform;
void platform;
// @ts-expect-error Node-compatible presets declare no DOM libraries.
document.title;
`,
  browser: `
const title: string = document.title;
void title;
// @ts-expect-error Browser presets declare no Node ambient types.
process.platform;
`,
  library: `
// @ts-expect-error Library presets declare no DOM libraries.
document.title;
// @ts-expect-error Library presets declare no Node ambient types.
process.platform;
`,
  "react-library": `
const title: string = document.title;
void title;
`,
};

/** Config packages publish JSON presets; a real compiler checks each exported file. */
async function checkTypeScriptPresets({
  archive,
  consumer,
  entries,
  packed,
}: ConsumerContext): Promise<void> {
  const presets = Object.keys(packed.exports).map((key) => key.slice(2, -".json".length));
  assert.deepEqual([...presets].sort(byText), Object.keys(presetProbes).sort(byText));
  for (const [key, target] of Object.entries(packed.exports)) {
    assert.match(key, /^\.\/[a-z-]+\.json$/, `${packed.name}: presets are package-root JSON`);
    assert.equal(target, key, `${packed.name}: ${key} must export its own file`);
  }
  assert.deepEqual(
    [...entries].sort(byText),
    [
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      "package.json",
      ...presets.map((name) => `${name}.json`),
    ]
      .map((file) => `package/${file}`)
      .sort(byText),
    `${packed.name}: archive must contain only presets and package documents`,
  );
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"])
    assert.ok(!Object.hasOwn(packed, field), `${packed.name}: presets have no ${field}`);

  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify(
      {
        name: "toolkit-preset-consumer",
        private: true,
        type: "module",
        devDependencies: {
          [packed.name]: archive,
          typescript: rootManifest.devDependencies.typescript,
          "@types/node": rootManifest.devDependencies["@types/node"],
        },
      },
      null,
      2,
    ),
  );
  run(process.execPath, ["install", "--ignore-scripts"], consumer);
  await writeFile(join(consumer, "shape.ts"), "export interface Shape {\n  value: string;\n}\n");
  const strictProbe = `
// @ts-expect-error verbatimModuleSyntax requires type-only imports to use import type.
import { Shape } from "./shape.js";
const shape: Shape = { value: "preset" };
void shape;
const values: string[] = [];
// @ts-expect-error noUncheckedIndexedAccess includes undefined in indexed reads.
const first: string = values[0];
void first;
interface Options {
  limit?: number;
}
// @ts-expect-error exactOptionalPropertyTypes rejects explicitly undefined optional keys.
const options: Options = { limit: undefined };
void options;
class Base {
  run(): void {}
}
export class Derived extends Base {
  // @ts-expect-error noImplicitOverride requires the override modifier.
  run(): void {}
}
try {
  void shape;
} catch (error) {
  // @ts-expect-error useUnknownInCatchVariables types catch variables as unknown.
  error.message;
}
`;
  const tsc = join(consumer, "node_modules/typescript/bin/tsc");
  for (const preset of presets) {
    const specifier = `${packed.name}/${preset}.json`;
    await writeFile(join(consumer, `${preset}.ts`), `${strictProbe}${presetProbes[preset] ?? ""}`);
    await writeFile(
      join(consumer, `tsconfig.${preset}.json`),
      JSON.stringify({ extends: specifier, files: [`${preset}.ts`, "shape.ts"] }, null, 2),
    );
    run(process.execPath, ["--bun", tsc, "-p", `tsconfig.${preset}.json`], consumer);
    const resolved = JSON.parse(
      run(
        process.execPath,
        ["--bun", tsc, "--showConfig", "-p", `tsconfig.${preset}.json`],
        consumer,
      ),
    ).compilerOptions;
    for (const option of ["strict", "exactOptionalPropertyTypes", "verbatimModuleSyntax", "noEmit"])
      assert.equal(resolved[option], true, `${specifier}: ${option} must be inherited`);
  }

  // Bundlers and declaration builders resolve presets through Node package exports.
  await writeFile(
    join(consumer, "consumer.mjs"),
    `
import assert from "node:assert/strict";
for (const preset of ${JSON.stringify(presets)}) {
  const specifier = ${JSON.stringify(packed.name)} + "/" + preset + ".json";
  assert.ok(import.meta.resolve(specifier).endsWith("/" + preset + ".json"));
  const { default: config } = await import(specifier, { with: { type: "json" } });
  assert.equal(typeof config.compilerOptions, "object");
}
`,
  );
  run(process.execPath, ["consumer.mjs"], consumer);
  run(node, ["consumer.mjs"], consumer);
  console.log(
    `${packed.name}@${packed.version}: tarball, TypeScript presets, Bun and Node resolution passed`,
  );
}

export const tsconfig: PackageCheck = { checkConsumer: checkTypeScriptPresets };
