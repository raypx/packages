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
3. On the publishing machine, use Bun 1.4.0 and Node 24, then run `npm login`.
   npm normally requires a one-time password for publication.

## Manual alpha release

Run every step on an up-to-date `main` with a clean working tree.

1. **Version.** Skip this step for a package's first publication. Otherwise run
   `bun run version-packages`, review the versions and changelogs, and commit
   them, for example as `chore: version packages`.
2. **Verify.** `bun run verify` formats, lints, type-checks, tests, builds and
   installs every packed library in isolated Bun and Node consumers.
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
   `--otp <code>` when npm asks for a one-time password, or set
   `NPM_CONFIG_OTP`.
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
publishing anything. `bun run release` runs verification, packing and
publication in sequence. Use the individual commands when npm needs a one-time
password or the archives need review.

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
