# Raypx Packages Documentation

Capability inventories and extension designs live here. Package READMEs describe
the APIs currently shipped to consumers; inventory entries and proposed APIs do
not imply that those features are implemented.

This directory also owns the Fumadocs site. Run `bun run docs:dev` at the repository
root to browse this material at `http://localhost:3100/docs`. The site renders
these canonical Markdown files and the package guides directly, with
navigation, full-text search, source links and light/dark themes.

## Drizzle

- [Current API](../packages/drizzle/README.md)
- [drizzle-plus capability inventory](drizzle/drizzle-plus-capabilities.md)
- [better-drizzle capability inventory](drizzle/better-drizzle-capabilities.md)
- [Merge and extension design](drizzle/merge-plan.md)
- [Source provenance and licenses](../packages/drizzle/NOTICE.md)

The implementation targets PostgreSQL through postgres.js. The inventories
retain all upstream capabilities, including features outside that scope.

## Intl

- [Current API and locale integration](../packages/intl/README.md)

## Development and releases

- [Repository setup and independent releases](../README.md)
- [Changesets workflow](development/changesets.md)

Design documents are repository references and are excluded from npm archives.
Package archives retain their API README, changelog, license and applicable
source notices and license texts.
