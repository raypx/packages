# Raypx Packages

Reusable libraries maintained by [Raypx](https://github.com/raypx). This
repository follows the multi-package structure of
[TanStack Config](https://github.com/TanStack/config), with an independent version
and release history for every public package.

| Package                                      | Purpose                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| [@raypx/drizzle](packages/drizzle/README.md) | PostgreSQL extensions for postgres.js, JSON helpers and query diagnostics             |
| [@raypx/env](packages/env/README.md)         | Typed environment validation, nested presets, defaults and guarded client access      |
| [@raypx/intl](packages/intl/README.md)       | Configurable locale negotiation, ICU translation, Intl formatting and React providers |

The Drizzle package includes a complete upstream capability inventory and a
staged merge plan for drizzle-plus and better-drizzle. Its documented shipping
exports are separate from proposed future APIs. Business repositories, schemas,
authorization rules and migrations remain in the Raypx product repository.

Capability inventories and extension designs are maintained under root `docs/`.
See the [documentation index](docs/README.md) for the complete reference material
and each package's current API guide. A private Fumadocs application lives in
that same directory, with package navigation, table of contents, code highlighting,
light and dark themes, and local full-text search.

`@raypx/intl` uses `use-intl` 4.14.9 for translation, formatting and `IntlProvider`.
React is a required peer, including for root and server consumers. The package
adds configurable locale negotiation, persistence, asynchronous catalog loading
and isolated client factories around that runtime.

`@raypx/env` validates application-supplied schemas with Zod, combines nested
presets and guards server-only variables in client mode. Its `/runtime` entry
provides the reusable `NODE_ENV` preset; application variables and secrets stay
with their owning product. Zod is a required peer and remains external so consumers
and presets use the same schema classes.

## Development

Use Bun **1.4.0**. Node **24** is also required for isolated consumer checks and
npm transport. Neither runtime is bundled in published libraries.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run verify
```

`verify` checks formatting, lint, strict types, package tests, builds and actual
tarball consumers, plus independent versioning in a disposable Changesets
fixture. It also checks and builds the documentation site. `build` runs workspace
type checks first through Turbo. The
tarball check verifies every export and declaration, licenses and dependency
resolution, then installs each package outside the workspace and loads it with
both Bun and Node. Set `TOOLKIT_NODE_BINARY` to a Node executable when it is not
on PATH. `TOOLKIT_KEEP_PACK_CHECK=1` retains disposable consumer directories for
diagnosis.

Use `bun run --cwd packages/drizzle test` to iterate on its narrow test suite.
Vite+ owns leaf tools and Turbo owns task orchestration. No Raypx product scripts,
shared configuration package or application test preloads are required.

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

The development server watches the source Markdown. The build prerenders
documentation and search for static hosting; the private `docs` workspace has
no npm release and does not change library versions. See
[site ownership](docs/AGENTS.md) and [template provenance](docs/NOTICE.md).

## Independent releases

Changesets **3.0.3** and `changesets/action@v2.0.0` manage releases. `fixed` and
`linked` are empty, so packages do not share a version. Dependency changes may
still require a compatible dependent release. Each package owns its changelog
and gets a tag containing its manifest version, such as `@raypx/drizzle@0.0.0`.
The current version always comes from that package's `package.json`.

Drizzle and Intl were first published at **0.0.0**. Env was published from this
repository at **0.0.6**, continuing its existing package history. A new package's initial work
belongs in its initial changelog. Publish its manifest version directly after
verification; **do not run `bun run version-packages` before its first publication**, because it consumes
changesets and advances versions. Preparing a package does not publish it to npm.

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

- Grant maintainers publish access to the npm `@raypx` scope and confirm that the
  package name is available. GitHub organization access does not grant npm scope
  access.
- Configure npm trusted publishing for repository `raypx/packages`, workflow
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

An authorized maintainer can publish the first manifest versions directly after
`bun run verify`, with npm authentication configured:

```sh
NPM_CONFIG_FORCE=true bun run changeset publish
```

`bun run release` runs verification before the same scoped publication command.

Changesets uses npm for registry queries and publication. npm otherwise rejects
the repository's strict Bun `devEngines` configuration with `EBADDEVENGINES`.
The workflow scopes `force` to registry transport steps. Changesets selects the
packages and passes each package or tarball directly to npm. Do not set
`NPM_CONFIG_WORKSPACES=false`: npm can infer the current workspace and reject
that conflicting configuration.
Installation, versioning, verification and builds retain the Bun runtime checks.
No publish command is part of installation, normal build or artifact checking.

References: [Changesets configuration](https://changesets.dev/guide/config),
[automating releases](https://changesets.dev/guide/automating),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers).

## Adding a package

Add `packages/<name>` with its own manifest, README, license, strict type check,
test configuration and checked build. Publish compiled ESM and declarations with
explicit exports. Keep reusable code independent of product workspaces, declare
framework and ORM integrations as peers where appropriate, and retain provenance
for adapted source. Prefer public TypeScript entry files directly under `src/`,
with supporting implementation modules in subdirectories. Add the package to the
table above; do not create a fixed or linked Changesets group.

## License

Raypx Packages is Apache-2.0. Adapted upstream code retains its original copyright
and license; see package-root `NOTICE.md` and `LICENSE` where adapted code is used.
