import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** One entry of Changesets' publish plan; packing adds the tarball. */
interface PlanEntry {
  kind: string;
  name: string;
  version: string;
  tag: string;
  tarball?: { path: string; integrity: string };
}

interface PlanDocument {
  version: number;
  plan: PlanEntry[][];
}

type Dependencies = Record<string, string>;

interface Manifest {
  name: string;
  version: string;
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
}

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const root = fileURLToPath(new URL("../", import.meta.url));
// Earlier archives stay beside this directory; only this release output is replaced.
const packDirectory = join(root, ".changeset/pack/release");
const planFile = join(packDirectory, "publish-plan.json");
const releaseFile = join(packDirectory, "release.json");
const changesets = join(root, "node_modules/@changesets/cli/bin.js");
// npm is only the registry transport; it otherwise rejects the strict Bun devEngines pin.
// Keep the inherited environment intact: in CI, changesets/action passes CHANGESETS_OUTPUT,
// where `changeset publish` records the tags the action pushes as GitHub releases.
const npmEnvironment = { ...process.env, NPM_CONFIG_FORCE: "true" };
const localProtocol = /^(?:workspace:|catalog:|file:|link:)/;

function readJson<T>(path: string): Promise<T> {
  return readFile(path, "utf8").then((content) => JSON.parse(content) as T);
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function run(args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function changeset(args: string[]): void {
  run(["--bun", changesets, ...args], npmEnvironment);
}

/** Pre mode selects the dist-tag; leaving it requires an explicit stable release. */
async function expectedTag(stable: boolean): Promise<string> {
  const preFile = join(root, ".changeset/pre.json");
  if (!existsSync(preFile)) {
    assert.ok(stable, "Pre mode was exited. Pass --stable only for an approved stable release.");
    return "latest";
  }
  assert.ok(!stable, "--stable requires exiting pre mode first.");
  const pre = await readJson<{ mode: string; tag: string }>(preFile);
  assert.equal(pre.mode, "pre", ".changeset/pre.json must record pre mode.");
  return pre.tag;
}

/**
 * Changesets keeps `latest` on a package's newest prerelease until it has a stable
 * release, so pre mode accepts either dist-tag but only `-<tag>.N` versions.
 */
function assertDistTag(entry: PlanEntry, tag: string): void {
  const release = `${entry.name}@${entry.version}`;
  if (tag === "latest") {
    assert.ok(!entry.version.includes("-"), `${release}: stable releases need stable versions`);
    assert.equal(entry.tag, "latest", `${release}: expected the latest dist-tag`);
    return;
  }
  assert.match(
    entry.version,
    new RegExp(`-${tag}\\.\\d+$`),
    `${release}: expected a ${tag} prerelease`,
  );
  assert.ok([tag, "latest"].includes(entry.tag), `${release}: unexpected ${entry.tag} dist-tag`);
}

/** Tags and tarballs must describe a commit that exists on main. */
function assertReleaseSource(): void {
  assert.equal(git("status", "--porcelain"), "", "Commit or stash every change before releasing.");
  assert.equal(git("branch", "--show-current"), "main", "Release from the main branch.");
}

/** Versioning moves consumed changesets out of the root, even in pre mode. */
async function pendingChangesets(): Promise<string[]> {
  return (await readdir(join(root, ".changeset"))).filter(
    (file) => file.endsWith(".md") && file !== "README.md",
  );
}

async function publications(file = planFile): Promise<PlanEntry[]> {
  const { plan } = await readJson<PlanDocument>(file);
  return plan.flat().filter((entry) => entry.kind === "publish");
}

async function integrityOf(archive: string): Promise<string> {
  return `sha256-${createHash("sha256")
    .update(await readFile(archive))
    .digest("base64")}`;
}

async function createPlan(file: string, stable: boolean): Promise<PlanEntry[]> {
  const tag = await expectedTag(stable);
  changeset(["publish-plan", "-o", file]);
  const entries = await publications(file);
  for (const entry of entries) {
    assert.ok(entry.name.startsWith("@voidmix/"), `${entry.name}: outside the @voidmix scope`);
    assertDistTag(entry, tag);
  }
  return entries;
}

function describe(heading: string, entries: readonly PlanEntry[]): void {
  if (entries.length === 0) {
    console.log("\nNothing to publish: every package version is already on npm.");
    return;
  }
  console.log(`\n${heading}`);
  for (const entry of entries) console.log(`  ${entry.name}@${entry.version} (${entry.tag})`);
}

async function workspaceDirectories(): Promise<Map<string, string>> {
  const directories = new Map<string, string>();
  for (const entry of await readdir(join(root, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, "packages", entry.name);
    const { name } = await readJson<Manifest>(join(directory, "package.json"));
    directories.set(name, directory);
  }
  return directories;
}

/** Read-only preview; it never replaces a packed release plan. */
export async function plan(stable = false): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "voidmix-plan-"));
  try {
    describe(
      "Planned publications:",
      await createPlan(join(directory, "publish-plan.json"), stable),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  const pending = await pendingChangesets();
  if (pending.length > 0)
    console.log(`\nUnreleased changesets: ${pending.join(", ")}. Run bun run version-packages.`);
}

export async function pack(stable = false): Promise<void> {
  assertReleaseSource();
  const pending = await pendingChangesets();
  assert.deepEqual(
    pending,
    [],
    `Unreleased changesets: ${pending.join(", ")}. Run bun run version-packages and commit first.`,
  );
  await rm(packDirectory, { recursive: true, force: true });
  const planned = await createPlan(planFile, stable);
  const recordCommit = () =>
    writeFile(releaseFile, `${JSON.stringify({ commit: git("rev-parse", "HEAD") }, null, 2)}\n`);
  // Pushes without new versions reach CI's publish step too; they succeed as no-ops.
  if (planned.length === 0) {
    await recordCommit();
    describe("", planned);
    return;
  }

  // Turbo reuses cached output, so this only rebuilds stale or missing dist files.
  run(["run", "build", "--filter=./packages/*"]);

  // Changesets packs Bun workspaces with npm, which publishes workspace: and catalog:
  // verbatim. Bun's packer resolves them and is the packer pack:check verifies.
  const directories = await workspaceDirectories();
  await mkdir(join(packDirectory, "packages"), { recursive: true });
  const tarballs = new Map<string, NonNullable<PlanEntry["tarball"]>>();
  for (const entry of planned) {
    const directory = directories.get(entry.name);
    assert.ok(directory, `${entry.name}: no workspace under packages/`);
    const path = `packages/${entry.name.slice(1).replace("/", "-")}-${entry.version}.tgz`;
    const archive = join(packDirectory, path);
    execFileSync(process.execPath, ["pm", "pack", "--ignore-scripts", "--filename", archive], {
      cwd: directory,
      stdio: "pipe",
    });
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }),
    ) as Manifest;
    assert.equal(manifest.name, entry.name);
    assert.equal(manifest.version, entry.version);
    for (const field of dependencyFields) {
      for (const [name, version] of Object.entries(manifest[field] ?? {}))
        assert.ok(!localProtocol.test(version), `${entry.name}: ${field} publishes local ${name}`);
    }
    tarballs.set(`${entry.name}@${entry.version}`, { path, integrity: await integrityOf(archive) });
  }

  // Keep Changesets' artifact format so `publish --from-pack-dir` uploads these tarballs.
  const document = await readJson<PlanDocument>(planFile);
  document.plan = document.plan.map((group) =>
    group.map((entry) => {
      const tarball = tarballs.get(`${entry.name}@${entry.version}`);
      return entry.kind === "publish" && tarball ? { ...entry, tarball } : entry;
    }),
  );
  await writeFile(planFile, `${JSON.stringify(document, null, 2)}\n`);

  // Install and load the exact archives in isolated Bun and Node consumers.
  run(["scripts/check-packages.ts"], { ...process.env, TOOLKIT_RELEASE_PLAN: planFile });
  // Recorded last: publication refuses archives that did not pass the consumer checks.
  await recordCommit();
  describe("Packed for publication:", planned);
  console.log("\nInspect .changeset/pack/release, then run: bun run release:publish");
}

