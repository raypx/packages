import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations as useUpstreamTranslations } from "use-intl/react";
import { createLocaleRuntime, createFormatter, createTranslator } from "@voidmix/intl";
import { createIntlClient, createLocalStorageLocaleStorage } from "@voidmix/intl/client";
import { createIntlServer } from "@voidmix/intl/server";
import {
  extractIcuArguments,
  compareMessageCatalogs,
  assertMessageCatalogParity,
} from "@voidmix/intl/testing";
const runtime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"],
  defaultLocale: "en",
  cookieName: "demo_locale",
  cookieMaxAgeSeconds: 3600,
});
assert.equal(runtime.normalizeLocale("DE_de"), "de-DE");
assert.equal(runtime.normalizeLocale("fr"), undefined);
assert.ok(runtime.serializeLocaleCookie("zh").startsWith("demo_locale=zh;"));
assert.ok(runtime.serializeLocaleCookie("zh").includes("Max-Age=3600"));
const server = createIntlServer(runtime);
assert.equal(
  server.resolveRequestLocale(
    new Headers({ cookie: "demo_locale=de-DE", "accept-language": "zh;q=1" }),
  ),
  "de-DE",
);
assert.equal(
  server.resolveRequestLocale(new Headers({ "accept-language": "fr;q=1, de-DE;q=0.8, zh;q=0.5" })),
  "de-DE",
);
assert.equal(server.resolveRequestLocaleHint(new Headers()), undefined);
assert.equal(server.resolveConfiguredLocale("DE_de"), "de-DE");
assert.equal(server.resolveConfiguredLocale(undefined, "zh"), "zh");
const formatter = createFormatter("de-DE", {
  formats: {
    number: { money: { style: "currency", currency: "EUR" } },
    dateTime: { day: { day: "numeric", timeZone: "UTC" } },
    relativeTime: { strict: { numeric: "always" } },
  },
});
assert.equal(
  formatter.number(2, "money"),
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(2),
);
assert.equal(
  formatter.number(2000, "compact"),
  new Intl.NumberFormat("de-DE", { notation: "compact" }).format(2000),
);
assert.equal(formatter.dateTime(new Date("2026-10-13T00:00:00Z"), "day"), "13");
assert.equal(
  formatter.relativeTime(-1, "day", "strict"),
  new Intl.RelativeTimeFormat("de-DE", { numeric: "always" }).format(-1, "day"),
);
const translate = createTranslator({
  locale: "de-DE",
  messages: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" },
});
assert.equal(translate("greeting", { name: "Ada" }), "Hallo Ada");
assert.equal(translate.has("greeting"), true);
assert.equal(translate.has("missing"), false);
assert.equal(translate.raw("greeting"), "Hallo {name}");
assert.equal(
  translate.markup("rich", { name: "Ada", b: (chunks) => "<strong>" + chunks + "</strong>" }),
  "Hallo <strong>Ada</strong>",
);
assert.equal(
  typeof formatter.dateTimeRange(
    new Date("2026-10-13T00:00:00Z"),
    new Date("2026-10-14T00:00:00Z"),
  ),
  "string",
);
assert.equal(
  formatter.displayName("de", { type: "language" }),
  new Intl.DisplayNames("de-DE", { type: "language" }).of("de"),
);
assert.deepEqual(
  extractIcuArguments("{count, plural, one {# file for {name}} other {# files for {name}}}"),
  ["count", "name"],
);
assert.deepEqual(
  compareMessageCatalogs({ greeting: "Hello {name}" }, { greeting: "Hallo {name}" }),
  [],
);
assert.throws(() =>
  assertMessageCatalogParity({ greeting: "Hello {name}" }, { greeting: "Hallo {other}" }),
);

const { I18nProvider, useTranslations } = createIntlClient(runtime);
function Greeting() {
  const t = useTranslations("home");
  const upstream = useUpstreamTranslations("home");
  assert.equal(upstream("greeting", { name: "Ada" }), t("greeting", { name: "Ada" }));
  return React.createElement(
    "p",
    null,
    t.rich("rich", {
      name: "Ada",
      b: (chunks) => React.createElement("strong", null, chunks),
    }),
  );
}
assert.equal(
  renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      {
        locale: "de-DE",
        messages: {
          en: { home: { greeting: "Hello {name}", rich: "Hello <b>{name}</b>" } },
          zh: { home: { greeting: "你好 {name}", rich: "你好 <b>{name}</b>" } },
          "de-DE": { home: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" } },
        },
      },
      React.createElement(Greeting),
    ),
  ),
  "<p>Hallo <strong>Ada</strong></p>",
);
const stored = new Map();
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
});
const storage = createLocalStorageLocaleStorage(runtime, { key: "demo_locale_preference" });
storage.write("de-DE");
assert.equal(stored.get("demo_locale_preference"), "de-DE");
assert.equal(storage.read(), "de-DE");
stored.set("demo_locale_preference", "fr");
assert.equal(storage.read(), undefined);
if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
else delete globalThis.localStorage;
