# @voidmix/intl

## 0.0.0-alpha.3

### Patch Changes

- f8e34e5: Add a controlled `LanguageProvider` and `useLanguagePreference` to bound clients, a `@voidmix/intl/browser` entry with `createBrowserLanguage` and browser preference and cookie adapters, and error-code translation helpers (`readErrorDetails`, `translateErrorCode`, `translateKnownErrorCode`).

## 0.0.0-alpha.2

### Patch Changes

- bfffc6e: Bundle `use-intl` 4.14.9 and its FormatJS dependencies, including declarations, so React is the only peer. Applications no longer declare `use-intl`.

## 0.0.0-alpha.1

### Patch Changes

- 34bf76b: Replace stateful and isolated client factories with controlled native IntlProvider integration. Bind catalog types with createIntlClient<Messages>()(runtime, defaults), provide the current locale/catalog explicitly, and use nearest-provider upstream hooks. Remove async/state/storage providers and the numeric relative-time API; createFormatter now accepts an object configuration.

  Preserve upstream translator key, namespace and ICU value inference, add translated CatalogShape types, ordered system-language matching and strict device-preference parsing. Use structural server headers, consistently validate fallbacks, and report ICU tag/syntax differences with the actual failing catalog side. Require use-intl 4.14.9 or newer within major version 4.

## 0.0.0-alpha.0

Initial prerelease.

- Configurable, immutable locale runtimes with weighted language negotiation,
  regional lookup, custom cookies and request resolution.
- ICU translators and upstream formatters with UTC defaults and extensible named
  date, number, list and relative-time formats.
- Use `use-intl` 4.14.9 for translation, formatting and `IntlProvider`, with React
  as a required peer for all consumers, including core and server usage.
- Keep UTC defaults and namespace-qualified message fallbacks, with explicit
  upstream error/fallback configuration and no default diagnostic logging.
- Isolated React provider factories, synchronous and async catalog providers,
  locale hooks and configurable browser storage adapters.
- Recursive catalog parity and ICU argument checks in a separate testing entry.
- Adapt first-party Raypx i18n into a generic package with application-owned
  locales, catalogs and persistence keys. Keep third-party runtime dependencies
  external under their original licenses.