export async function publish(stable = false, passthrough: string[] = []): Promise<void> {
  assertReleaseSource();
  assert.ok(existsSync(releaseFile), "Run bun run release:pack before publishing.");
  const { commit } = await readJson<{ commit: string }>(releaseFile);
  assert.equal(git("rev-parse", "HEAD"), commit, "HEAD changed after packing; pack again.");
  const tag = await expectedTag(stable);
  const entries = await publications();
  const [first] = entries;
  if (!first) {
    describe("", entries);
    return;
  }
  for (const entry of entries) {
    assertDistTag(entry, tag);
    assert.ok(entry.tarball, `${entry.name}: missing packed tarball; pack again.`);
    assert.equal(
      await integrityOf(join(packDirectory, entry.tarball.path)),
      entry.tarball.integrity,
      `${entry.name}: tarball changed after packing; pack again.`,
    );
  }
  describe("Publishing:", entries);
  changeset(["publish", "--from-pack-dir", packDirectory, ...passthrough]);
  const tags = entries
    .map((entry) => `${entry.name}@${entry.version}`)
    .filter((name) => git("tag", "--list", name) === name);
  if (tags.length < entries.length) console.log("\nSome release tags were not created locally.");
  if (process.env.CHANGESETS_OUTPUT)
    console.log("\nchangesets/action pushes the release tags and creates GitHub releases.");
  else if (tags.length > 0)
    console.log(`\nPush main and the release tags:\n  git push origin main ${tags.join(" ")}`);
  console.log(`Confirm each dist-tag, for example:\n  npm view ${first.name} dist-tags`);
}

