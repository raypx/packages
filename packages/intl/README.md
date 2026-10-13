# @raypx/intl

Configurable locale negotiation, ICU translation, Intl formatting, isolated
React providers and catalog testing helpers. Each application supplies its
languages, catalogs and persistence keys.

Translation, formatting and `IntlProvider` are provided by `use-intl` 4.14.9.
React 19 is a required peer for this package, including root and server usage.
The library supplies configurable locale negotiation, persistence, async catalog
loading and client factory isolation around the upstream runtime.

## Configure a locale runtime

```ts
import { createLocaleRuntime } from "@raypx/intl";

export const localeRuntime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"] as const,
  defaultLocale: "en",
  cookieName: "site_locale",
  cookieMaxAgeSeconds: 60 * 60 * 24 * 365,
});

type Locale = (typeof localeRuntime.locales)[number];

localeRuntime.normalizeLocale("zh-Hans-CN"); // "zh"
localeRuntime.normalizeLocale("de_de"); // "de-DE"
localeRuntime.resolveLocale({ acceptLanguage: "de-DE;q=0.9, en;q=0.8" });
localeRuntime.serializeLocaleCookie("zh", { secure: true });
```

Configuration is copied and frozen. Supported tags match case-insensitively
after canonicalization, and lookup removes regional/script/extension subtags
until a configured tag matches. It does not infer an unconfigured region:
`de` does not match a configuration containing only `de-DE`. `isLocale`
checks exact configured values; `normalizeLocale` returns those values.

Locale resolution prioritizes a valid explicit cookie value, weighted
`Accept-Language` preferences, an optional supported fallback and the configured
default. Malformed tags, zero quality preferences and unsupported languages are
ignored. Cookie parsing reads only the configured name and skips malformed
duplicates. Serialization adds `Path=/`, `SameSite=Lax`, the configured max age
and optional `Secure`; a cookie name must be a valid HTTP token.

## Translate and format

```ts
import { createFormatter, createTranslator } from "@raypx/intl";

const translate = createTranslator({
  locale: "en",
  namespace: "home",
  messages: {
    home: {
      greeting: "Hi {name}",
      count: "{count, plural, one {# item} other {# items}}",
    },
  },
});

translate("greeting", { name: "Ada" }); // "Hi Ada"
translate("count", { count: 3 }); // "3 items"

const formatter = createFormatter("en", {
  timeZone: "Europe/Berlin",
  formats: { number: { money: { style: "currency", currency: "EUR" } } },
});

formatter.number(2, "money"); // "€2.00"
formatter.number(1200, "compact"); // "1.2K"
formatter.relativeTime(-1, "day", "numeric"); // "yesterday"
formatter.list(["A", "B"], "conjunction"); // "A and B"
```

Formatters and translators delegate to the public `use-intl/core` factories
and default to UTC. Custom format definitions replace individual presets while
retaining other defaults such as `short`, `compact`, `conjunction` and `numeric`.
Unknown named formatter presets throw `RangeError`.
Message compilation, formatter caches and upstream formatting behavior belong
to `use-intl`; this package does not maintain a second engine or formatter cache.

The default translation fallback is the namespace-qualified message key for
missing messages, invalid ICU syntax or missing interpolation values. The
library configures a silent default `onError`; callers can supply `onError`,
`getMessageFallback` and `now` through the public upstream configuration options.
The translator also exposes upstream `rich`, `markup`, `has` and `raw` methods
and per-call format overrides. Formatter APIs include `dateTimeRange`,
`displayName`, React element lists and date-based relative-time formatting.
The existing numeric `relativeTime(value, unit, format)` call remains a compatibility
adapter so configured numeric/rounding behavior is preserved.

## Resolve server locales

```ts
import { createIntlServer } from "@raypx/intl/server";
import { localeRuntime } from "./locale-runtime.js";

const server = createIntlServer(localeRuntime);
server.resolveRequestLocale(request.headers);
server.resolveRequestLocaleHint(request.headers); // undefined without a valid hint
server.resolveConfiguredLocale(process.env.MAIL_LOCALE);
```

The optional hint resolver preserves application-owned defaults such as a mail
recipient's preference. Any object with a `Headers`-compatible `get` method can
be used; the package never imports a framework or reads environment variables.

## Use isolated React providers

```tsx
import {
  createIntlClient,
  createBrowserLocaleStorage,
  createLocalStorageLocaleStorage,
} from "@raypx/intl/client";
import { localeRuntime } from "./locale-runtime.js";

export const {
  I18nProvider,
  AsyncI18nProvider,
  LocaleProvider,
  useLocale,
  useSetLocale,
  useTranslations,
  useFormatter,
} = createIntlClient(localeRuntime);

const cookieStorage = createBrowserLocaleStorage(localeRuntime);
const desktopStorage = createLocalStorageLocaleStorage(localeRuntime, {
  key: "site_locale",
});

const messages = {
  en: { greeting: "Hello" },
  zh: { greeting: "你好" },
  "de-DE": { greeting: "Hallo" },
};

function Root() {
  return (
    <I18nProvider locale="en" messages={messages} storage={cookieStorage}>
      <Greeting />
    </I18nProvider>
  );
}

function Greeting() {
  const translate = useTranslations();
  return <p>{translate("greeting")}</p>;
}
```

Create each client factory once at module scope. The providers delegate
translation, formatting and message context to upstream `IntlProvider`.
Separate factories keep their locale/catalog ownership isolated and can coexist
when embedded applications configure different languages. Their own hooks read
factory-local contexts and call public core factories; direct `use-intl` hooks
follow the nearest upstream `IntlProvider`. `LocaleProvider` supplies locale state without catalogs; the
synchronous `I18nProvider` accepts a complete `MessagesByLocale<Locale>` map.
The async provider accepts the application-owned catalog loader contract and
switches locale/catalog together after loading. Rejected loads can be retried;
overlapping requests preserve the newest selection.

Providers support a custom storage adapter, `timeZone`, `formats`, upstream
error/fallback options and a document synchronization callback. The package does not modify document metadata unless
the caller provides that callback. Cookie storage follows runtime cookie
settings; localStorage requires an explicit key. Storage access failures are
handled as unavailable persistence. Product-specific migration keys and error
envelopes belong to the application.

## Check catalog parity

```ts
import { assertMessageCatalogParity, extractIcuArguments } from "@raypx/intl/testing";

assertMessageCatalogParity({ greeting: "Hi {name}" }, { greeting: "你好，{name}" }, "en", "zh");
extractIcuArguments("{count, plural, one {# item} other {# items}}"); // ["count"]
```

Recursive key, string/object shape and ICU argument checks produce stable sorted
paths. These catalog validation helpers are isolated in `/testing`, using
`@formatjs/icu-messageformat-parser` for catalog inspection. Runtime message
compilation is owned by `use-intl`. Type-only public contracts are available in `/types`.

## Compatibility and dependencies

Published entries are ESM with TypeScript declarations, for Node 20+ and Bun.
`use-intl` 4.14.9 is the translation, formatting and provider dependency; React 19
is a required peer, including for server and root/core consumers. Install React
even when using only synchronous server translation or formatting. `/client`
groups provider/hooks/browser APIs rather than making React optional.
`@formatjs/icu-messageformat-parser` supplies the isolated `/testing` validation
helpers. The package contains no Raypx catalogs, business configuration,
framework adapters or application package imports.

This package adapts first-party Raypx i18n code into a configurable library.
Third-party libraries remain external dependencies under their own licenses;
their source has not been vendored into this package. Apache-2.0 applies to this
package's implementation.
