import assert from "node:assert/strict";

import type { PackageCheck } from "./shared.js";

const coreProbe = `
import assert from "node:assert/strict";
import { createLocaleRuntime, createFormatter, createTranslator } from "@voidmix/intl";
import { createIntlServer } from "@voidmix/intl/server";
import { extractIcuArguments, compareMessageCatalogs, assertMessageCatalogParity } from "@voidmix/intl/testing";
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
assert.equal(server.resolveRequestLocale(new Headers({ cookie: "demo_locale=de-DE", "accept-language": "zh;q=1" })), "de-DE");
assert.equal(server.resolveRequestLocale(new Headers({ "accept-language": "fr;q=1, de-DE;q=0.8, zh;q=0.5" })), "de-DE");
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
assert.equal(formatter.number(2, "money"), new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(2));
assert.equal(formatter.number(2000, "compact"), new Intl.NumberFormat("de-DE", { notation: "compact" }).format(2000));
assert.equal(formatter.dateTime(new Date("2026-10-13T00:00:00Z"), "day"), "13");
assert.equal(formatter.relativeTime(-1, "day", "strict"), new Intl.RelativeTimeFormat("de-DE", { numeric: "always" }).format(-1, "day"));
const translate = createTranslator({
  locale: "de-DE",
  messages: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" },
});
assert.equal(translate("greeting", { name: "Ada" }), "Hallo Ada");
assert.equal(translate.has("greeting"), true);
assert.equal(translate.has("missing"), false);
assert.equal(translate.raw("greeting"), "Hallo {name}");
assert.equal(translate.markup("rich", { name: "Ada", b: (chunks) => "<strong>" + chunks + "</strong>" }), "Hallo <strong>Ada</strong>");
assert.equal(typeof formatter.dateTimeRange(new Date("2026-10-13T00:00:00Z"), new Date("2026-10-14T00:00:00Z")), "string");
assert.equal(formatter.displayName("de", { type: "language" }), new Intl.DisplayNames("de-DE", { type: "language" }).of("de"));
assert.deepEqual(extractIcuArguments("{count, plural, one {# file for {name}} other {# files for {name}}}"), ["count", "name"]);
assert.deepEqual(compareMessageCatalogs({ greeting: "Hello {name}" }, { greeting: "Hallo {name}" }), []);
assert.throws(() => assertMessageCatalogParity({ greeting: "Hello {name}" }, { greeting: "Hallo {other}" }));
`;

export const intl: PackageCheck = {
  assertArchive({ packed }) {
    assert.equal(packed.dependencies?.["use-intl"], "4.14.9");
    assert.equal(packed.peerDependencies?.react, "^19.0.0");
    assert.notEqual(packed.peerDependenciesMeta?.react?.optional, true);
    assert.ok(!Object.hasOwn(packed.dependencies ?? {}, "intl-messageformat"));
  },
  consumerDependencies({ packed }) {
    const react = packed.peerDependencies?.react;
    assert.ok(react, `${packed.name}: missing React peer`);
    return { "react-dom": react };
  },
  consumerDevDependencies({ manifest }) {
    const types = manifest.devDependencies?.["@types/react"];
    const domTypes = manifest.devDependencies?.["@types/react-dom"];
    assert.ok(types && domTypes, `${manifest.name}: missing React type packages`);
    return { "@types/react": types, "@types/react-dom": domTypes };
  },
  typeProbe: `
import { createLocaleRuntime, createFormatter, createTranslator } from "@voidmix/intl";
import { createIntlServer } from "@voidmix/intl/server";
import { createIntlClient, createLocalStorageLocaleStorage } from "@voidmix/intl/client";
import { extractIcuArguments } from "@voidmix/intl/testing";
import type { ReactNode } from "react";
const runtime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"] as const,
  defaultLocale: "en",
  cookieName: "demo_locale",
  cookieMaxAgeSeconds: 3600,
});
const locale: "en" | "zh" | "de-DE" = runtime.normalizeLocale("DE_de") ?? runtime.defaultLocale;
void locale;
runtime.serializeLocaleCookie("zh");
// @ts-expect-error Only the configured locales are accepted.
runtime.serializeLocaleCookie("fr");
const server = createIntlServer(runtime);
const requestLocale: "en" | "zh" | "de-DE" = server.resolveRequestLocale(new Headers());
void requestLocale;
// @ts-expect-error The server fallback must be a configured locale.
server.resolveConfiguredLocale(undefined, "fr");
createIntlClient(runtime);
createLocalStorageLocaleStorage(runtime, { key: "demo_locale_preference" }).write("de-DE");
createFormatter("de-DE", {
  formats: { number: { money: { style: "currency", currency: "EUR" } } },
}).number(2, "money");
const translate = createTranslator({
  locale: "de-DE",
  messages: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" },
  onError: () => {},
});
translate("greeting", { name: "Ada" });
const exists: boolean = translate.has("greeting");
const rich: ReactNode = translate.rich("rich", { name: "Ada", b: (chunks) => chunks });
const markup: string = translate.markup("rich", { name: "Ada", b: (chunks) => "<b>" + chunks + "</b>" });
void exists; void rich; void markup;
translate.raw("greeting");
const formatter = createFormatter("de-DE");
formatter.dateTimeRange(new Date(), new Date());
formatter.displayName("de", { type: "language" });
extractIcuArguments("{count, plural, one {# file} other {# files}}");
`,
  runtimeProbe: `${coreProbe}
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations as useUpstreamTranslations } from "use-intl/react";
import { createIntlClient, createLocalStorageLocaleStorage } from "@voidmix/intl/client";
const { I18nProvider, useTranslations } = createIntlClient(runtime);
function Greeting() {
  const t = useTranslations("home");
  const upstream = useUpstreamTranslations("home");
  assert.equal(upstream("greeting", { name: "Ada" }), t("greeting", { name: "Ada" }));
  return React.createElement("p", null, t.rich("rich", {
    name: "Ada", b: (chunks) => React.createElement("strong", null, chunks),
  }));
}
assert.equal(renderToStaticMarkup(React.createElement(I18nProvider, {
  locale: "de-DE",
  messages: {
    en: { home: { greeting: "Hello {name}", rich: "Hello <b>{name}</b>" } },
    zh: { home: { greeting: "你好 {name}", rich: "你好 <b>{name}</b>" } },
    "de-DE": { home: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" } },
  },
}, React.createElement(Greeting))), "<p>Hallo <strong>Ada</strong></p>");
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
`,
};
