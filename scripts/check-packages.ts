import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { packageChecks } from "./package-checks/index.js";
import {
  node,
  readArchived,
  root,
  rootManifest,
  run,
  type ArchiveContext,
  type Manifest,
} from "./package-checks/shared.js";

interface PlanEntry {
  kind: string;
  name: string;
  tarball: { path: string };
}

const temporary = await mkdtemp(join(tmpdir(), "voidmix-pack-"));
// Release packing checks the exact archives it will publish instead of packing again.
const releasePlan = process.env.TOOLKIT_RELEASE_PLAN;
const releaseArchives = releasePlan
  ? new Map(
      (JSON.parse(await readFile(releasePlan, "utf8")) as { plan: PlanEntry[][] }).plan
        .flat()
        .filter((entry) => entry.kind === "publish")
        .map((entry) => [entry.name, resolve(dirname(releasePlan), entry.tarball.path)]),
    )
  : undefined;

function exportTargets(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargets);
  return [];
}

/** Rules every public archive follows, whatever its package-specific checks. */
async function assertSharedArchiveRules({
  archive,
  entries,
  manifest,
  packed,
  packageDirectory,
}: ArchiveContext): Promise<void> {
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.ok(entries.has("package/LICENSE"), `${packed.name}: missing LICENSE`);
  assert.ok(entries.has("package/README.md"), `${packed.name}: missing README.md`);
  assert.ok(![...entries].some((entry) => entry.startsWith("package/node_modules/")));
  assert.ok(![...entries].some((entry) => entry.startsWith("package/third-party/")));
  if (manifest.files?.includes("NOTICE.md")) {
    for (const filename of ["NOTICE.md", "LICENSE"]) {
      assert.ok(entries.has(`package/${filename}`), `${packed.name}: missing ${filename}`);
      assert.equal(
        readArchived(archive, filename),
        await readFile(join(packageDirectory, filename), "utf8"),
        `${packed.name}: incomplete ${filename}`,
      );
    }
  }
  // Releases pack with Bun, as here; npm would publish these protocols verbatim.
  for (const dependencies of [
    packed.dependencies,
    packed.devDependencies,
    packed.optionalDependencies,
    packed.peerDependencies,
  ]) {
    for (const [name, version] of Object.entries(dependencies || {})) {
      assert.ok(
        !/^(?:workspace:|catalog:|file:|link:)/.test(version),
        `${packed.name}: local dependency ${name}`,
      );
    }
  }
}

try {
  // Require the second runtime before doing network work. This checks a real
  // consumer rather than loading source files or workspace aliases.
  run(node, ["--version"], temporary);
  const directories = await readdir(join(root, "packages"), { withFileTypes: true });
  let checked = 0;
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const packageDirectory = join(root, "packages", directory.name);
    const manifest = JSON.parse(
      await readFile(join(packageDirectory, "package.json"), "utf8"),
    ) as Manifest;
    if (manifest.private) continue;
    if (releaseArchives && !releaseArchives.has(manifest.name)) continue;
    const archive = releaseArchives?.get(manifest.name) ?? join(temporary, `${directory.name}.tgz`);
    if (!releaseArchives)
      run(
        process.execPath,
        ["pm", "pack", "--ignore-scripts", "--filename", archive],
        packageDirectory,
      );
    const entries = new Set(run("tar", ["-tzf", archive], temporary).trim().split("\n"));
    const packed = JSON.parse(readArchived(archive, "package.json")) as Manifest;
    const check = packageChecks[packed.name];
    assert.ok(check, `${packed.name}: register its checks in scripts/package-checks/index.ts`);
    const context: ArchiveContext = { archive, entries, manifest, packed, packageDirectory };
    await assertSharedArchiveRules(context);
    await check.assertArchive?.(context);

    const consumer = join(temporary, directory.name);
    if (check.checkConsumer) {
      await check.checkConsumer({ ...context, consumer });
      checked += 1;
      continue;
    }
    for (const target of exportTargets(packed.exports)) {
      assert.ok(target.startsWith("./dist/"), `${packed.name}: export must point to build output`);
      assert.ok(
        entries.has(`package/${target.slice(2)}`),
        `${packed.name}: missing export ${target}`,
      );
    }

    await mkdir(consumer);
    // A peer can be explicitly optional. Install it for the export smoke check
    // so all advertised subpaths are exercised, independent of workspace deps.
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify(
        {
          name: "toolkit-artifact-consumer",
          private: true,
          type: "module",
          dependencies: {
            [packed.name]: archive,
            ...packed.peerDependencies,
            ...check.consumerDependencies?.(context),
          },
          devDependencies: {
            typescript: rootManifest.devDependencies.typescript,
            "@types/node": rootManifest.devDependencies["@types/node"],
            ...check.consumerDevDependencies?.(context),
          },
        },
        null,
        2,
      ),
    );
    run(process.execPath, ["install", "--ignore-scripts"], consumer);
    const specifiers = Object.keys(packed.exports).map((key) =>
      key === "." ? packed.name : `${packed.name}${key.slice(1)}`,
    );
    const imports = specifiers
      .map(
        (specifier, index) =>
          `import * as module${index} from ${JSON.stringify(specifier)};\nvoid module${index};`,
      )
      .join("\n");
    await writeFile(
      join(consumer, "consumer.ts"),
      `${imports}\n${check.typeProbe ?? ""}\nexport {};\n`,
    );
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            noEmit: true,
            // Drizzle's shared declarations reference optional drivers for all
            // dialects. Check consumer API inference without installing them.
            skipLibCheck: true,
          },
          files: ["consumer.ts"],
        },
        null,
        2,
      ),
    );
    run(
      process.execPath,
      ["--bun", "./node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
      consumer,
    );
    await writeFile(
      join(consumer, "consumer.mjs"),
      `${imports}\n${check.runtimeProbe ?? ""}\nconsole.log(${JSON.stringify(`${packed.name}@${packed.version}: exports loaded and runtime behavior passed`)});\n`,
    );
    run(process.execPath, ["consumer.mjs"], consumer);
    run(node, ["consumer.mjs"], consumer);
    await check.afterRuntime?.({ ...context, consumer });
    console.log(
      `${packed.name}@${packed.version}: tarball, declarations, Bun and Node consumers passed`,
    );
    checked += 1;
  }
  if (releaseArchives)
    assert.equal(checked, releaseArchives.size, "Every release archive is checked.");
  else assert.ok(checked > 0, "No public packages were checked.");
} finally {
  if (process.env.TOOLKIT_KEEP_PACK_CHECK === "1") {
    console.log(`Package check files retained at ${temporary}`);
  } else {
    // This path is exclusively created by mkdtemp above, never user-provided.
    await rm(resolve(temporary), { recursive: true, force: true });
  }
}