const snapshotDirectory = join(root, ".changeset/pack/snapshot");
const snapshotTag = "next";

/** Package names from the frontmatter of changesets that are not versioned yet. */
async function changedPackages(): Promise<string[]> {
  const names = new Set<string>();
  for (const file of await pendingChangesets()) {
    const source = await readFile(join(root, ".changeset", file), "utf8");
    const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
    for (const match of header.matchAll(/^\s*["']?(@[\w.-]+\/[\w.-]+)["']?\s*:/gm))
      names.add(match[1]!);
  }
  return [...names].sort();
}

/** Like run(), but throws so callers can restore files in a finally block. */
function runOrThrow(args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} exited with ${result.status}`);
}

export interface SnapshotOptions {
  publish?: boolean;
  otp?: string;
}

/**
 * Preview archives for consumers before a versioned alpha exists. Snapshot versions sort
 * below every release, never move `latest` or `alpha`, and leave no repository changes.
 */
export async function snapshot(
  packages: string[] = [],
  { publish = false, otp }: SnapshotOptions = {},
): Promise<void> {
  assert.equal(git("status", "--porcelain"), "", "Commit every change before a snapshot.");
  const names = packages.length
    ? [...new Set(packages.map((name) => (name.startsWith("@") ? name : `@voidmix/${name}`)))]
    : await changedPackages();
  assert.ok(names.length > 0, "No unreleased changesets; name the packages to snapshot.");
  const directories = await workspaceDirectories();
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const version = `0.0.0-${snapshotTag}-${stamp}-${git("rev-parse", "--short=7", "HEAD")}`;

  run(["run", "build", "--filter=./packages/*"]);
  await rm(snapshotDirectory, { recursive: true, force: true });
  await mkdir(join(snapshotDirectory, "packages"), { recursive: true });
  const originals = new Map<string, string>();
  const entries: PlanEntry[] = [];
  try {
    for (const name of names) {
      assert.ok(name.startsWith("@voidmix/"), `${name}: outside the @voidmix scope`);
      const directory = directories.get(name);
      assert.ok(directory, `${name}: no workspace under packages/`);
      const file = join(directory, "package.json");
      const source = await readFile(file, "utf8");
      const manifest = JSON.parse(source) as Manifest & { private?: boolean };
      assert.ok(!manifest.private, `${name}: private packages are not published`);
      // Snapshots rewrite only their own version, so they cannot pin sibling snapshots.
      for (const field of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
        const sibling = Object.keys(manifest[field] ?? {}).find((dependency) =>
          dependency.startsWith("@voidmix/"),
        );
        assert.ok(!sibling, `${name}: ${field} on ${sibling} is unsupported in snapshots`);
      }
      originals.set(file, source);
      await writeFile(file, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
      const path = `packages/${name.slice(1).replace("/", "-")}-${version}.tgz`;
      const archive = join(snapshotDirectory, path);
      execFileSync(process.execPath, ["pm", "pack", "--ignore-scripts", "--filename", archive], {
        cwd: directory,
        stdio: "pipe",
      });
      entries.push({
        kind: "publish",
        name,
        version,
        tag: snapshotTag,
        tarball: { path, integrity: await integrityOf(archive) },
      });
    }
    const planPath = join(snapshotDirectory, "publish-plan.json");
    await writeFile(planPath, `${JSON.stringify({ version: 1, plan: [entries] }, null, 2)}\n`);
    // The same archive rules and isolated Bun/Node consumers as a real release.
    runOrThrow(["scripts/check-packages.ts"], { ...process.env, TOOLKIT_RELEASE_PLAN: planPath });
  } finally {
    for (const [file, source] of originals) await writeFile(file, source);
  }

  describe(publish ? "Publishing snapshots:" : "Packed snapshots:", entries);
  if (publish) {
    for (const entry of entries) {
      const args = [
        "publish",
        join(snapshotDirectory, entry.tarball!.path),
        "--tag",
        snapshotTag,
        "--access",
        "public",
        ...(otp ? ["--otp", otp] : []),
      ];
      const result = spawnSync("npm", args, { cwd: root, env: npmEnvironment, stdio: "inherit" });
      assert.equal(result.status, 0, `${entry.name}@${entry.version}: npm publish failed`);
    }
  } else {
    console.log("\nInspect .changeset/pack/snapshot, then publish with --publish.");
  }
  console.log("\nConsumers pin the exact snapshot, for example:");
  for (const entry of entries) console.log(`  "${entry.name}": "${entry.version}"`);
}
