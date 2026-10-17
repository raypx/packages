# Migrating to controlled Intl providers

This breaking alpha update keeps `use-intl` as the translation, formatting and
React runtime. It removes the state, persistence and asynchronous loading layer
previously owned by `@voidmix/intl`.

## Responsibilities

| Owner           | Responsibilities                                                                             |
| --------------- | -------------------------------------------------------------------------------------------- |
| `use-intl`      | ICU execution, rich text, formatters, React context and caches                               |
| `@voidmix/intl` | Immutable locale configuration, negotiation, typed adapters, defaults and catalog validation |
| Application     | Messages, loading, preference state, storage, SSR data and platform initialization           |

The core and server entry points have no DOM ambient type requirement. React 19
remains a required peer, including for core and server imports. The minimum
supported `use-intl` is 4.14.9.

## React migration

Bind a static catalog type once, then supply the active catalog on each render:

```tsx
import { createLocaleRuntime } from "@voidmix/intl";
import { createIntlClient } from "@voidmix/intl/client";

const en = { account: { greeting: "Hello {name}" } } as const;
const runtime = createLocaleRuntime({
  locales: ["en", "zh"] as const,
  defaultLocale: "en",
});
const intl = createIntlClient<typeof en>()(runtime, { timeZone: "UTC" });

function Account() {
  const t = intl.useTranslations("account");
  return <h1>{t("greeting", { name: "User" })}</h1>;
}

function App() {
  return (
    <intl.IntlProvider locale="en" messages={en}>
      <Account />
    </intl.IntlProvider>
  );
}
```

Replace `LocaleProvider`, `I18nProvider` and `AsyncI18nProvider` with
`IntlProvider`. Both `locale` and `messages` are required. Pass `messages={null}`
for a formatter-only subtree. Move setters and storage to application state, and
load messages in the application loader before rendering the provider. The SDK
does not expose `useSetLocale`, storage factories, loader contracts or an async
cache. There is one upstream context, so all hooks read the nearest provider,
including one created by another factory. A factory binds types; callers must
keep the actual provider's catalog and locale compatible with those types.

Options are merged at the provider boundary: package defaults, factory defaults,
then explicit props. Format presets merge by category and name; a later same-name
definition replaces the earlier definition. `useFormatter()` no longer takes
options. Supply overrides to the provider or to an upstream formatting call.
Supply `now` as a render prop; it is not a static factory default.

## Type migration

Keep the default catalog's literal message types (`as const`). Namespace, key,
ICU variable and rich tag callback types are inferred by `createTranslator` and
`useTranslations`. Use `CatalogShape<typeof en>` to validate translated catalog
structure without requiring translated strings to equal the source language.
Catalog checks separately validate ICU syntax, argument names and rich tag names.
Plural categories and tag nesting can differ between languages.

Runtime catalogs must deliberately use the wide `DynamicMessages` type. There is
no permissive overload to accept unknown keys on a statically typed translator.
When consuming backend error codes, map them to known keys, sanitize external
values and isolate any unavoidable dynamic value bridge in one application helper.

## Formatting migration

Call `createFormatter({ locale, ...options })` instead of passing locale
positionally. Its result is the upstream formatter. For relative time use a date
or timestamp with an explicit reference, for example:

```ts
const format = createFormatter({ locale: "en", now: new Date("2026-01-02T00:00:00Z") });
format.relativeTime(new Date("2026-01-01T00:00:00Z"));
```

Remove numeric-delta/unit calls and the `relativeTime.numeric` preset. Custom
per-method `RangeError` wrappers are gone. UTC, silent error handling and the
namespace-qualified key fallback remain defaults. There is no automatic merging
of another language's catalog when a message is missing.

## Locale and SSR migration

`runtime.parsePreference(value)` validates an exact configured locale or returns
`"system"`. `runtime.matchLocale(candidates)` performs ordered lookup and can
return `undefined`. `runtime.resolvePreference(preference, candidates)` applies
explicit preference, then ordered system candidates, then the configured default.
The `system` token is reserved and cannot be a configured locale.

Use all browser or native system locales, not only the first one. For example,
with English and Chinese supported, `["fr-FR", "zh-CN"]` resolves to Chinese.
Server helpers accept a structural `HeaderReader` and use the same negotiation.
The hint helper retains `undefined` when there is no supported request hint.

Keep locale, catalog and reference time in request loader data. Immutable catalog
modules may be shared across requests; mutable request state may not. Use the
same loader snapshot for HTML and the first hydration render, then restore
browser storage in an effect. Persist the preference mode rather than the
resolved system language. The SDK does not prescribe cookie or storage ownership.

## Release checks

Run package tests before the repository verification gate. `pack:check` installs
the actual archive in disposable Bun and Node consumers and runs the package's
public declaration contract with `skipLibCheck: false`, no DOM libraries and no
ambient Node types. Negative type cases must fail if their `@ts-expect-error`
directives are removed. Source aliases are not a substitute for this check.

Stay in Changesets alpha mode. Publish only after explicit authorization; then
consumers pin the exact new alpha and refresh their lockfiles. A consumer that
uses the controlled API while pinning the old published package is not ready to
merge or deploy.
