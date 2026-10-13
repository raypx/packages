# Raypx Packages Instructions

## Scope

This standalone repository publishes reusable `@raypx/*` libraries. It must not
depend on the Raypx product repository, business schemas, repository interfaces,
application environment, or runtime scripts. Read the package's own `AGENTS.md`
and focused documentation before modifying it.

## Repository shape

`packages/drizzle` owns Drizzle extensions; `packages/env` owns typed environment
validation and reusable presets; `packages/intl` owns generic internationalization.
Root `docs/` is a private Fumadocs application and owns
the documentation site alongside canonical reference Markdown. New libraries live under `packages/`
and have explicit ESM exports, a README, license, independent version and tests.
Shared build and test configuration lives at the root; it is not a published
runtime dependency.
Prefer public TypeScript entry files directly under `src/`; keep supporting
implementation modules in subdirectories when useful.

Maintain capability inventories and extension designs in root `docs/<package>/`,
with navigation in `docs/README.md`. Package READMEs document shipped APIs and
link to repository design documents; research inventories are not npm payloads.
The documentation site compiles canonical Markdown directly through Fumadocs.
Keep the site private and outside library release versions and archives.
Keep license texts and source notices alongside the package that ships adapted code.
Write repository and package documentation in English. Keep localized message
examples in their intended languages and preserve code identifiers and source links.

## Toolchain

Use Bun 1.4.0 for installation and repository scripts. Turbo owns task
orchestration; Vite+ owns packing, formatting, linting and tests. JavaScript tool
CLIs run with `bun --bun`. Node 24 and npm 10.9+ are also needed for packaged
consumer checks and registry publication; source tooling runs on Bun.

Declare third-party dependency versions directly in the owning `package.json`;
keep internal development dependencies on `workspace:*`. The root Vite override
keeps plugins on Vite+'s bundled core. Do not add a second formatter or linter. Each
test-bearing package keeps its own `vitest.config.ts`, importing `workspaceTests`
from root `test.config.ts`. Do not import application test preloads.
Coverage providers must match Vite+'s bundled Vitest version exactly. Verify
coverage commands when updating either dependency; the normal gate does not enable coverage.

## Code and publication

Preserve the strict TypeScript preset, type-only imports, conditional optional
properties, and public API type declarations. Runtime dependencies must resolve
outside this repository. Drizzle remains a peer dependency and must never be
bundled or prototype-patched globally. Its extension package supports PostgreSQL
through postgres.js only; keep node-postgres and other drivers outside its scope.
Env keeps Zod as a peer dependency and never bundles it. Callers own variable names,
secrets, application presets and validation policy; keep generic runtime detection
independent of frameworks and product configuration.

Changesets versions every public package independently: leave `fixed` and
`linked` empty. New packages start at `0.0.0`; first publication uses that manifest
version without running `version-packages`. Initial work belongs in the initial
changelog; changesets increment versions for subsequent releases. Include a
changeset for user-visible changes after initial release preparation. Retain full upstream
licenses and pinned source provenance for copied or adapted code. Update package
docs when exports or compatibility guarantees change.

Do not publish to npm without direct authorization. `pack:check` builds local
tarballs and installs them in a disposable directory; it does not publish.
Automatic version PRs and npm publication are disabled independently in CI until
maintainers configure `VERSION_PR_ENABLED` and `NPM_PUBLISH_ENABLED`, respectively.
Version PRs also require the repository's Actions PR-creation permission.

## Verification

Run a changed package's narrow test first, then `bun run verify`. The root gate
checks formatting, lint, strict types, tests, the documentation build, library tarball contents and
isolated Bun/Node consumers. `build` runs package `check` first through Turbo.
Set `TOOLKIT_NODE_BINARY` if Node is not on PATH. Real database tests require an
explicit disposable database and remain separate from unit verification.

Preserve unrelated user changes. Never reset files or rewrite Git history as
cleanup. Do not log credentials, authorization headers, tokens, or query secrets.
