import { parseAcceptLanguage } from "./accept-language.js";
import type { LocaleRuntime } from "./types.js";

export { createTranslator, type CreateTranslatorOptions, type Translator } from "./translator.js";

/** Only the Headers contract is needed; no framework or request environment is imported. */
export function createIntlServer<L extends string>(runtime: LocaleRuntime<L>) {
  function resolveRequestLocaleHint(headers: Pick<Headers, "get">): L | undefined {
    return (
      runtime.getLocaleCookie(headers.get("cookie")) ??
      parseAcceptLanguage(headers.get("accept-language"))
        .map((preference) => runtime.normalizeLocale(preference.locale))
        .find((locale): locale is L => locale !== undefined)
    );
  }

  function resolveRequestLocale(headers: Pick<Headers, "get">, fallbackLocale?: L): L {
    return (
      resolveRequestLocaleHint(headers) ??
      runtime.resolveLocale(fallbackLocale === undefined ? {} : { fallbackLocale })
    );
  }

  function resolveConfiguredLocale(value: string | null | undefined, fallbackLocale?: L): L {
    return runtime.resolveLocale({
      ...(value === undefined || value === null ? {} : { cookieLocale: value }),
      ...(fallbackLocale === undefined ? {} : { fallbackLocale }),
    });
  }

  return Object.freeze({ resolveRequestLocale, resolveRequestLocaleHint, resolveConfiguredLocale });
}
