# @voidmix/devkit

Maintenance checks and task helpers for Bun monorepos: workspace boundaries,
toolchain pins, static message catalogs, documentation links and relocated build
artifacts.

```sh
bun add -d @voidmix/devkit
```

ESM only, for Node 22.14+ and Bun. Each entry is independent, so a consumer loads
only the dependencies it uses. The package reads files and spawns processes; it
contains no product rules, so repositories compose their own policy from it.

| Entry            | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `./workspaces`   | Discover workspaces, read boundary metadata and resolve imports        |
| `./architecture` | Check dependencies, exports, cycles, platform targets and import leaks |
| `./toolchain`    | Read Node/Bun pins, check every duplicated pin and the active runtimes |
| `./catalogs`     | Read static message catalogs without executing them                    |
| `./docs`         | Report broken relative Markdown links                                  |
| `./process`      | Run commands, load dotenv files and run Turbo with a guarded cache     |
| `./artifact`     | Stage a relocated output and probe a running Node server               |

## Workspace architecture

Each workspace declares metadata under a package.json key, `devkit` by default:

```json
{
  "devkit": {
    "kind": "library",
    "target": "universal",
    "entryTargets": { "./client": "browser" },
    "sourceTargets": { "src/client/**": "browser" }
  }
}
```

`kind` is `app`, `library` or `tooling`; targets are `universal`, `browser`,
`native`, `node` and `bun`.

```ts
import { checkArchitecture } from "@voidmix/devkit/architecture";
import { discover } from "@voidmix/devkit/workspaces";

const findings = checkArchitecture(discover(root, { metadataKey: "devkit" }));
```

`discover` also reports directories under `apps/` and `packages/` without a
manifest; pass `containers` to change them. `checkArchitecture` statically parses
runtime sources under `src/`, `server/`, `native/` and `app/` and walks every
public export. It reports private workspace members and invalid metadata,
libraries without exports, missing export targets, non-`workspace:*` internal
ranges, dependency cycles including development dependencies, undeclared runtime
or type imports, private cross-workspace paths, application or tooling imports
from runtime code, test-only imports, host APIs used outside their target and DOM
globals reachable from universal or native entries.

## Toolchain

`.nvmrc` pins Node and the root `packageManager` (`bun@x.y.z`) pins Bun. Every
other declaration must follow those two sources.

```ts
import { assertToolchainRuntime, checkToolchain, pinnedNode } from "@voidmix/devkit/toolchain";

const findings = checkToolchain(root, {
  documents: ["README.md", "AGENTS.md"],
  turboGlobalDependencies: [".nvmrc", "mise.toml"],
});
const { node, bun, nodeBinary } = assertToolchainRuntime(root, {
  nodeBinaryEnv: "DEVKIT_NODE_BINARY",
});
```

`checkToolchain` checks `engines.node` and both `devEngines` entries (including
`onFail: "error"`), rejects `.node-version`, `.bun-version` and `.tool-versions`,
requires `mise.toml` to read the existing pins without `[tools]`, requires every
`actions/setup-node` and `oven-sh/setup-bun` step to read `.nvmrc` and
`package.json`, matches `@types/node` by major and `@types/bun` exactly in every
manifest and Bun catalog, and checks Dockerfile `node:` and `oven/bun:` images,
documented `Node x.y.z` and `Bun x.y.z` versions and Turbo global dependencies.
`pinnedNode` returns the Node executable after checking its version; the binary
variable selects an executable but never relaxes the version.

## Catalogs and documentation

```ts
import { readStaticCatalog } from "@voidmix/devkit/catalogs";
import { checkDocumentLinks } from "@voidmix/devkit/docs";

const en = readStaticCatalog("src/messages/en.ts");
const broken = checkDocumentLinks(root, ["README.md", "docs/guide.md"]);
```

`readStaticCatalog` accepts JSON or a module whose default export is an object
literal of strings, optionally with `as const` or `satisfies`. Computed values,
spreads and computed keys are rejected, and the module is never executed. Pair it
with `compareMessageCatalogs` from `@voidmix/intl/testing` for ICU parity.

## Processes and artifacts

```ts
import { pinnedNode } from "@voidmix/devkit/toolchain";
import { probeArtifact } from "@voidmix/devkit/artifact";
import { developmentEnvironment, run, turbo } from "@voidmix/devkit/process";

await turbo(root, "build", ["--filter", "web"], { trustedCacheEnv: "CACHE_TRUSTED" });
await probeArtifact({
  name: "web",
  output: `${root}/apps/web/.output`,
  node: pinnedNode(root),
  check: async (base) => {
    if (!(await fetch(base)).ok) throw new Error("home page failed");
  },
});
```

`developmentEnvironment` copies the process environment and layers `.env.local`
and `.env` beneath it without printing values. `turbo` must run under Bun; it
loads dotenv files for `dev` and `build`, and unless the trusted variable is
`"true"` removes remote cache credentials and uses the local cache only.
`stageArtifact` copies an output after rejecting absolute links and links that
escape it. `probeArtifact` stages the output in a temporary directory, starts its
entry with the given Node on a free port, waits for the health path, runs the
check and always stops the server.
