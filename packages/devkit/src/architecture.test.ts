import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { checkArchitecture } from "./architecture.js";
import { discover, type Metadata } from "./workspaces.js";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "devkit-architecture-test-"));
  roots.push(root);
  mkdirSync(join(root, "packages"));
  mkdirSync(join(root, "apps"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ workspaces: { packages: ["apps/*", "packages/*"] } }),
  );
  return root;
}
function member(
  root: string,
  name: string,
  options: {
    metadata?: Metadata;
    source?: string;
    deps?: Record<string, string>;
    extra?: Record<string, unknown>;
  } = {},
) {
  const path = `packages/${name}`;
  mkdirSync(join(root, path, "src"), { recursive: true });
  writeFileSync(
    join(root, path, "package.json"),
    JSON.stringify({
      name: `@raypx/${name}`,
      private: true,
      type: "module",
      exports: { ".": "./src/index.ts" },
      devkit: options.metadata ?? { kind: "library", target: "universal" },
      dependencies: options.deps ?? {},
      ...options.extra,
    }),
  );
  writeFileSync(join(root, path, "src/index.ts"), options.source ?? "export const answer = 42;");
  return path;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("workspace architecture", () => {
  it("discovers workspaces from manifests and reads metadata from a configured key", () => {
    const root = fixture();
    member(root, "one");
    mkdirSync(join(root, "packages/orphan"));
    const index = discover(root);
    expect(index.byName.get("@raypx/one")?.metadata).toEqual({
      kind: "library",
      target: "universal",
    });
    expect(index.findings).toEqual(["packages/orphan: missing workspace manifest"]);
    expect(checkArchitecture(index)).toContain("packages/orphan: missing workspace manifest");
    const custom = discover(root, { metadataKey: "product", containers: [] });
    expect(custom.findings).toEqual([]);
    expect(checkArchitecture(custom)).toContain(
      "packages/one/package.json: invalid or missing product metadata",
    );
  });
  it("rejects undeclared dependencies, private relative paths, and dev-only cycles", () => {
    const root = fixture();
    member(root, "one", {
      source: 'import "@raypx/two"; import "../../two/src/index";',
      extra: { devDependencies: { "@raypx/two": "workspace:*" } },
    });
    member(root, "two", { extra: { devDependencies: { "@raypx/one": "workspace:*" } } });
    const findings = checkArchitecture(discover(root)).join("\n");
    expect(findings).toContain("undeclared runtime dependency");
    expect(findings).toContain("private cross-workspace");
    expect(findings).toContain("dependency cycle");
  });
  it("follows private modules behind a pure public export and detects DOM and host leaks", () => {
    const root = fixture();
    const path = member(root, "tokens", { source: 'export { read } from "./internal.js";' });
    writeFileSync(
      join(root, path, "src/internal.ts"),
      'import { readFile } from "node:fs"; export const read = () => document.body;',
    );
    const findings = checkArchitecture(discover(root)).join("\n");
    expect(findings).toContain("universal code cannot import node:fs");
    expect(findings).toContain("reaches DOM global");
  });
  it("allows public pure subpaths while rejecting browser entry in native consumer", () => {
    const root = fixture();
    const ui = member(root, "ui", {
      metadata: {
        kind: "library",
        target: "browser",
        entryTargets: { "./theme": "universal" },
        sourceTargets: { "src/theme.ts": "universal" },
      },
      extra: { exports: { ".": "./src/index.ts", "./theme": "./src/theme.ts" } },
    });
    writeFileSync(join(root, ui, "src/theme.ts"), "export const theme = 'dark';");
    member(root, "native", {
      metadata: { kind: "library", target: "native" },
      deps: { "@raypx/ui": "workspace:*" },
      source: 'import "@raypx/ui/theme";',
    });
    expect(checkArchitecture(discover(root))).toEqual([]);
    writeFileSync(join(root, "packages/native/src/index.ts"), 'import "@raypx/ui";');
    expect(checkArchitecture(discover(root)).join("\n")).toContain(
      "native entry cannot import browser entry",
    );
  });
  it("rejects importing applications and tooling from production libraries", () => {
    const root = fixture();
    member(root, "app", { metadata: { kind: "app", target: "browser" } });
    member(root, "tool", { metadata: { kind: "tooling", target: "bun" } });
    member(root, "consumer", {
      deps: { "@raypx/app": "workspace:*", "@raypx/tool": "workspace:*" },
      source: 'import "@raypx/app"; import "@raypx/tool";',
    });
    const findings = checkArchitecture(discover(root)).join("\n");
    expect(findings).toContain("applications cannot be imported");
    expect(findings).toContain("runtime cannot depend on tooling");
  });
  it("rejects private alias imports and undeclared external packages", () => {
    const root = fixture();
    member(root, "private");
    const from = member(root, "consumer", {
      source: 'import "#secret"; import "undeclared-package";',
    });
    const manifest = join(root, from, "package.json");
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    data.imports = { "#secret": "../private/src/index.ts" };
    writeFileSync(manifest, JSON.stringify(data));
    const findings = checkArchitecture(discover(root)).join("\n");
    expect(findings).toContain("private cross-workspace import #secret");
    expect(findings).toContain("undeclared runtime dependency undeclared-package");
  });
});
