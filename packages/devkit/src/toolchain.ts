import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTOML } from "confbox/toml";
import { parseYAML } from "confbox/yaml";
import { workspacePatterns } from "./workspaces.js";

export interface Toolchain {
  node: string;
  bun: string;
}

export interface ToolchainOptions {
  /** Repository-relative documents whose `Node x.y.z` and `Bun x.y.z` mentions must match. */
  documents?: readonly string[];
  /** Files every Turbo cache key must include when `turbo.json` exists. */
  turboGlobalDependencies?: readonly string[];
}

export interface RuntimeOptions {
  /** Environment variable that may select a Node executable outside PATH. */
  nodeBinaryEnv?: string;
}

interface Manifest {
  packageManager?: string;
  engines?: { node?: string };
  devEngines?: Record<string, { name?: string; version?: string; onFail?: string }>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
}

const exactVersion = /^\d+\.\d+\.\d+$/;
const manifestAt = (root: string, file = "package.json"): Manifest =>
  JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
const catalogsOf = (manifest: Manifest): Record<string, string>[] => {
  const workspaces = manifest.workspaces;
  if (!workspaces || typeof workspaces !== "object" || Array.isArray(workspaces)) return [];
  const { catalog, catalogs } = workspaces as {
    catalog?: Record<string, string>;
    catalogs?: Record<string, Record<string, string>>;
  };
  return [...(catalog ? [catalog] : []), ...Object.values(catalogs ?? {})];
};

/** `.nvmrc` pins Node and the root `packageManager` pins Bun; every other pin follows them. */
export function readToolchain(root: string): Toolchain {
  const node = readFileSync(join(root, ".nvmrc"), "utf8").trim().replace(/^v/, "");
  const bun = /^bun@(.+)$/.exec(manifestAt(root).packageManager ?? "")?.[1] ?? "";
  if (!exactVersion.test(node) || !exactVersion.test(bun))
    throw new Error("Pin exact Node and Bun versions in .nvmrc and package.json packageManager.");
  return { node, bun };
}

/** Returns the Node executable after confirming it provides the pinned release. */
export function pinnedNode(
  root: string,
  { nodeBinaryEnv = "DEVKIT_NODE_BINARY" }: RuntimeOptions = {},
) {
  const pins = readToolchain(root);
  const nodeBinary = process.env[nodeBinaryEnv] || "node";
  let node: string;
  try {
    node = execFileSync(nodeBinary, ["--version"], { encoding: "utf8", stdio: "pipe" }).trim();
  } catch {
    throw new Error(
      `Node is unavailable; select Node ${pins.node} from .nvmrc or set ${nodeBinaryEnv}.`,
    );
  }
  if (node !== `v${pins.node}`)
    throw new Error(
      `Expected Node ${pins.node}, got ${node}; select the pinned Node from .nvmrc or set ${nodeBinaryEnv}.`,
    );
  return nodeBinary;
}

