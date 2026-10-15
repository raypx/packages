import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Toolchain {
  node: string;
  bun: string;
}

interface Manifest {
  packageManager?: string;
  engines?: { node?: string };
  devEngines?: Record<string, { name?: string; version?: string; onFail?: string }>;
  devDependencies?: Record<string, string>;
  workspaces?: string[];
}

const exactVersion = /^\d+\.\d+\.\d+$/;
const manifestAt = (root: string): Manifest =>
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Manifest;

/** These are the only authoritative development runtime versions. */
export function readToolchain(root: string): Toolchain {
  const node = readFileSync(join(root, ".nvmrc"), "utf8").trim().replace(/^v/, "");
  const bun = /^bun@(.+)$/.exec(manifestAt(root).packageManager ?? "")?.[1] ?? "";
  if (!exactVersion.test(node) || !exactVersion.test(bun))
    throw new Error("Pin exact Node and Bun versions in .nvmrc and package.json packageManager.");
  return { node, bun };
}

/** The binary override changes the consumer executable, never the required version. */
export function assertToolchainRuntime(root: string): Toolchain & { nodeBinary: string } {
  const pins = readToolchain(root);
  if (process.versions.bun !== pins.bun)
    throw new Error(`Expected Bun ${pins.bun}; run mise exec -- bun run doctor.`);
  const nodeBinary = process.env.TOOLKIT_NODE_BINARY || "node";
  let node: string;
  try {
    node = execFileSync(nodeBinary, ["--version"], { encoding: "utf8", stdio: "pipe" }).trim();
  } catch {
    throw new Error("Node is unavailable; run mise install and mise exec -- bun run doctor.");
  }
  if (node !== `v${pins.node}`)
    throw new Error(
      `Expected Node ${pins.node}, got ${node}; run mise exec -- bun run doctor or select the pinned Node with TOOLKIT_NODE_BINARY.`,
    );
  return { ...pins, nodeBinary };
}

/** Check duplicated declarations without installing tools or running application code. */
export function checkToolchain(root: string): string[] {
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
  const miseFile = join(root, "mise.toml");
  if (!existsSync(miseFile)) findings.push("mise.toml: missing runtime manager configuration");
  else {
    const mise = readFileSync(miseFile, "utf8");
    if (/^\s*\[tools(?:\]|\.)/m.test(mise))
      findings.push("mise.toml: read existing pins instead of declaring [tools] versions");
    if (!/^\s*idiomatic_version_file_enable_tools\s*=\s*\[\s*"node"\s*,\s*"bun"\s*\]/m.test(mise))
      findings.push("mise.toml: enable idiomatic version files for node and bun");
  }
  const manifests = [
    "package.json",
    ...globSync(
      (manifest.workspaces ?? []).map((path) => `${path}/package.json`),
      { cwd: root },
    ),
  ];
  for (const file of manifests) {
    const entry = JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
    const types = entry.devDependencies?.["@types/node"];
    if (types && types.split(".")[0] !== pins.node.split(".")[0])
      findings.push(`${file}: @types/node must match the Node ${pins.node.split(".")[0]} major`);
  }
  for (const file of globSync(".github/workflows/*.{yml,yaml}", { cwd: root })) {
    const workflow = readFileSync(join(root, file), "utf8");
    for (const [tool, source] of [
      ["node", ".nvmrc"],
      ["bun", "package.json"],
    ] as const) {
      if (new RegExp(`^\\s*${tool}-version:`, "m").test(workflow))
        findings.push(`${file}: read ${tool}-version-file: ${source} instead of a literal version`);
      const versions = [
        ...workflow.matchAll(new RegExp(`^\\s*${tool}-version-file:\\s*(\\S+)`, "gm")),
      ];
      if (versions.some((match) => match[1] !== source))
        findings.push(`${file}: ${tool}-version-file must be ${source}`);
      const setup =
        tool === "node" ? /uses:\s*actions\/setup-node@/g : /uses:\s*oven-sh\/setup-bun@/g;
      if ([...workflow.matchAll(setup)].length !== versions.length)
        findings.push(`${file}: every ${tool} setup must read ${source}`);
    }
  }
  for (const file of [
    "README.md",
    "AGENTS.md",
    "docs/AGENTS.md",
    "docs/development/publishing.md",
  ]) {
    if (!existsSync(join(root, file))) continue;
    const document = readFileSync(join(root, file), "utf8").replaceAll("**", "");
    for (const [, tool, version] of document.matchAll(/\b(Node|Bun) v?(\d+\.\d+\.\d+)\b/g))
      expect(file, `documented ${tool}`, version, tool === "Node" ? pins.node : pins.bun);
  }
  const turboFile = join(root, "turbo.json");
  if (existsSync(turboFile)) {
    const turbo = JSON.parse(readFileSync(turboFile, "utf8")) as { globalDependencies?: string[] };
    for (const file of [".nvmrc", "mise.toml", "scripts/toolchain.ts"])
      if (!turbo.globalDependencies?.includes(file))
        findings.push(`turbo.json: include ${file} in globalDependencies`);
  }
  return [...new Set(findings)];
}
