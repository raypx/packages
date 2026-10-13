import { createTranslator as createUseIntlTranslator } from "use-intl/core";

import { mergeFormats, toUseIntlFormats } from "./formats.js";
import type {
  IntlFormats,
  IntlRuntimeOptions,
  MarkupTranslationValues,
  MessageCatalog,
  RichTranslationValues,
  TranslationValues,
} from "./types.js";

type UseIntlTranslator = ReturnType<typeof createUseIntlTranslator>;

export interface Translator {
  (key: string, values?: TranslationValues, formats?: IntlFormats): string;
  rich(
    key: string,
    values?: RichTranslationValues,
    formats?: IntlFormats,
  ): ReturnType<UseIntlTranslator["rich"]>;
  markup(key: string, values?: MarkupTranslationValues, formats?: IntlFormats): string;
  raw(key: string): ReturnType<UseIntlTranslator["raw"]>;
  has(key: string): boolean;
}

export interface CreateTranslatorOptions extends IntlRuntimeOptions {
  locale: string;
  messages: MessageCatalog;
  namespace?: string;
}

const ignoreIntlError = () => {};

export function createTranslator({
  locale,
  messages,
  namespace,
  timeZone = "UTC",
  formats,
  onError = ignoreIntlError,
  getMessageFallback,
  now,
}: CreateTranslatorOptions): Translator {
  const upstream = createUseIntlTranslator({
    locale,
    messages,
    timeZone,
    formats: toUseIntlFormats(mergeFormats(formats)),
    onError,
    ...(namespace !== undefined ? { namespace } : {}),
    ...(getMessageFallback !== undefined ? { getMessageFallback } : {}),
    ...(now !== undefined ? { now } : {}),
  }) as UseIntlTranslator;
  const translate: Translator = Object.assign(
    (key: string, values?: TranslationValues, inlineFormats?: IntlFormats) =>
      upstream(
        key,
        values as Parameters<UseIntlTranslator>[1],
        inlineFormats === undefined ? undefined : toUseIntlFormats(inlineFormats),
      ),
    {
      rich: (key: string, values?: RichTranslationValues, inlineFormats?: IntlFormats) =>
        upstream.rich(
          key,
          values as Parameters<UseIntlTranslator["rich"]>[1],
          inlineFormats === undefined ? undefined : toUseIntlFormats(inlineFormats),
        ),
      markup: (key: string, values?: MarkupTranslationValues, inlineFormats?: IntlFormats) =>
        upstream.markup(
          key,
          values as Parameters<UseIntlTranslator["markup"]>[1],
          inlineFormats === undefined ? undefined : toUseIntlFormats(inlineFormats),
        ),
      raw: upstream.raw,
      has: upstream.has,
    },
  );
  return translate;
}
