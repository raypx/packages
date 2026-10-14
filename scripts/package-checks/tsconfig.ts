import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  byText,
  rootManifest,
  run,
  runModules,
  type ConsumerContext,
  type PackageCheck,
} from "./shared.js";

/** Config packages publish JSON presets; a real compiler checks each exported file. */
async function checkTypeScriptPresets({
  archive,
  consumer,
  entries,
  packed,
}: ConsumerContext): Promise<void> {
  const presets = Object.keys(packed.exports).map((key) => key.slice(2, -".json".length));
  const probes = await readdir(join(consumer, "presets"));
  assert.deepEqual(
    [...presets].sort(byText),
    probes.map((file) => file.slice(0, -".ts".length)).sort(byText),
    `${packed.name}: every preset needs fixtures/tsconfig/presets/<preset>.ts`,
  );
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
  const tsc = join(consumer, "node_modules/typescript/bin/tsc");
  for (const preset of presets) {
    const specifier = `${packed.name}/${preset}.json`;
    const project = `tsconfig.${preset}.json`;
    const files = ["shape.ts", "strict.ts", `presets/${preset}.ts`];
    await writeFile(join(consumer, project), JSON.stringify({ extends: specifier, files }));
    run(process.execPath, ["--bun", tsc, "-p", project], consumer);
    const resolved = JSON.parse(
      run(process.execPath, ["--bun", tsc, "--showConfig", "-p", project], consumer),
    ).compilerOptions;
    for (const option of ["strict", "exactOptionalPropertyTypes", "verbatimModuleSyntax", "noEmit"])
      assert.equal(resolved[option], true, `${specifier}: ${option} must be inherited`);
  }
  await runModules(consumer);
  console.log(
    `${packed.name}@${packed.version}: tarball, TypeScript presets, Bun and Node resolution passed`,
  );
}

export const tsconfig: PackageCheck = { checkConsumer: checkTypeScriptPresets };
