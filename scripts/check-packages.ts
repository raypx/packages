import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertToolchainRuntime } from "./toolchain.js";

type Dependencies = Record<string, string>;

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  files?: string[];
  exports: Record<string, unknown>;
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
}

interface PlanEntry {
  kind: string;
  name: string;
  tarball: { path: string };
}

const root = fileURLToPath(new URL("../", import.meta.url));
const { nodeBinary: node } = assertToolchainRuntime(root);
const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Manifest;
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

function run(binary: string, args: string[], cwd: string): string {
  return execFileSync(binary, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function readArchived(archive: string, path: string): string {
  return execFileSync("tar", ["-xOf", archive, `package/${path}`], { encoding: "utf8" });
}

function exportTargets(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargets);
  return [];
}

/** Rules every public archive follows; package behavior belongs in unit tests. */
async function assertArchive(
  archive: string,
  manifest: Manifest,
  packageDirectory: string,
): Promise<Manifest> {
  const entries = new Set(run("tar", ["-tzf", archive], temporary).trim().split("\n"));
  const packed = JSON.parse(readArchived(archive, "package.json")) as Manifest;
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  for (const file of ["LICENSE", "README.md"])
    assert.ok(entries.has(`package/${file}`), `${packed.name}: missing ${file}`);
  for (const directory of ["node_modules", "third-party"])
    assert.ok(![...entries].some((entry) => entry.startsWith(`package/${directory}/`)));
  if (manifest.files?.includes("NOTICE.md")) {
    for (const file of ["NOTICE.md", "LICENSE"])
      assert.equal(
        readArchived(archive, file),
        await readFile(join(packageDirectory, file), "utf8"),
        `${packed.name}: incomplete ${file}`,
      );
  }
  for (const target of exportTargets(packed.exports))
    assert.ok(entries.has(`package/${target.slice(2)}`), `${packed.name}: missing ${target}`);
  // Releases pack with Bun, as here; npm would publish these protocols verbatim.
  for (const dependencies of [
    packed.dependencies,
    packed.devDependencies,
    packed.optionalDependencies,
    packed.peerDependencies,
  ]) {
    for (const [name, version] of Object.entries(dependencies ?? {}))
      assert.ok(
        !/^(?:workspace:|catalog:|file:|link:)/.test(version),
        `${packed.name}: local dependency ${name}`,
      );
  }
  return packed;
}

/** Installs the archive outside the workspace and loads every export with Bun and Node. */
async function checkConsumer(
  archive: string,
  packed: Manifest,
  consumer: string,
  packageDirectory: string,
): Promise<void> {
  // Optional public declaration contracts run against the installed archive,
  // independently of source paths and the workspace's ambient types.
  const fixture = join(packageDirectory, "fixtures/consumer");
  const fixtureManifest: Partial<Manifest> = existsSync(join(fixture, "package.json"))
    ? JSON.parse(await readFile(join(fixture, "package.json"), "utf8"))
    : {};
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "toolkit-artifact-consumer",
      private: true,
      type: "module",
      dependencies: {
        ...packed.peerDependencies,
        ...fixtureManifest.dependencies,
        [packed.name]: archive,
      },
      devDependencies: {
        typescript: rootManifest.devDependencies?.typescript,
        "@types/node": rootManifest.devDependencies?.["@types/node"],
        ...fixtureManifest.devDependencies,
      },
    }),
  );
  run(process.execPath, ["install", "--ignore-scripts"], consumer);

  const specifiers = Object.keys(packed.exports).map((key) => packed.name + key.slice(1));
  const modules = specifiers.filter((specifier) => !specifier.endsWith(".json"));
  // Configuration presets are JSON exports; they load with an import attribute.
  const imports = specifiers.map((specifier) =>
    specifier.endsWith(".json")
      ? `import ${JSON.stringify(specifier)} with { type: "json" };`
      : `import ${JSON.stringify(specifier)};`,
  );
  await writeFile(join(consumer, "exports.mjs"), imports.join("\n"));
  run(process.execPath, ["exports.mjs"], consumer);
  run(node, ["exports.mjs"], consumer);
  if (modules.length === 0) return;

  // Every JavaScript export must ship declarations a NodeNext consumer resolves.
  const reexports = modules.map(
    (specifier, index) => `export * as module${index} from ${JSON.stringify(specifier)};`,
  );
  await writeFile(join(consumer, "exports.ts"), reexports.join("\n"));
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        strict: true,
        noEmit: true,
        // Peer declarations, such as Drizzle's optional drivers, are not installed.
        skipLibCheck: true,
      },
      files: ["exports.ts"],
    }),
  );
  run(process.execPath, ["--bun", "./node_modules/typescript/bin/tsc"], consumer);
  if (existsSync(join(fixture, "tsconfig.json"))) {
    await cp(fixture, join(consumer, "contract"), { recursive: true });
    run(
      process.execPath,
      ["--bun", "./node_modules/typescript/bin/tsc", "--project", "contract/tsconfig.json"],
      consumer,
    );
  }
}

try {
  let checked = 0;
  for (const directory of await readdir(join(root, "packages"), { withFileTypes: true })) {
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
    const packed = await assertArchive(archive, manifest, packageDirectory);
    await checkConsumer(archive, packed, join(temporary, directory.name), packageDirectory);
    console.log(`${packed.name}@${packed.version}: tarball, Bun and Node consumers passed`);
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
