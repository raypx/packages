import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const changesets = join(root, "node_modules/@changesets/cli/bin.js");
const config = JSON.parse(await readFile(join(root, ".changeset/config.json"), "utf8"));
const fixtures: string[] = [];

/** A disposable Bun workspace with this repository's Changesets configuration. */
async function fixture(versions: Readonly<Record<string, string>>, pre?: { tag: string }) {
  const directory = await mkdtemp(join(tmpdir(), "voidmix-release-"));
  fixtures.push(directory);
  const run = (binary: string, args: string[]) =>
    execFileSync(binary, args, { cwd: directory, encoding: "utf8", stdio: "pipe" });
  const commit = (message: string) => {
    run("git", ["add", "."]);
    run("git", ["commit", "-m", message]);
  };
  await mkdir(join(directory, ".changeset"));
  await writeFile(join(directory, ".changeset/config.json"), JSON.stringify(config));
  if (pre)
    await writeFile(
      join(directory, ".changeset/pre.json"),
      JSON.stringify({ mode: "pre", tag: pre.tag }),
    );
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name: "toolkit-release-fixture",
      private: true,
      packageManager: "bun@1.4.3",
      workspaces: { packages: ["docs", "packages/*"] },
    }),
  );
  await mkdir(join(directory, "docs"));
  await writeFile(
    join(directory, "docs/package.json"),
    JSON.stringify({ name: "docs", version: "0.0.0", private: true }),
  );
  for (const [name, version] of Object.entries(versions)) {
    await mkdir(join(directory, "packages", name), { recursive: true });
    await writeFile(
      join(directory, "packages", name, "package.json"),
      JSON.stringify({ name: `@voidmix/${name}`, version }),
    );
  }
  // @manypkg identifies Bun workspaces by their lockfile. Generate a real one
  // rather than using an empty placeholder or a different workspace format.
  run(process.execPath, ["install", "--ignore-scripts"]);
  run("git", ["init", "-b", "main"]);
  run("git", ["config", "user.name", "Toolkit release fixture"]);
  run("git", ["config", "user.email", "toolkit-fixture@example.invalid"]);
  commit("Initial release fixture");
  return {
    directory,
    changeset: (name: string, file: string, bump: "patch" | "minor") =>
      writeFile(
        join(directory, ".changeset", `${file}.md`),
        `---\n"@voidmix/${name}": ${bump}\n---\n\nExercise an independent release.\n`,
      ),
    commit,
    changesets: (...args: string[]) => run(process.execPath, ["--bun", changesets, ...args]),
    version: async (path: string) =>
      (
        JSON.parse(await readFile(join(directory, path, "package.json"), "utf8")) as {
          version: string;
        }
      ).version,
  };
}

try {
  assert.deepEqual(config.fixed, [], "Toolkit packages must not share a fixed version.");
  assert.deepEqual(config.linked, [], "Toolkit packages must not share a linked version.");
  assert.equal(config.access, "public");
  assert.equal(config.baseBranch, "main");
  assert.equal(config.privatePackages.version, false);
  assert.equal(config.privatePackages.tag, false);
  const documentation = JSON.parse(await readFile(join(root, "docs/package.json"), "utf8"));
  assert.equal(documentation.private, true, "The documentation site must remain private.");

  const stable = await fixture({ first: "0.1.0", second: "2.3.0" });
  await stable.changeset("first", "independent", "patch");
  stable.commit("Add independent release");
  stable.changesets("version");
  assert.equal(await stable.version("packages/first"), "0.1.1");
  assert.equal(await stable.version("packages/second"), "2.3.0");
  assert.equal(await stable.version("docs"), "0.0.0");
  assert.match(
    await readFile(join(stable.directory, "packages/first/CHANGELOG.md"), "utf8"),
    /0\.1\.1/,
  );
  console.log(
    "Changesets: one package received a patch; the unrelated library and private docs retained their versions.",
  );

  // scripts/release.ts and the publishing runbook rely on these pre-mode rules.
  const alpha = await fixture(
    { first: "0.0.0-alpha.0", second: "0.0.0-alpha.0" },
    { tag: "alpha" },
  );
  await alpha.changeset("first", "alpha-patch", "patch");
  alpha.commit("Add alpha patch");
  alpha.changesets("version");
  assert.equal(await alpha.version("packages/first"), "0.0.0-alpha.1");
  assert.equal(await alpha.version("packages/second"), "0.0.0-alpha.0");
  const pending = (await readdir(join(alpha.directory, ".changeset"))).filter((file) =>
    file.endsWith(".md"),
  );
  assert.deepEqual(pending, [], "Versioning must move consumed changesets out of the root.");
  alpha.commit("Version alpha patch");
  await alpha.changeset("first", "alpha-minor", "minor");
  alpha.commit("Add alpha minor");
  alpha.changesets("version");
  assert.equal(await alpha.version("packages/first"), "0.0.0-alpha.2");
  alpha.commit("Version alpha minor");
  alpha.changesets("pre", "exit");
  alpha.changesets("version");
  assert.equal(await alpha.version("packages/first"), "0.0.0");
  assert.equal(await alpha.version("packages/second"), "0.0.0");
  assert.ok(!existsSync(join(alpha.directory, ".changeset/pre.json")));
  console.log(
    "Changesets pre mode: changed packages advanced alpha.N alone; exiting graduated every package to 0.0.0.",
  );
} finally {
  // These paths are exclusively created by mkdtemp above, never user-provided.
  for (const directory of fixtures) await rm(directory, { recursive: true, force: true });
}
