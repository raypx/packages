import { existsSync, globSync, readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";

export const targets = ["universal", "browser", "native", "node", "bun"] as const;
export type Target = (typeof targets)[number];
export const kinds = ["app", "library", "tooling"] as const;
export type Kind = (typeof kinds)[number];

/** Per-workspace boundary metadata, stored under a configurable package.json key. */
export interface Metadata {
  kind: Kind;
  target: Target;
  entryTargets?: Record<string, Target>;
  sourceTargets?: Record<string, Target>;
}
export interface Manifest {
  name: string;
  private?: boolean;
  type?: string;
  exports?: Record<string, unknown>;
  imports?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}
export interface Workspace {
  path: string;
  manifest: Manifest;
  metadata: Metadata | undefined;
  aliases: Record<string, string[]>;
}
export interface WorkspaceIndex {
  root: string;
  metadataKey: string;
  workspaces: Workspace[];
  byName: Map<string, Workspace>;
  findings: string[];
}
export interface DiscoverOptions {
  /** The package.json field holding {@link Metadata}. */
  metadataKey?: string;
  /** Directories whose children must each be a workspace. */
  containers?: readonly string[];
}

/** Matches package export, import-map and tsconfig path patterns, including `**`. */
export function matches(pattern: string, value: string): boolean {
  let regex = "^";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!;
    if (char === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        regex += "(?:.*/)?";
        i += 2;
      } else {
        regex += ".*";
        i++;
      }
    } else if (char === "*") regex += "[^/]*";
    else regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${regex}$`).test(value);
}

/** Reads workspace patterns from the array or Bun/Yarn object form of `workspaces`. */
export function workspacePatterns(manifest: { workspaces?: unknown }): string[] {
  const value = manifest.workspaces;
  if (Array.isArray(value)) return value as string[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { packages?: unknown }).packages)
  )
    return (value as { packages: string[] }).packages;
  return [];
}

export function discover(
  root: string,
  { metadataKey = "devkit", containers = ["apps", "packages"] }: DiscoverOptions = {},
): WorkspaceIndex {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const findings: string[] = [];
  const workspaces: Workspace[] = [];
  for (const file of globSync(
    workspacePatterns(manifest).map((p) => `${p}/package.json`),
    { cwd: root },
  ).sort()) {
    const path = file.replaceAll("\\", "/").slice(0, -13);
    const entry = JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
    let aliases: Record<string, string[]> = {};
    const config = join(root, path, "tsconfig.json");
    if (existsSync(config)) {
      try {
        aliases = JSON.parse(readFileSync(config, "utf8")).compilerOptions?.paths ?? {};
      } catch {
        findings.push(`${path}/tsconfig.json: expected valid JSON`);
      }
    }
    workspaces.push({
      path,
      manifest: entry,
      metadata: entry[metadataKey] as Metadata | undefined,
      aliases,
    });
  }
  const byName = new Map<string, Workspace>();
  for (const workspace of workspaces) {
    if (byName.has(workspace.manifest.name))
      findings.push(`duplicate workspace: ${workspace.manifest.name}`);
    byName.set(workspace.manifest.name, workspace);
  }
  for (const parent of containers) {
    if (!existsSync(join(root, parent))) continue;
    for (const child of readdirSync(join(root, parent), { withFileTypes: true })) {
      if (!child.isDirectory() || child.name.startsWith(".")) continue;
      const path = `${parent}/${child.name}`;
      if (!workspaces.some((w) => w.path === path))
        findings.push(`${path}: missing workspace manifest`);
    }
  }
  return { root, metadataKey, workspaces, byName, findings };
}

export function workspaceFor(index: WorkspaceIndex, file: string) {
  return index.workspaces.find((w) => file.startsWith(`${w.path}/`));
}

export function sourceTarget(workspace: Workspace, file: string): Target {
  const relative = file.slice(workspace.path.length + 1);
  const scopes = Object.entries(workspace.metadata?.sourceTargets ?? {})
    .filter(([pattern]) => matches(pattern, relative))
    .sort(([a], [b]) => b.replaceAll("*", "").length - a.replaceAll("*", "").length);
  return scopes[0]?.[1] ?? workspace.metadata?.target ?? "universal";
}

export function compatible(from: Target, to: Target): boolean {
  return to === "universal" || from === to || (from === "bun" && to === "node");
}

export function exportPaths(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(exportPaths);
  return [];
}

export function resolveImport(
  index: WorkspaceIndex,
  from: Workspace,
  file: string,
  request: string,
) {
  const name = request.startsWith("@")
    ? request.split("/").slice(0, 2).join("/")
    : request.split("/")[0]!;
  const target = index.byName.get(name);
  if (target) {
    const subpath = request === name ? "." : `.${request.slice(name.length)}`;
    const entry = Object.entries(target.manifest.exports ?? {}).find(([pattern]) =>
      matches(pattern, subpath),
    );
    const suffix = entry?.[0].includes("*") ? subpath.slice(entry[0].split("*")[0]!.length) : "";
    return {
      target,
      subpath,
      privatePath: !entry,
      paths: entry
        ? exportPaths(entry[1]).map((p) => posix.join(target.path, p.replace("*", suffix)))
        : [],
      targetPlatform:
        target.metadata?.entryTargets?.[entry?.[0] ?? subpath] ??
        target.metadata?.target ??
        "universal",
    };
  }
  const alias = Object.entries(from.aliases).find(([pattern]) => matches(pattern, request));
  const internal = Object.entries(from.manifest.imports ?? {}).find(([pattern]) =>
    matches(pattern, request),
  );
  const pattern = internal?.[0] ?? alias?.[0];
  const mapped = internal?.[1] ?? alias?.[1][0];
  const suffix = pattern?.includes("*") ? request.slice(pattern.split("*")[0]!.length) : "";
  const path = request.startsWith(".")
    ? posix.join(posix.dirname(file), request)
    : mapped
      ? posix.join(from.path, mapped.replace("*", suffix))
      : undefined;
  const owner = path ? workspaceFor(index, path) : undefined;
  return {
    target: owner,
    subpath: ".",
    privatePath: !!owner && owner !== from,
    paths: path ? [path] : [],
    targetPlatform: owner ? sourceTarget(owner, path!) : ("universal" as Target),
  };
}
