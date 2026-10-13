import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "raypx-toolkit-release-"));

function run(binary, args) {
  return execFileSync(binary, args, { cwd: temporary, encoding: "utf8", stdio: "pipe" });
}

try {
  const config = JSON.parse(await readFile(join(root, ".changeset/config.json"), "utf8"));
  assert.deepEqual(config.fixed, [], "Toolkit packages must not share a fixed version.");
  assert.deepEqual(config.linked, [], "Toolkit packages must not share a linked version.");
  assert.equal(config.access, "public");
  assert.equal(config.baseBranch, "main");
  assert.equal(config.privatePackages.version, false);
  assert.equal(config.privatePackages.tag, false);
  const documentation = JSON.parse(await readFile(join(root, "docs/package.json"), "utf8"));
  assert.equal(documentation.private, true, "The documentation site must remain private.");
  await mkdir(join(temporary, ".changeset"));
  await writeFile(join(temporary, ".changeset/config.json"), JSON.stringify(config));
  await writeFile(
    join(temporary, "package.json"),
    JSON.stringify({
      name: "toolkit-release-fixture",
      private: true,
      packageManager: "bun@1.4.0",
      workspaces: { packages: ["docs", "packages/*"] },
    }),
  );
  await mkdir(join(temporary, "docs"));
  await writeFile(
    join(temporary, "docs/package.json"),
    JSON.stringify({ name: "docs", version: "0.0.0", private: true }),
  );
  for (const [name, version] of [
    ["first", "0.1.0"],
    ["second", "2.3.0"],
  ]) {
    await mkdir(join(temporary, "packages", name), { recursive: true });
    await writeFile(
      join(temporary, "packages", name, "package.json"),
      JSON.stringify({ name: `@raypx/${name}`, version }),
    );
  }
  // @manypkg identifies Bun workspaces by their lockfile. Generate a real one
  // rather than using an empty placeholder or a different workspace format.
  run(process.execPath, ["install", "--ignore-scripts"]);
  run("git", ["init", "-b", "main"]);
  run("git", ["config", "user.name", "Toolkit release fixture"]);
  run("git", ["config", "user.email", "toolkit-fixture@example.invalid"]);
  run("git", ["add", "."]);
  run("git", ["commit", "-m", "Initial release fixture"]);
  await writeFile(
    join(temporary, ".changeset/independent.md"),
    '---\n"@raypx/first": patch\n---\n\nExercise one independent package release.\n',
  );
  run("git", ["add", "."]);
  run("git", ["commit", "-m", "Add independent release"]);
  run(process.execPath, ["--bun", join(root, "node_modules/@changesets/cli/bin.js"), "version"]);
  const first = JSON.parse(await readFile(join(temporary, "packages/first/package.json"), "utf8"));
  const second = JSON.parse(
    await readFile(join(temporary, "packages/second/package.json"), "utf8"),
  );
  assert.equal(first.version, "0.1.1");
  assert.equal(second.version, "2.3.0");
  const docs = JSON.parse(await readFile(join(temporary, "docs/package.json"), "utf8"));
  assert.equal(docs.version, "0.0.0");
  assert.match(await readFile(join(temporary, "packages/first/CHANGELOG.md"), "utf8"), /0\.1\.1/);
  console.log(
    "Changesets: one package received a patch; the unrelated library and private docs retained their versions.",
  );
} finally {
  // This path is exclusively created by mkdtemp above, never user-provided.
  await rm(temporary, { recursive: true, force: true });
}
