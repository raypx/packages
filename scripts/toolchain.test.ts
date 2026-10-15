import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { assertToolchainRuntime, checkToolchain, readToolchain } from "./toolchain.js";

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync }));

const roots: string[] = [];
const nodeVersion = "24.15.0";
const bunVersion = "1.4.3";
const workflow = [
  "jobs:",
  "  verify:",
  "    steps:",
  "      - uses: actions/setup-node@v7",
  "        with:",
  "          node-version-file: .nvmrc",
  "      - uses: oven-sh/setup-bun@v2",
  "        with:",
  "          bun-version-file: package.json",
].join("\n");

function repository(overrides: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "voidmix-toolchain-test-"));
  roots.push(root);
  const files = {
    ".nvmrc": `${nodeVersion}\n`,
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["docs", "packages/*"],
      packageManager: `bun@${bunVersion}`,
      engines: { node: nodeVersion },
      devEngines: {
        packageManager: { name: "bun", version: bunVersion, onFail: "error" },
        runtime: { name: "bun", version: bunVersion, onFail: "error" },
      },
      devDependencies: { "@types/node": "24.19.2" },
    }),
    "mise.toml": '[settings]\nidiomatic_version_file_enable_tools = ["node", "bun"]\n',
    ".github/workflows/ci.yml": workflow,
    "docs/package.json": JSON.stringify({
      private: true,
      devDependencies: { "@types/node": "24.19.2" },
    }),
    "packages/library/package.json": JSON.stringify({
      name: "@voidmix/library",
      engines: { node: ">=20" },
    }),
    "README.md": `Develop with Node **${nodeVersion}** and Bun **${bunVersion}**.\n`,
    "turbo.json": JSON.stringify({
      globalDependencies: [".nvmrc", "mise.toml", "scripts/toolchain.ts"],
    }),
    ...overrides,
  };
  for (const [file, source] of Object.entries(files)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}

function changeManifest(root: string, change: (manifest: ReturnType<typeof manifestAt>) => void) {
  const manifest = manifestAt(root);
  change(manifest);
  writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
}

function manifestAt(root: string) {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    packageManager: string;
    engines: { node: string };
    devEngines: Record<string, { name: string; version: string; onFail: string }>;
    devDependencies: Record<string, string>;
  };
}

