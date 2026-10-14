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
const markup: string = translate.markup("rich", {
  name: "Ada",
  b: (chunks) => "<b>" + chunks + "</b>",
});
void exists;
void rich;
void markup;
translate.raw("greeting");
const formatter = createFormatter("de-DE");
formatter.dateTimeRange(new Date(), new Date());
formatter.displayName("de", { type: "language" });
extractIcuArguments("{count, plural, one {# file} other {# files}}");
