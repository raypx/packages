# Changesets

Every public package owns its version and changelog. `fixed` and `linked` are
empty: changing one package never forces unrelated packages to share its version.
Dependency compatibility can still require a dependent package to receive a bump.

Drizzle and Intl were first published at `0.0.0` directly from their package
manifests, with capability drafts consolidated into their initial changelogs.
Env was published from this repository at `0.0.6`, continuing its existing npm
release history rather than starting a new package at `0.0.0`.

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

See the root [README](../../README.md) for initial publication and CI setup.