beforeEach(() => {
  execFileSync.mockReset();
  vi.stubEnv("TOOLKIT_NODE_BINARY", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("development toolchain declarations", () => {
  it("accepts consistent sources while keeping the library runtime support range independent", () => {
    const root = repository();
    expect(readToolchain(root)).toEqual({ node: nodeVersion, bun: bunVersion });
    expect(checkToolchain(root)).toEqual([]);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("accepts the v prefix in the Node pin", () => {
    expect(readToolchain(repository({ ".nvmrc": `v${nodeVersion}\n` }))).toEqual({
      node: nodeVersion,
      bun: bunVersion,
    });
  });

  it.each(["24", "lts/*", "^24.15.0"])("rejects the ambiguous Node pin %s", (pin) => {
    const root = repository({ ".nvmrc": pin });
    expect(() => readToolchain(root)).toThrow("Pin exact Node and Bun versions");
    expect(checkToolchain(root)).toEqual([
      "Pin exact Node and Bun versions in .nvmrc and package.json packageManager.",
    ]);
  });

  it.each(["bun@1.4", "bun@latest", "npm@10.9.0"])(
    "rejects the invalid package manager pin %s",
    (pin) => {
      const root = repository();
      changeManifest(root, (manifest) => {
        manifest.packageManager = pin;
      });
      expect(() => readToolchain(root)).toThrow("Pin exact Node and Bun versions");
    },
  );

  it.each([".node-version", ".bun-version", ".tool-versions"])(
    "rejects the duplicate version source %s",
    (file) => {
      expect(checkToolchain(repository({ [file]: nodeVersion }))).toContain(
        `${file}: use .nvmrc and package.json instead of a second version source`,
      );
    },
  );

  it("rejects versions duplicated in mise instead of reading the canonical pins", () => {
    expect(
      checkToolchain(
        repository({
          "mise.toml": `[settings]\nidiomatic_version_file_enable_tools = ["node", "bun"]\n[tools]\nnode = "${nodeVersion}"\n`,
        }),
      ),
    ).toContain("mise.toml: read existing pins instead of declaring [tools] versions");
  });

  it("requires mise to read both runtime pin files", () => {
    expect(checkToolchain(repository({ "mise.toml": "[settings]\n" }))).toContain(
      "mise.toml: enable idiomatic version files for node and bun",
    );
  });

  it("reports root engine drift and an install guard that no longer enforces Bun", () => {
    const root = repository();
    changeManifest(root, (manifest) => {
      manifest.engines.node = "24.16.0";
      manifest.devEngines.runtime = { name: "node", version: nodeVersion, onFail: "warn" };
    });
    expect(checkToolchain(root)).toEqual(
      expect.arrayContaining([
        `package.json: engines.node is 24.16.0, expected ${nodeVersion}`,
        `package.json: devEngines.runtime is node@${nodeVersion}, expected bun@${bunVersion}`,
        "package.json: devEngines.runtime.onFail is warn, expected error",
      ]),
    );
  });

  it("rejects workflow literal versions even when they match today's pins", () => {
    const root = repository({
      ".github/workflows/ci.yml": workflow
        .replace("node-version-file: .nvmrc", `node-version: ${nodeVersion}`)
        .replace("bun-version-file: package.json", `bun-version: ${bunVersion}`),
    });
    expect(checkToolchain(root)).toEqual(
      expect.arrayContaining([
        ".github/workflows/ci.yml: read node-version-file: .nvmrc instead of a literal version",
        ".github/workflows/ci.yml: read bun-version-file: package.json instead of a literal version",
      ]),
    );
  });

  it("detects a second setup step missing its version-file", () => {
    const root = repository({
      ".github/workflows/ci.yml": `${workflow}\n      - uses: actions/setup-node@v7\n`,
    });
    expect(checkToolchain(root)).toContain(
      ".github/workflows/ci.yml: every node setup must read .nvmrc",
    );
  });

  it("rejects workflow references to a second pin file", () => {
    const root = repository({
      ".github/workflows/ci.yml": workflow.replace(
        "node-version-file: .nvmrc",
        "node-version-file: .node-version",
      ),
    });
    expect(checkToolchain(root)).toContain(
      ".github/workflows/ci.yml: node-version-file must be .nvmrc",
    );
  });

  it("checks Node types in the root and discovered workspaces", () => {
    const root = repository({
      "docs/package.json": JSON.stringify({
        private: true,
        devDependencies: { "@types/node": "26.6.5" },
      }),
    });
    changeManifest(root, (manifest) => {
      manifest.devDependencies["@types/node"] = "26.6.5";
    });
    expect(checkToolchain(root)).toEqual(
      expect.arrayContaining([
        "package.json: @types/node must match the Node 24 major",
        "docs/package.json: @types/node must match the Node 24 major",
      ]),
    );
  });

  it("reports documented Node and Bun versions that drift from the sources", () => {
    const root = repository({
      "README.md": "Develop with Node **24.16.0** and Bun **1.4.2**.\n",
    });
    expect(checkToolchain(root)).toEqual(
      expect.arrayContaining([
        `README.md: documented Node is 24.16.0, expected ${nodeVersion}`,
        `README.md: documented Bun is 1.4.2, expected ${bunVersion}`,
      ]),
    );
  });

  it("requires cache dependencies to follow changes to the development toolchain", () => {
    const root = repository({ "turbo.json": JSON.stringify({ globalDependencies: [] }) });
    expect(checkToolchain(root)).toEqual(
      expect.arrayContaining([
        "turbo.json: include .nvmrc in globalDependencies",
        "turbo.json: include mise.toml in globalDependencies",
        "turbo.json: include scripts/toolchain.ts in globalDependencies",
      ]),
    );
  });
});

describe("active development runtimes", () => {
  function runtimeRepository(): string {
    const root = repository();
    changeManifest(root, (manifest) => {
      manifest.packageManager = `bun@${process.versions.bun}`;
    });
    return root;
  }

  it("checks the selected Node and returns both canonical versions", () => {
    execFileSync.mockReturnValue(`v${nodeVersion}\n`);
    expect(assertToolchainRuntime(runtimeRepository())).toEqual({
      node: nodeVersion,
      bun: process.versions.bun,
      nodeBinary: "node",
    });
    expect(execFileSync).toHaveBeenCalledWith("node", ["--version"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  });

  it("allows a binary override when it provides the pinned Node", () => {
    vi.stubEnv("TOOLKIT_NODE_BINARY", "/custom/node");
    execFileSync.mockReturnValue(`v${nodeVersion}\n`);
    expect(assertToolchainRuntime(runtimeRepository()).nodeBinary).toBe("/custom/node");
    expect(execFileSync).toHaveBeenCalledWith("/custom/node", ["--version"], expect.any(Object));
  });

  it("does not let a binary override bypass the required Node version", () => {
    vi.stubEnv("TOOLKIT_NODE_BINARY", "/custom/node");
    execFileSync.mockReturnValue("v26.0.0\n");
    expect(() => assertToolchainRuntime(runtimeRepository())).toThrow(
      `Expected Node ${nodeVersion}, got v26.0.0`,
    );
  });

  it("reports an unavailable binary override without depending on the host Node", () => {
    vi.stubEnv("TOOLKIT_NODE_BINARY", "/missing/node");
    execFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(() => assertToolchainRuntime(runtimeRepository())).toThrow("Node is unavailable");
    expect(execFileSync).toHaveBeenCalledWith("/missing/node", ["--version"], expect.any(Object));
  });

  it("rejects a Bun mismatch before probing Node", () => {
    const root = repository();
    changeManifest(root, (manifest) => {
      manifest.packageManager = "bun@0.0.0";
    });
    expect(() => assertToolchainRuntime(root)).toThrow("Expected Bun 0.0.0");
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
