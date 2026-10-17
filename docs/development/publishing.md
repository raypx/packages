# Publishing

Publication is always an explicitly authorized maintainer action. Packages are
`0.0.0-alpha.*` prereleases until the first stable release; see the
[Changesets workflow](changesets.md) for how versions advance.

Changesets 3.0.3 has publish tools for npm, pnpm and Yarn Berry only. In a Bun
workspace it packs with npm, which publishes `workspace:` and `catalog:`
dependencies verbatim. The release commands therefore pack each archive with
`bun pm pack`, the packer `pack:check` verifies, and let Changesets plan, publish
and tag those exact archives. Never run plain `changeset publish`.

## One-time setup

1. The GitHub repository is `raypx/voidmix`. Create its `npm` environment, adding
   reviewers if desired.
2. Create the npm organization `voidmix` and give maintainers publish access to
   the `@voidmix` scope. GitHub organization access does not grant npm access.
3. On the publishing machine, select Bun 1.4.3 and Node 24.15.0 from the root
   `packageManager` and `.nvmrc`, respectively. With mise, run
   `mise trust && mise install`, then activate it in the shell or use
   `mise exec -- <command>`. `mise.toml` only enables those sources and must not
   add `[tools]` versions. Install dependencies with
   `bun install --frozen-lockfile --ignore-scripts`, then run `bun run doctor`
   and `bun run toolchain:check` before `npm login --force`. npm normally requires
   a one-time password for publication. `TOOLKIT_NODE_BINARY` may select a Node
   executable outside PATH,
   but it must match `.nvmrc`. Public package compatibility ranges stay separate
   from these development pins.

## Manual alpha release

Run every step on an up-to-date `main` with a clean working tree.

The `voidmix-dev` CLI groups maintenance commands under one entry point:

```sh
bun run voidmix-dev release plan
bun run voidmix-dev release pack
bun run voidmix-dev release publish
```

The existing `release:plan`, `release:pack` and `release:publish` scripts remain
aliases. `doctor` and `toolchain:check` also remain available as aliases.
Place options after the final subcommand, such as `release pack --stable`.
The CLI uses citty; toolchain checks parse TOML and YAML with confbox. Both are
private repository tools and do not change the published libraries.

1. **Version.** Skip this step for a package's first publication. Otherwise run
   `bun run version-packages`, review the versions and changelogs, and commit
   them, for example as `chore: version packages`.
2. **Verify.** `bun run verify` first checks active runtimes with `doctor` and
   committed version consistency with `toolchain:check`, then formats, lints,
   type-checks, tests, builds and installs every packed library in isolated Bun
   and Node consumers.
3. **Plan.** `bun run release:plan` is read-only and never replaces a packed
   plan. It lists every version missing from npm with its dist-tag, fails unless
   each is a `@voidmix/*` package at an `-alpha.N` version, and reports
   changesets that still need `bun run version-packages`.
4. **Pack.** `bun run release:pack` refuses unreleased changesets, rebuilds
   stale package output through Turbo and packs each planned package with
   `bun pm pack`. It rejects archives that would still publish `workspace:`,
   `catalog:`, `file:` or `link:` dependencies, then installs and loads those
   exact archives in isolated Bun and Node consumers. Only after those checks
   pass does it record the packed commit. Output replaces only
   `.changeset/pack/release/`; inspect an archive with
   `tar -tzf .changeset/pack/release/packages/<archive>.tgz`.
5. **Publish.** `bun run release:publish` refuses a dirty tree, a branch other
   than `main`, a commit other than the packed one or a changed tarball, then
   publishes exactly the packed tarballs and creates local git tags. Append
   `--otp <code>` directly when npm asks for a one-time password, or set
   `NPM_CONFIG_OTP`. The CLI treats OTP codes as strings and preserves leading
   zeros. Pass additional Changesets arguments after `--`, as in
   `bun run voidmix-dev release publish -- <Changesets args>`. This also forwards
   `--help` to Changesets. With the `release:publish` alias and no preceding
   wrapper options, Bun consumes the leading separator; use
   `bun run release:publish -- -- <Changesets args>`.
