import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Dependencies = Record<string, string>;

export interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  files?: string[];
  exports: Record<string, unknown>;
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

/** One packed archive with its source manifest and the manifest it publishes. */
export interface ArchiveContext {
  archive: string;
  entries: ReadonlySet<string>;
  manifest: Manifest;
  packed: Manifest;
  packageDirectory: string;
}

/** An isolated directory, outside the workspace, where the archive is installed. */
export interface ConsumerContext extends ArchiveContext {
  consumer: string;
}

/**
 * A public package's checks beyond the shared archive rules in check-packages.ts.
 * Probe programs live in `fixtures/<package directory>/` and are copied into its
 * consumer: top-level `.ts` files compile against the installed archive and
 * top-level `.mjs` files run with Bun and Node.
 */
export interface PackageCheck {
  assertArchive?(context: ArchiveContext): void | Promise<void>;
  /** Packages whose exports are not JavaScript replace the shared consumer check. */
  checkConsumer?(context: ConsumerContext): Promise<void>;
  /** Consumer dependencies beyond the archive and its peers. */
  consumerDependencies?(context: ArchiveContext): Dependencies;
  consumerDevDependencies?(context: ArchiveContext): Dependencies;
  afterRuntime?(context: ConsumerContext): Promise<void>;
}

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  devDependencies: Dependencies;
};
export const node = process.env.TOOLKIT_NODE_BINARY || "node";
export const fixtures = join(root, "scripts/package-checks/fixtures");

export function run(binary: string, args: string[], cwd: string): string {
  return execFileSync(binary, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

export function readArchived(archive: string, path: string): string {
  return execFileSync("tar", ["-xOf", archive, `package/${path}`], { encoding: "utf8" });
}

export const byText = (left: string, right: string) => left.localeCompare(right);

/** Runs every top-level `.mjs` file in a directory with Bun and Node. */
export async function runModules(directory: string): Promise<void> {
  const modules = (await readdir(directory)).filter((file) => file.endsWith(".mjs"));
  for (const file of modules.sort(byText)) {
    run(process.execPath, [file], directory);
    run(node, [file], directory);
  }
}
