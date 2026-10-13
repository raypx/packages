# Documentation Site

## Purpose

An English Fumadocs site for Raypx Packages. This private application does not
publish to npm or change the independent versions of the libraries.

## Interface

`/docs` contains the overview, Drizzle and Intl API guides, complete capability
inventories, extension designs and maintainer documentation. Search is generated
from the same content and operates without a third-party service.

## Ownership

- Render the canonical root and package Markdown through Fumadocs.
- Keep navigation, table of contents, source links, search and theme controls usable.
- Compile canonical Markdown directly through Fumadocs; keep page routes and
  navigation in `src/lib/pages.ts`. Do not commit generated build artifacts.
- Keep all library source, package versions and npm payloads outside this app.

## Constraints

- Use TanStack Start, Fumadocs and the repository Bun/Vite+/Turbo toolchain.
- Preserve current versus proposed API status, source provenance and all inventory rows.
- Resolve Markdown links against their canonical source during compilation;
  registered pages use site routes and other repository files link to GitHub.
- Use lazy content loading and a static search index, with no production database,
  authentication, external search provider or application environment dependency.
- Keep the UI in English and retain localized message examples in their intended languages.
- Respect light/dark themes, keyboard access and reduced-motion preferences.

## Verification

```sh
bun run docs:check
bun run docs:build
bun run verify
```

Use `bun run docs:dev` for development at `http://localhost:3100`.
