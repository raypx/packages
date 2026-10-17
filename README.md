# Voidmix

Reusable libraries maintained by [Raypx](https://github.com/raypx). This
repository follows the multi-package structure of
[TanStack Config](https://github.com/TanStack/config), with an independent version
and release history for every public package.

| Package                                          | Purpose                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [@voidmix/devkit](packages/devkit/README.md)     | Workspace boundaries, toolchain pins, static catalogs, artifact probes and task helpers |
| [@voidmix/drizzle](packages/drizzle/README.md)   | PostgreSQL extensions for postgres.js, JSON helpers and query diagnostics               |
| [@voidmix/env](packages/env/README.md)           | Typed environment validation, nested presets, defaults and guarded client access        |
| [@voidmix/intl](packages/intl/README.md)         | Configurable locale negotiation, ICU translation, Intl formatting and React providers   |
| [@voidmix/tsconfig](packages/tsconfig/README.md) | Strict TypeScript presets for ESM libraries, browser applications and Node runtimes     |

The Drizzle package includes a complete upstream capability inventory and a
staged merge plan for drizzle-plus and better-drizzle. Its documented shipping
exports are separate from proposed future APIs. Business repositories, schemas,
authorization rules and migrations remain in the Raypx product repository.

Capability inventories and extension designs are maintained under root `docs/`.
See the [documentation index](docs/README.md) for the complete reference material
and each package's current API guide. A private Fumadocs application lives in
that same directory, with package navigation, table of contents, code highlighting,
light and dark themes, and local full-text search.

`@voidmix/intl` bundles `use-intl` 4.14.9 for translation, formatting and `IntlProvider`,
so consumers install only React, a required peer including for root and server consumers. The package
adds configurable locale negotiation, typed controlled providers and catalog
validation. Applications own preference state, persistence and message loading.
See the [controlled provider migration](docs/intl/migration.md).

`@voidmix/env` validates application-supplied schemas with Zod, combines nested
presets and guards server-only variables in client mode. Its `/runtime` entry
provides the reusable `NODE_ENV` preset; application variables and secrets stay
with their owning product. Zod is a required peer and remains external so consumers
and presets use the same schema classes.

`@voidmix/devkit` holds the maintenance checks this repository and Raypx share:
workspace boundaries, toolchain pins, static message catalogs, documentation
links, guarded Turbo runs and relocated artifact probes. Repositories compose
their own policy from its entries; this repository's scripts import its source.

`@voidmix/tsconfig` publishes the strict compiler presets every workspace in this
repository extends. Presets set compiler behavior only; consumers own file
layout, path aliases, project references and runtime-specific ambient types.

## Development

Use Bun **1.4.3** and Node **24.15.0** for repository development, isolated
consumer checks and npm transport. `.nvmrc` is the authoritative Node pin and
the root `packageManager` is the authoritative Bun pin. Published libraries keep
their own Node compatibility ranges; neither runtime is bundled in them.

mise is the recommended version manager on macOS, Linux and Windows. The committed
`mise.toml` only enables reading those two pins; do not add `[tools]` versions.

```sh
mise trust && mise install
eval "$(mise activate zsh)" # add to ~/.zshrc; use the matching command for your shell
```

Activated shells select the repository versions when entering this directory.
Without activation, use `mise exec -- <command>`. nvm, fnm and direct installs
also work when they select the same pinned versions.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run doctor
bun run toolchain:check
bun run verify
```

Repository maintenance commands share the `voidmix-dev` CLI:

```sh
bun run voidmix-dev --help
bun run voidmix-dev doctor
bun run voidmix-dev toolchain check
```

Install dependencies before using the CLI. The existing `doctor`,
`toolchain:check` and `release:plan`, `release:pack`, `release:publish`,
`release:snapshot` scripts remain aliases for its commands.

`doctor` checks the active Bun and Node executables. `toolchain:check` checks the
committed pins, CI setup and documented versions for drift. To upgrade a runtime,
change `.nvmrc` or `packageManager`, then update the dependent declarations reported
by `toolchain:check`. CI reads the same two files.

Workspace `check` scripts use Bun's native TypeScript checker through
`bun --check --tsconfig-override tsconfig.json`. With no source entrypoint, this
only checks types; `--check` also avoids resolving the same-named package script.
Vite+ still generates library declarations, and tarball consumers keep a separate
TypeScript `tsc` check against the published declarations and NodeNext resolution.

`verify` starts with `doctor` and `toolchain:check`, then checks formatting, lint,
strict types, package tests, builds and actual tarball consumers, plus independent
versioning and pre-mode prerelease rules in disposable Changesets fixtures.
It also checks and builds the documentation
site. `build` runs workspace type checks first through Turbo. The tarball check
verifies archive contents, licenses and dependency resolution, then installs each
package outside the workspace, loads every export with both Bun and Node and
resolves declarations for every JavaScript export. Behavior and public types are
covered by each package's unit tests. Set `TOOLKIT_NODE_BINARY`
to a Node **24.15.0** executable when it is not on PATH; the override must match
the repository pin. `TOOLKIT_KEEP_PACK_CHECK=1` retains disposable consumer
directories for diagnosis.

Use `bun run --cwd packages/drizzle test` to iterate on its narrow test suite.
Vite+ owns leaf tools and Turbo owns task orchestration. No Raypx product scripts
or application test preloads are required; TypeScript presets come from the
`@voidmix/tsconfig` workspace.

Each workspace declares its tested dependency versions directly in its own
`package.json`. The root owns shared development tools and the Vite override
that keeps plugins on Vite+'s bundled core. Dependency updates are reviewed in
the affected manifests alongside the lockfile.

### Documentation site

```sh
bun run docs:dev      # http://localhost:3100
bun run docs:check
bun run docs:build
bun run docs:preview
```

The site uses Fumadocs with TanStack Start, Tailwind CSS and Vite+. Fumadocs compiles
the root documentation, package READMEs and source notices directly, without a
content synchronization script or generated Markdown copies. Edit the canonical
Markdown shown by each page's source link. Page routes and navigation live in
`docs/src/lib/pages.ts`. Markdown compilation converts registered documentation
links to site routes; other repository files, including complete license texts,
link to GitHub.

The documentation site's Nitro preset is `bun`; its development, build and preview
commands continue to use `bun --bun vp`. Node provides the isolated package
consumer checks and npm transport.

The development server watches the source Markdown. The build prerenders
documentation and search for static hosting; the private `docs` workspace has
no npm release and does not change library versions. See
[site ownership](docs/AGENTS.md) and [template provenance](docs/NOTICE.md).

## Independent releases

Changesets **3.0.3** and `changesets/action@v2.0.0` manage releases. `fixed` and
`linked` are empty, so packages do not share a version. Dependency changes may
still require a compatible dependent release. Each package owns its changelog
and gets a tag containing its manifest version, such as `@voidmix/drizzle@0.0.0-alpha.0`.
The current version always comes from that package's `package.json`.

### Alpha prereleases

The repository is in Changesets pre mode with the `alpha` tag
(`.changeset/pre.json`) until the first stable release. Every package starts at
**0.0.0-alpha.0**. Consumers pin exact prerelease versions.

A new package's initial work belongs in its initial changelog. Publish its
manifest version directly after verification; **do not run
`bun run version-packages` before its first publication**, because it consumes
changesets and advances versions. Preparing a package does not publish it to npm.

In pre mode, `bun run version-packages` releases only the packages with
changesets as their next prerelease, such as `0.0.0-alpha.1`. Until a package
has a stable release, `latest` follows its newest prerelease: npm assigns
`latest` at the first publication, and Changesets publishes later prereleases
there too. After the first stable release, prereleases use only `alpha`. `bun
run changeset pre exit` followed by `bun run version-packages` graduates every
package to stable **0.0.0** at once. Exit pre mode only for an explicitly
approved first stable release.

For subsequent releases:

1. Run `bun run changeset` for a user-visible change and select only affected
   packages. Commit its Markdown file with the implementation.
2. Merge to `main`. With `VERSION_PR_ENABLED=true`, the release workflow opens or
   updates a version PR using `bun run version-packages`, including package versions,
   changelogs and the refreshed lockfile. Until configured, it reports pending
   version changes and skips PR creation.
3. Review and merge the version PR. With publication enabled, the workflow runs
   verification and publishes only versions that are absent from npm.

Maintainers can also run `bun run version-packages` locally, commit the version
changes and push `main` directly. A version PR is optional.

Publication is disabled unless the repository variable `NPM_PUBLISH_ENABLED`
is exactly `true`.

Before enabling it:

- Grant maintainers publish access to the npm `@voidmix` scope and confirm that the
  package name is available. GitHub organization access does not grant npm scope
  access.
- Configure npm trusted publishing for repository `raypx/voidmix`, workflow
  `release.yml` and environment `npm`. A new package needs its first publication
  by an authorized maintainer before this npm setting can be configured. For a
  registry requiring tokens, set the `NPM_TOKEN` secret instead. Credentials are
  used only by the publish step.
- Create the `npm` GitHub environment, adding reviewers if desired, then enable
  `NPM_PUBLISH_ENABLED`. Provenance is requested for public npm publications.

For optional automatic version PRs, enable **Allow GitHub Actions to create and
approve pull requests** under **Settings → Actions → General → Workflow
permissions**, then set the repository Actions variable `VERSION_PR_ENABLED` to
`true`. The workflow's `pull-requests: write` permission cannot override repository
or organization policy. With the default GitHub token, version PRs do not trigger
another PR workflow automatically; run CI manually before merging, or configure a
GitHub App token for the version action.

An authorized maintainer publishes manually with npm authentication configured.
The [publishing runbook](docs/development/publishing.md) covers setup, recovery
and the first stable release:

```sh
bun run verify
bun run release:plan      # read-only: versions missing from npm and their dist-tag
bun run release:pack      # clean main only: builds, packs with Bun, checks the archives
bun run release:publish   # publishes the packed commit; append --otp <code> if asked
```

To let a consumer try unreleased changes, `bun run release:snapshot` packs
`0.0.0-next-*` previews from any clean branch; see
[consumer previews](docs/development/publishing.md#consumer-previews).

The equivalent CLI commands are `bun run voidmix-dev release plan`,
`bun run voidmix-dev release pack` and `bun run voidmix-dev release publish`.
Place options after the final subcommand, such as `release pack --stable`.
Use `--stable` directly for an approved stable release and `--otp <code>` directly
for an npm one-time password; OTP values remain strings, including leading zeros.
Pass other Changesets arguments after `--` using the full CLI command, such as
`bun run voidmix-dev release publish -- --help`. With the `release:publish` alias,
Bun consumes a leading separator; use `bun run release:publish -- -- --help`.

Changesets uses npm for registry queries and publication. npm otherwise rejects
the repository's strict Bun `devEngines` configuration with `EBADDEVENGINES`.
The workflow scopes `force` to registry transport steps. Changesets selects the
packages and passes each package or tarball directly to npm. Do not set
`NPM_CONFIG_WORKSPACES=false`: npm can infer the current workspace and reject
that conflicting configuration.
Inside the repository, pass `--force` to npm account commands such as
`npm whoami --force`.
Installation, versioning, verification and builds retain the Bun runtime checks.
No publish command is part of installation, normal build or artifact checking.

References: [Changesets configuration](https://changesets.dev/guide/config),
[automating releases](https://changesets.dev/guide/automating),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers).

## Adding a package

Add `packages/<name>` with its own manifest, README, license, strict type check,
test configuration and checked build. Publish compiled ESM and declarations with
explicit exports; configuration packages export package-root files directly.
Keep reusable code independent of product workspaces, declare framework and ORM
integrations as peers where appropriate, and retain provenance for adapted
source. Prefer public TypeScript entry files directly under `src/`, with
supporting implementation modules in subdirectories. `pack:check` picks up
every public package automatically. Add the package to the table above; do not
create a fixed or linked Changesets group.

## License

Voidmix is Apache-2.0. Adapted upstream code retains its original copyright
and license; see package-root `NOTICE.md` and `LICENSE` where adapted code is used.
