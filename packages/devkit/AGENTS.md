# @voidmix/devkit

## Purpose

Repository maintenance building blocks shared by Voidmix and Raypx. Consumers
compose their own policy, CLI and product probes from these entries.

## Interface

| Path             | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `./workspaces`   | Discovery, metadata, export and import resolution           |
| `./architecture` | Workspace boundary checks over static imports               |
| `./toolchain`    | Node/Bun pin reading, declaration checks and runtime checks |
| `./catalogs`     | Static message catalog reader                               |
| `./docs`         | Relative Markdown link check                                |
| `./process`      | Commands, dotenv environment and guarded Turbo runs         |
| `./artifact`     | Relocated output staging and Node server probes             |

The README documents the complete shipped API.

## Constraints

- No product names, package scopes, catalogs, routes or environment variables.
  Product conventions are options; defaults use the `devkit` metadata key and
  `DEVKIT_*` variables.
- Never execute inspected sources or catalogs; parse them with oxc-parser.
- Never print loaded environment values or secrets.
- Use Node APIs only; `turbo` alone requires Bun at call time.
- Do not import other Voidmix packages. Keep entries independent so each loads
  only its own dependencies.
- Keep findings as stable `path: message` strings; consumers and tests match them.
- Voidmix's own maintenance scripts import this package's source directly.

## Verification

```bash
bun run --cwd packages/devkit test
bun run --cwd packages/devkit check
bun run build --filter=@voidmix/devkit
bun run --cwd packages/devkit pack:check
```
