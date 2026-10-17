---
"@voidmix/intl": patch
---

Replace stateful and isolated client factories with controlled native IntlProvider integration. Bind catalog types with createIntlClient<Messages>()(runtime, defaults), provide the current locale/catalog explicitly, and use nearest-provider upstream hooks. Remove async/state/storage providers and the numeric relative-time API; createFormatter now accepts an object configuration.

Preserve upstream translator key, namespace and ICU value inference, add translated CatalogShape types, ordered system-language matching and strict device-preference parsing. Use structural server headers, consistently validate fallbacks, and report ICU tag/syntax differences with the actual failing catalog side. Require use-intl 4.14.9 or newer within major version 4.
