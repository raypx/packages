# @voidmix/intl

Typed ICU translation and controlled React integration built on `use-intl`, with
application-owned locale configuration and catalogs.

```sh
bun add @voidmix/intl react@19
```

ESM and declarations support Node 20+ and Bun. React 19 is the only external
peer, including for synchronous root/server usage. `use-intl` 4.14.9 and its
FormatJS dependencies are bundled into `dist/`, declarations included, through
their public `use-intl/core` and `use-intl/react` APIs. Import translation, formatting and
provider APIs from `@voidmix/intl` only. Installing `use-intl` or `next-intl`
next to it creates a second, unconnected React context.

## Configure locales and device preferences

```ts
import { createLocaleRuntime } from "@voidmix/intl";

export const localeRuntime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"] as const,
  defaultLocale: "en",
  cookieName: "site_locale",
  cookieMaxAgeSeconds: 60 * 60 * 24 * 365,
});
type Locale = (typeof localeRuntime.locales)[number];

localeRuntime.normalizeLocale("zh-Hans-CN"); // "zh"
localeRuntime.matchLocale(["fr-FR", "de-DE-u-ca-gregory", "zh"]); // "de-DE"
const preference = localeRuntime.parsePreference("zh-CN"); // "system"
localeRuntime.resolvePreference(preference, ["fr-FR", "zh-SG"]); // "zh"
```

Runtime configuration is copied and frozen. Supported tags match after
canonicalization; lookup removes region, script and extension subtags until an
explicitly configured tag matches. `de` does not invent `de-DE`. `isLocale`
checks exact configured values. `system` is reserved and cannot be a locale.

