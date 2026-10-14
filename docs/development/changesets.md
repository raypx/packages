# Changesets

Every public package owns its version and changelog. `fixed` and `linked` are
empty: changing one package never forces unrelated packages to share its version.
Dependency compatibility can still require a dependent package to receive a bump.

The repository is in pre mode with the `alpha` tag, recorded in
`.changeset/pre.json`. Every package starts at `0.0.0-alpha.0`, with its initial
work recorded in its initial changelog. In pre mode, versioning produces the
next `alpha.N` prerelease for changed packages only. Until a package has a
stable release, `latest` follows its newest prerelease: npm assigns `latest` at
the first publication, and Changesets publishes later prereleases there too.
After the first stable release, prereleases use only `alpha`. Exiting pre mode
graduates every package to stable `0.0.0`; do so only for an explicitly approved
first stable release. `bun run release:check` exercises these rules in a
disposable fixture, so a Changesets upgrade that changes them fails verification.

For a new package, publish its initial manifest version after verification without
running `bun run version-packages` first; that command would bump the version.

After the initial publication, for a user-visible change, run `bun run changeset`, select the affected packages,
choose a SemVer bump, and describe the resulting behavior. Commit the generated
Markdown file with the change. For a change requiring no release, use
`bun run changeset --empty` when a release reviewer requests an explicit marker.

`bun run version-packages` consumes changesets, updates package versions and
changelogs, refreshes `bun.lock`, and formats the result. With
`VERSION_PR_ENABLED=true` and Actions PR creation permitted, CI creates a version
PR from this command. Merge that PR when the versions are ready for publication.

See the [publishing runbook](publishing.md) for manual and CI publication.
