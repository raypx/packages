import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
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

/** A public package's checks beyond the shared archive rules in check-packages.ts. */
export interface PackageCheck {
  assertArchive?(context: ArchiveContext): void | Promise<void>;
  /** Packages whose exports are not JavaScript replace the shared consumer check. */
  checkConsumer?(context: ConsumerContext): Promise<void>;
  /** Consumer dependencies beyond the archive and its peers. */
  consumerDependencies?(context: ArchiveContext): Dependencies;
  consumerDevDependencies?(context: ArchiveContext): Dependencies;
  /** Type-checked after imports of every export, against the installed archive. */
  typeProbe?: string;
  /** Run with Bun and Node after imports of every export. */
  runtimeProbe?: string;
  afterRuntime?(context: ConsumerContext): Promise<void>;
}

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  devDependencies: Dependencies;
};
export const node = process.env.TOOLKIT_NODE_BINARY || "node";

export function run(binary: string, args: string[], cwd: string): string {
  return execFileSync(binary, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

export function readArchived(archive: string, path: string): string {
  return execFileSync("tar", ["-xOf", archive, `package/${path}`], { encoding: "utf8" });
}

export const byText = (left: string, right: string) => left.localeCompare(right);