6. **Push.** Run the `git push origin main <tags>` command the script prints for
   the tags it found locally, so each tag such as `@voidmix/env@0.0.0-alpha.0`
   reaches GitHub.
7. **Confirm.** Check `npm view @voidmix/<package> dist-tags` for every package.
   Until a package has a stable release, `latest` follows its newest prerelease:
   npm assigns `latest` at the first publication, and Changesets publishes later
   prereleases there too. After the first stable release, prereleases use only `alpha`.
   Consumers pin exact prerelease versions, so this does not change what they
   install.
8. **Consume.** In each consuming repository, pin the exact new version, refresh
   the lockfile and run that repository's verification gate.

When every version is already on npm, packing and publication succeed without
publishing anything. Packing and publication stay separate commands: packing
outlasts an npm one-time password, and the archives can be reviewed before upload.

## Consumer previews

Consumers such as Raypx try unreleased changes in two ways, neither of which
versions packages or creates tags.

**Local link.** Build once with `bun run build` (or keep `bun run dev` running in
the package), run `bun link` in `packages/<name>`, then `bun link @voidmix/<name>`
in the consumer. This changes only the consumer's `node_modules`; its next
`bun install` restores the registry version. The link resolves to this checkout,
so the consumer must dedupe singleton peers (`react`, `react-dom`, `use-intl`)
through Vite's `resolve.dedupe`, or React reports invalid hook calls. Metro does
not follow links outside its watch folders; preview native apps with a snapshot.

**Snapshot.** On any branch with a clean working tree:

```sh
bun run release:snapshot                 # packages named by unreleased changesets
bun run release:snapshot intl env        # or explicit packages
bun run release:snapshot --publish --otp <code>
```

The command builds, temporarily sets each package version to
`0.0.0-next-<UTC timestamp>-<commit>`, packs with `bun pm pack`, restores every
manifest and runs the same archive and isolated consumer checks as a release.
Archives stay in `.changeset/pack/snapshot/`. Only `--publish` uploads them, under
the `next` dist-tag, so `latest` and `alpha` never move. Snapshot versions sort
below every release. Consumers pin the exact printed version and replace it with
the released alpha before merging. Publishing a snapshot is a maintainer action
like any other publication. Packages that depend on sibling `@voidmix/*`
packages are refused, because a snapshot rewrites only its own version.

## CI publication

The release workflow publishes only after the first manual publication of each
package:

1. On npmjs.com, add a trusted publisher to every package: GitHub Actions,
   repository `raypx/voidmix`, workflow `release.yml`, environment `npm`. For a
   registry requiring tokens, set the `NPM_TOKEN` secret instead.
2. Set the repository variable `NPM_PUBLISH_ENABLED` to `true`.

On `main`, the workflow verifies, then runs the same `release:pack` and
`release:publish` commands for versions absent from npm, requesting provenance.
Pushes without new versions pass as no-ops. Optional version PRs are described
in the [repository README](../../README.md#independent-releases).

## First stable release

Leave pre mode only with explicit approval of the stable release:

```sh
bun run changeset pre exit
bun run version-packages   # every package graduates to 0.0.0
git commit -am "chore: release stable packages"
bun run release:pack --stable
bun run release:publish --stable
```

`--stable` is a direct CLI flag, as in
`bun run voidmix-dev release pack --stable`; it does not belong after `--`.
Without `--stable`, the release commands refuse to plan, pack or publish after
pre mode ends. Further prereleases require `bun run changeset pre enter <tag>`.

## Recovering from mistakes

- npm never accepts the same name and version twice, even after unpublishing.
  Fix forward with the next prerelease.
- If publication stops partway, run `bun run release:pack` again. The new plan
  contains only versions still missing from npm; then run
  `bun run release:publish`.
- Correct a dist-tag with `npm dist-tag add @voidmix/<package>@<version> <tag>`.
  Move `latest` only intentionally.
- `npm unpublish @voidmix/<package>@<version>` is limited to npm's unpublish
  window and to versions nothing depends on. Prefer fixing forward.
