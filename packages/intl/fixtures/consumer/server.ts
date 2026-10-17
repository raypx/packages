import {
  createFormatter,
  createLocaleRuntime,
  createTranslator,
  type CatalogShape,
  type DynamicMessages,
} from "@voidmix/intl";
import { createIntlServer } from "@voidmix/intl/server";

const runtime = createLocaleRuntime({ locales: ["en", "zh"] as const, defaultLocale: "en" });
const server = createIntlServer(runtime);
// No DOM or Node ambient libraries: a structural reader is sufficient.
const locale: "en" | "zh" = server.resolveRequestLocale({ get: () => null });
const messages = {
  page: {
    title: "Hello {name}",
    count: "{count, number}",
    date: "{date, date, short}",
    link: "Read <link>{name}</link>",
  },
} as const;

export function publicTypes() {
  const translated: CatalogShape<typeof messages> = {
    page: {
      title: "你好 {name}",
      count: "{count, number}",
      date: "{date, date, short}",
      link: "阅读 <link>{name}</link>",
    },
  };
  const t = createTranslator({ locale, messages, namespace: "page" });
  t("title", { name: "User" });
  t("count", { count: 3 });
  t("date", { date: new Date() });
  t.rich("link", { name: "User", link: (children) => children });
  // @ts-expect-error Invalid namespace must not fall through to a dynamic overload.
  createTranslator({ locale, messages, namespace: "typo" });
  // @ts-expect-error Typo in message key.
  t("missing");
  // @ts-expect-error Required ICU argument is missing.
  t("title");
  // @ts-expect-error Numeric ICU arguments cannot be strings.
  t("count", { count: "3" });
  // @ts-expect-error Date ICU arguments require Date.
  t("date", { date: 0 });
  // @ts-expect-error Rich tag callbacks are required.
  t.rich("link", { name: "User" });
  // @ts-expect-error A translated catalog must retain every leaf.
  const missing: CatalogShape<typeof messages> = { page: { title: "Hello" } };
  const dynamic: DynamicMessages = translated;
  createTranslator({ locale, messages: dynamic })("remote.key", { value: "dynamic" });
  createFormatter({ locale }).number(1234, "compact");
  return { translated, missing };
}
