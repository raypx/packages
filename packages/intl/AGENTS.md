# @voidmix/intl

## Purpose

Publish configurable locale negotiation, Intl formatting, ICU translation,
React providers and catalog testing helpers without product dependencies.

## Interface

```text
@voidmix/intl         createLocaleRuntime, formatter, translator, presets and types
@voidmix/intl/client  createIntlClient, providers, hooks and storage factories
@voidmix/intl/server  createIntlServer and synchronous translator factory
@voidmix/intl/types   type-only runtime contracts
@voidmix/intl/testing recursive catalog parity and ICU argument helpers
```

## Ownership

- Applications configure supported locales, default locale and persistence keys.
  Never introduce Raypx language constants, business catalogs, legacy storage
  migrations, environment imports, or API error envelope interpretation here.
- Runtime configuration is immutable and isolated per factory. Preserve exact
  supported locale types throughout providers, loaders and storage contracts.
- `use-intl` 4.14.9 owns translation, formatting and `IntlProvider`. Use its
  public core/provider APIs; do not recreate message compilation, formatter
  caches or provider runtime. React 19 is a required peer for the package,
  including root and server consumers. Catalog helpers remain in `testing`.
- The library owns configurable locale negotiation, persistence, async catalog
  loading and factory isolation around the upstream runtime. Product catalogs
  and transport behavior stay with consumers.
- Formatter and translator timezone defaults to UTC. Custom presets override
  individual names while preserving defaults. Provider options flow through
  both translations and the standalone formatter. Missing/invalid messages use
  the namespace-qualified key by default; `onError` defaults to no logging.
  Consumers may explicitly configure `onError`, `getMessageFallback` and `now`.
- Locale changes update state and persistence before document synchronization.
  Async providers cache in-flight catalog loads, commit locale/catalog together
  and allow retries after failures. Each client factory owns its React context.
- Independent package versioning follows the root Changesets configuration.

## Verification

```bash
bun run --cwd packages/intl check
bun run --cwd packages/intl test
bun run verify
```

Core tests use Node environment; client tests own a jsdom project. Keep DOM
setup and Bun-specific jsdom compatibility local to tests. Packing includes
built ESM and declarations, never tests or application catalog files.
