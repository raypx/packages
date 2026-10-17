import { parseAcceptLanguage } from "./accept-language.js";
import type { HeaderReader, LocaleRuntime } from "./types.js";

export { createTranslator, type CreateTranslatorOptions, type Translator } from "./translator.js";

/** Only the Headers contract is needed; no framework or request environment is imported. */
export function createIntlServer<L extends string>(runtime: LocaleRuntime<L>) {
  function resolveRequestLocaleHint(headers: HeaderReader): L | undefined {
    return (
      runtime.getLocaleCookie(headers.get("cookie")) ??
      runtime.matchLocale(
        parseAcceptLanguage(headers.get("accept-language")).map((preference) => preference.locale),
      )
    );
  }

  function resolveRequestLocale(headers: HeaderReader, fallbackLocale?: L): L {
    // Validate explicit configuration even when a request contains a valid hint.
    const fallback = runtime.resolveLocale(fallbackLocale === undefined ? {} : { fallbackLocale });
    return resolveRequestLocaleHint(headers) ?? fallback;
  }

  function resolveConfiguredLocale(value: string | null | undefined, fallbackLocale?: L): L {
    return runtime.resolveLocale({
      ...(value === undefined || value === null ? {} : { cookieLocale: value }),
      ...(fallbackLocale === undefined ? {} : { fallbackLocale }),
    });
  }

  return Object.freeze({ resolveRequestLocale, resolveRequestLocaleHint, resolveConfiguredLocale });
}