/** The binary override changes the consumer executable, never the required version. */
export function assertToolchainRuntime(
  root: string,
  options: RuntimeOptions = {},
): Toolchain & { nodeBinary: string } {
  const pins = readToolchain(root);
  if (process.versions.bun !== pins.bun)
    throw new Error(`Expected Bun ${pins.bun}, got ${process.versions.bun ?? "none"}.`);
  return { ...pins, nodeBinary: pinnedNode(root, options) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkMise(root: string): string[] {
  const file = "mise.toml";
  const path = join(root, file);
  if (!existsSync(path)) return [`${file}: missing runtime manager configuration`];
  let mise: unknown;
  try {
    mise = parseTOML(readFileSync(path, "utf8"));
  } catch {
    return [`${file}: invalid TOML configuration`];
  }
  if (!isRecord(mise)) return [`${file}: configuration must be a table`];
  const findings: string[] = [];
  if (Object.hasOwn(mise, "tools"))
    findings.push(`${file}: read existing pins instead of declaring [tools] versions`);
  const tools = isRecord(mise.settings)
    ? mise.settings.idiomatic_version_file_enable_tools
    : undefined;
  if (
    !Array.isArray(tools) ||
    tools.length !== 2 ||
    !["node", "bun"].every((tool) => tools.includes(tool))
  )
    findings.push(`${file}: enable idiomatic version files for node and bun`);
  return findings;
}

function checkSetupStep(file: string, location: string, step: Record<string, unknown>): string[] {
  if (typeof step.uses !== "string") return [];
  const refSeparator = step.uses.indexOf("@");
  if (refSeparator < 0) return [];
  const repository = step.uses.slice(0, refSeparator).toLowerCase();
  const setup = (
    [
      ["node", "actions/setup-node", ".nvmrc"],
      ["bun", "oven-sh/setup-bun", "package.json"],
    ] as const
  ).find(([, action]) => repository === action);
  if (!setup) return [];
  const [tool, , source] = setup;
  const findings: string[] = [];
  if (step.with !== undefined && !isRecord(step.with))
    findings.push(`${file}: ${location}.with must be a mapping`);
  const inputs = isRecord(step.with) ? step.with : {};
  if (Object.hasOwn(inputs, `${tool}-version`))
    findings.push(`${file}: read ${tool}-version-file: ${source} instead of a literal version`);
  const versionFile = inputs[`${tool}-version-file`];
  if (versionFile === undefined) findings.push(`${file}: every ${tool} setup must read ${source}`);
  else if (versionFile !== source) findings.push(`${file}: ${tool}-version-file must be ${source}`);
  return findings;
}

function checkWorkflows(root: string): string[] {
  const findings: string[] = [];
  for (const file of globSync(".github/workflows/*.{yml,yaml}", { cwd: root })) {
    let workflow: unknown;
    try {
      workflow = parseYAML(readFileSync(join(root, file), "utf8"), { filename: file });
    } catch {
      findings.push(`${file}: invalid YAML configuration`);
      continue;
    }
    if (!isRecord(workflow) || !isRecord(workflow.jobs)) {
      findings.push(`${file}: workflow jobs must be a mapping`);
      continue;
    }
    for (const [name, job] of Object.entries(workflow.jobs)) {
      const location = `jobs.${name}`;
      if (!isRecord(job)) {
        findings.push(`${file}: ${location} must be a mapping`);
        continue;
      }
      if (job.steps === undefined) continue;
      if (!Array.isArray(job.steps)) {
        findings.push(`${file}: ${location}.steps must be an array`);
        continue;
      }
      for (const [index, step] of job.steps.entries()) {
        const stepLocation = `${location}.steps[${index}]`;
        if (!isRecord(step)) {
          findings.push(`${file}: ${stepLocation} must be a mapping`);
          continue;
        }
        findings.push(...checkSetupStep(file, stepLocation, step));
      }
    }
  }
  return findings;
}

/** Check duplicated declarations without installing tools or running application code. */
export function checkToolchain(
  root: string,
  {
    documents = ["README.md", "AGENTS.md"],
    turboGlobalDependencies = [".nvmrc", "mise.toml"],
  }: ToolchainOptions = {},
): string[] {
  let pins: Toolchain;
  try {
    pins = readToolchain(root);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const findings: string[] = [];
  const manifest = manifestAt(root);
  const expect = (file: string, label: string, actual: string | undefined, expected: string) => {
    if (actual !== expected)
      findings.push(`${file}: ${label} is ${actual ?? "missing"}, expected ${expected}`);
  };
  expect("package.json", "engines.node", manifest.engines?.node, pins.node);
  for (const key of ["packageManager", "runtime"]) {
    const engine = manifest.devEngines?.[key];
    expect(
      "package.json",
      `devEngines.${key}`,
      `${engine?.name}@${engine?.version}`,
      `bun@${pins.bun}`,
    );
    expect("package.json", `devEngines.${key}.onFail`, engine?.onFail, "error");
  }
  for (const file of [".node-version", ".bun-version", ".tool-versions"])
    if (existsSync(join(root, file)))
      findings.push(`${file}: use .nvmrc and package.json instead of a second version source`);
  findings.push(...checkMise(root));

  // Runtime type packages follow the pins: @types/node by major, @types/bun exactly.
  const nodeMajor = pins.node.split(".")[0]!;
  // Protocol ranges such as catalog: and workspace: are checked where they resolve.
  const version = (range: string | undefined) =>
    range && !/^[a-z]+:/.test(range) ? range.replace(/^[\^~]/, "") : undefined;
  const checkTypes = (file: string, dependencies: Record<string, string> | undefined) => {
    const node = version(dependencies?.["@types/node"]);
    if (node && node.split(".")[0] !== nodeMajor)
      findings.push(`${file}: @types/node must match the Node ${nodeMajor} major`);
    const bun = version(dependencies?.["@types/bun"]);
    if (bun) expect(file, "@types/bun", bun, pins.bun);
  };
  for (const catalog of catalogsOf(manifest)) checkTypes("package.json catalog", catalog);
  for (const file of [
    "package.json",
    ...globSync(
      workspacePatterns(manifest).map((path) => `${path}/package.json`),
      { cwd: root },
    ),
  ])
    checkTypes(file, manifestAt(root, file).devDependencies);

  for (const file of globSync("**/Dockerfile", { cwd: root, exclude: ["**/node_modules/**"] })) {
    const source = readFileSync(join(root, file), "utf8");
    for (const [, version] of source.matchAll(/^FROM\s+node:(\d+\.\d+\.\d+)/gm))
      expect(file, "node image", version, pins.node);
    for (const [, version] of source.matchAll(/^FROM\s+oven\/bun:(\d+\.\d+\.\d+)/gm))
      expect(file, "bun image", version, pins.bun);
  }
  findings.push(...checkWorkflows(root));
  for (const file of documents) {
    if (!existsSync(join(root, file))) continue;
    const document = readFileSync(join(root, file), "utf8").replaceAll("**", "");
    for (const [, tool, version] of document.matchAll(/\b(Node|Bun) v?(\d+\.\d+\.\d+)\b/g))
      expect(file, `documented ${tool}`, version, tool === "Node" ? pins.node : pins.bun);
  }
  const turboFile = join(root, "turbo.json");
  if (existsSync(turboFile)) {
    const turbo = JSON.parse(readFileSync(turboFile, "utf8")) as { globalDependencies?: string[] };
    for (const file of turboGlobalDependencies)
      if (!turbo.globalDependencies?.includes(file))
        findings.push(`turbo.json: include ${file} in globalDependencies`);
  }
  return [...new Set(findings)];
}
