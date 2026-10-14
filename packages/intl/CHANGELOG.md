# @voidmix/intl

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
