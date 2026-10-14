# @voidmix/tsconfig

## Purpose

Published strict TypeScript presets. Consumers extend one preset and own their
project layout; this package owns shared compiler behavior.

## Interface

| Path                   | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `./base.json`          | strict compiler defaults shared by every preset |
| `./node.json`          | base plus Node-compatible modules and types     |
| `./browser.json`       | base plus browser libraries and React JSX       |
| `./library.json`       | base preset for non-React ESM libraries         |
| `./react-library.json` | library plus DOM libraries and React JSX        |

Presets are the package-root JSON files listed in `files` and `exports`. The
README documents every preset and compiler guarantee.

## Ownership

- Own compiler behavior shared by consumers and by this repository's packages.
- Own nothing consumer-specific: no `include`, `exclude`, `files`, `rootDir`,
  `outDir`, `paths`, project references or application-specific `types`.

## Constraints

- `verbatimModuleSyntax` and `exactOptionalPropertyTypes` are inherited from
  `base.json`. Never disable either, or any other option in its strict set.
- Presets extend siblings with relative `./<preset>.json` paths only.
- Keep Bun, Deno, Vite and other runtime-specific types in consuming projects.
  `node.json` describes Node-compatible resolution and standard API types.
- Treat any option that can add consumer type errors as a breaking change.
- Source tests read the preset files directly; packaged consumer checks run the
  TypeScript compiler against each exported preset.

## Verification

```bash
bun run --cwd packages/tsconfig test
bun run --cwd packages/tsconfig check
bun run --cwd packages/tsconfig pack:check
bun run pack:check
```
