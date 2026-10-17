import { createLocaleRuntime } from "@voidmix/intl";
import { createIntlClient } from "@voidmix/intl/client";

const runtime = createLocaleRuntime({ locales: ["en", "zh"] as const, defaultLocale: "en" });
const messages = { page: { title: "Hello {name}", total: "{total, number}" } } as const;
const client = createIntlClient<typeof messages>()(runtime, { timeZone: "UTC" });

export function usePublicTypes() {
  const t = client.useTranslations("page");
  const locale: "en" | "zh" = client.useLocale();
  t("title", { name: "User" });
  // @ts-expect-error No wide overload for misspelled namespaces.
  client.useTranslations("missing");
  // @ts-expect-error No wide overload for misspelled keys.
  t("typo");
  // @ts-expect-error Required arguments stay required through the client facade.
  t("title");
  // @ts-expect-error Numeric ICU arguments keep their inferred types.
  t("total", { total: "3" });
  client.useFormatter().number(1234, "compact");
  client.useNow();
  client.useTimeZone();
  client.useMessages();
  return locale;
}

export function providerTypes() {
  client.IntlProvider({ locale: "en", messages, children: null });
  client.IntlProvider({ locale: "en", messages: null, children: null });
  // @ts-expect-error Current messages must be supplied explicitly.
  client.IntlProvider({ locale: "en", children: null });
  // @ts-expect-error Locale must be supplied explicitly.
  client.IntlProvider({ messages, children: null });
  // @ts-expect-error Configured locale union is retained.
  client.IntlProvider({ locale: "fr", messages, children: null });
}