`parsePreference(unknown)` accepts exact supported values, returning `system`
for missing, malformed or unsupported values. It never normalizes a persisted
regional hint into an explicit preference. `resolvePreference(preference,
locales)` uses an explicit supported preference first, then the first matching
system candidate in order, then the configured default. Applications own
preference state, or use the optional controlled
[LanguageProvider](#control-the-language-preference) and
[browser adapters](#persist-browser-preferences).

`resolveLocale` prioritizes a supported explicit cookie value, weighted
`Accept-Language`, an optional validated fallback, then the configured default.
Cookie parsing reads only the configured name, skips malformed duplicates and
normalizes valid hints. `serializeLocaleCookie(locale, { secure: true })` adds
`Path=/`, `SameSite=Lax`, `Max-Age` and optional `Secure`.

## Bind a controlled React client

```tsx
import { createIntlClient } from "@voidmix/intl/client";
import type { CatalogShape } from "@voidmix/intl/types";
import { localeRuntime } from "./locale-runtime.js";

const en = {
  home: { greeting: "Hi {name}", count: "{count, number}" },
} as const;
const zh = {
  home: { greeting: "你好，{name}", count: "{count, number}" },
} satisfies CatalogShape<typeof en>;

export const {
  IntlProvider,
  useLocale,
  useTranslations,
  useFormatter,
  useNow,
  useTimeZone,
  useMessages,
} = createIntlClient<typeof en>()(localeRuntime, { timeZone: "UTC" });

function App({ locale }: { locale: "en" | "zh" }) {
  return (
    <IntlProvider locale={locale} messages={locale === "zh" ? zh : en}>
      <Greeting />
    </IntlProvider>
  );
}
function Greeting() {
  const t = useTranslations("home");
  return <p>{t("greeting", { name: "Ada" })}</p>;
}
```

The factory binds catalog/locale types and static defaults. It owns no locale
state, catalog loader, storage, subscriptions or React context. `locale` and the
current `messages` catalog are required; `messages={null}` supports formatting
without translations and explicitly prevents inheriting an outer catalog.
Changing props updates the upstream provider directly.

Hooks delegate to the native hooks and read the **nearest** `IntlProvider`, even
when the hook came from a different factory. The active provider must match the
hook's declared locale/catalog model. A type binding does not establish a
runtime provider identity. No global `AppConfig` augmentation is required.

`CatalogShape<Base>` preserves readonly keys while widening translated string
leaves. It accepts translated text without locking it to the base-language
literals. `MessagesByLocale<Locale, Base>` checks complete static catalogs.
Namespaces, message keys, required ICU values, numeric/date values and rich-text
callbacks are inferred from the literal base catalog. Dynamic catalogs can use
`createIntlClient()` without a schema binding. `useMessages` returns the current
translated shape; it does not claim to return the base-language literals.

Provider props support upstream `now`, `timeZone`, `formats`, `onError` and
`getMessageFallback`. Static factory defaults exclude `now`; applications can
supply a request or render snapshot explicitly. `useNow` retains the upstream
interval option; `useFormatter` takes no hook-level configuration argument.
For lazy catalogs, the application loader must load the selected catalog and
publish a consistent locale/catalog snapshot before rendering this provider.
Request-selected locale/messages must never be stored in mutable module globals.

## Control the language preference

The bound client also returns a controlled `LanguageProvider` and
`useLanguagePreference`. The application passes the stored preference, the
device languages and every locale's catalog; the provider resolves the locale
with `resolvePreference` and mounts that catalog.

```tsx
const { LanguageProvider, useLanguagePreference } = createIntlClient<typeof en>()(localeRuntime);

function Root({ preference, setPreference }: Props) {
  return (
    <LanguageProvider
      preference={preference}
      systemLocales={deviceLanguages}
      messages={{ en, zh }}
      onPreferenceChange={setPreference}
    >
      <App />
    </LanguageProvider>
  );
}
function Picker() {
  const { preference, setPreference, hydrated } = useLanguagePreference();
  // ...
}
```

It owns no state: `onPreferenceChange` receives choices and the application
stores them. `hydrated` (default `true`) reports whether device preferences were
restored. Remaining props such as `timeZone` and `formats` reach `IntlProvider`.
`useLanguagePreference` throws outside a `LanguageProvider`.

## Persist browser preferences

```tsx
import { createBrowserLanguage } from "@voidmix/intl/browser";

export const { BrowserLanguageProvider, preferences, getBrowserSystemLocales } =
  createBrowserLanguage(client, localeRuntime, {
    messages: { en, zh },
    storageKey: "site_locale",
    legacyStorageKeys: ["old_locale"],
  });

<BrowserLanguageProvider
  initialPreference={cookiePreference}
  initialSystemLocales={requestLanguages}
>
  <App />
</BrowserLanguageProvider>;
```

The server and the first client render use only the initial snapshot, so
hydration matches. After mount the provider restores `localStorage` (migrating
the first valid legacy key only after the new write succeeds, and otherwise
keeping a cookie-only choice), reads `navigator.languages`, follows
`languagechange` and `storage` events from other windows and sets
`<html lang>`. Explicit choices are mirrored into the runtime's locale cookie;
`system` deletes it so servers follow `Accept-Language`. Blocked storage or
cookies never throw. Pass `restorePreference={false}` when a native shell owns
the stored value. `preferences` exposes the same `read`, `restore`, `write` and
`storeCookie` adapters, and the entry touches no DOM global at import.

## Translate error codes

```ts
import { translateErrorCode, translateKnownErrorCode } from "@voidmix/intl";

const message = translateErrorCode(error, t, { NOT_FOUND: "errors.missing" }, "errors.unknown");
```

`readErrorDetails` reads a `code` and optional ICU `values` from an error or an
RPC payload (`data.error`) without trusting its shape: only own properties are
read, non-finite numbers, invalid dates, objects and prototype keys are dropped,
and throwing accessors return `undefined`. `translateErrorCode` maps the code
through an own-property table to a translator key, falling back for unknown
codes; `translateKnownErrorCode` returns `null` instead. Keys are checked
against the translator's message keys.

## Translate and format outside React

```ts
import { createFormatter, createTranslator } from "@voidmix/intl";

const t = createTranslator({
  locale: "en",
  namespace: "home",
  messages: { home: { greeting: "Hi {name}" } },
});
t("greeting", { name: "Ada" });

const formatter = createFormatter({
  locale: "en",
  formats: { number: { money: { style: "currency", currency: "EUR" } } },
});
formatter.number(2, "money"); // "€2.00"
formatter.relativeTime(new Date("2026-10-15T00:00:00Z"), {
  now: new Date("2026-10-16T00:00:00Z"),
  unit: "day",
});
```

Both factories return native upstream callables, preserving their methods and
generic signatures. The translator exposes `rich`, `markup`, `raw` and `has`.
The formatter exposes `dateTime`, `dateTimeRange`, `number`, `list`,
`displayName` and date-based `relativeTime`, including native per-call overrides.

A shared pure configuration boundary applies UTC, quiet error handling and named
presets: `dateTime.short`, `number.compact`, `list.conjunction`. Custom named
presets replace individual definitions while retaining other presets. Date and
number definitions are normalized to prevent FormatJS built-in styles from
leaking fields into a replacement. Unknown-format handling belongs to upstream
`onError` and fallback behavior; no wrapper adds a `RangeError` policy.
Missing/invalid translations use the namespace-qualified key unless configured
otherwise. Dynamic catalogs can be annotated `DynamicMessages`; literal
catalogs retain strict key and value inference. Runtime error payloads remain a
caller-owned validation boundary rather than a compile-time ICU guarantee.

## Resolve server hints

```ts
import { createIntlServer } from "@voidmix/intl/server";
import { localeRuntime } from "./locale-runtime.js";

const server = createIntlServer(localeRuntime);
server.resolveRequestLocale(request.headers);
server.resolveRequestLocaleHint(request.headers); // undefined without a supported hint
server.resolveConfiguredLocale(process.env.MAIL_LOCALE);
```

Headers need only satisfy `HeaderReader`, whose `get(name)` returns
`string | null`. Public declarations do not require the DOM `Headers` global.
Hints preserve the distinction between no preference and the default locale.
Explicit fallbacks are validated even when the request already has a valid hint.
No framework or process environment is read by the library.

## Validate catalogs

```ts
import {
  assertMessageCatalogParity,
  extractIcuArguments,
  extractIcuSignature,
} from "@voidmix/intl/testing";

assertMessageCatalogParity({ title: "Hi {name}" }, { title: "你好，{name}" }, "en", "zh");
extractIcuArguments("<strong>{name}</strong>"); // ["name"]
extractIcuSignature("<strong>{name}</strong>");
// { arguments: ["name"], tags: ["strong"] }
```

Catalog checks compare recursive keys, object/string shape, ICU syntax,
argument names and rich-text callback names. Ordering, nesting and
language-specific plural categories may differ. They do not require identical
formatting styles or formatter kinds across languages. Parse issues identify
the actual failing locale, path and side. The separate `/testing` entry uses
`@formatjs/icu-messageformat-parser`; runtime compilation remains upstream.

## Breaking migration

- Keep `/client`, but call `createIntlClient<Base>()(runtime, defaults)`.
- Replace `I18nProvider`, `LocaleProvider` and `AsyncI18nProvider` with the
  controlled `IntlProvider` and an explicit current catalog.
- Move locale setters, preference persistence and async catalog coordination to
  the application. Storage factories and storage/loader contracts were removed.
- Hooks now use the nearest native provider; cross-factory context isolation is
  no longer supported.
- Use `createFormatter({ locale, ...options })` and upstream date-based
  relative-time formatting. The numeric/unit overload and `relativeTime.numeric`
  preset were removed.
- Literal catalogs now reject misspelled namespaces/keys and invalid ICU values.
  Keep runtime-data translation bridges small and explicit.

Exports remain `.`, `/client`, `/server`, `/types` and `/testing`. Third-party
source is not vendored. Apache-2.0 applies to this package's implementation.
