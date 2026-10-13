import { parseAcceptLanguage } from "./accept-language.js";
import type { LocaleConfig, LocaleRuntime, LocaleSource } from "./types.js";

const COOKIE_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function canonicalLocale(value: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(value.trim().replaceAll("_", "-"))[0]?.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Create an isolated runtime; every application owns its supported locales. */
export function createLocaleRuntime<const L extends string>(
  config: LocaleConfig<L>,
): LocaleRuntime<L> {
  if (config.locales.length === 0) throw new TypeError("Configure at least one supported locale");
  const locales = Object.freeze([...config.locales]);
  const canonical = new Map<string, L>();
  for (const locale of locales) {
    const key = canonicalLocale(locale);
    if (!key || locale !== locale.trim() || locale.includes("_")) {
      throw new TypeError(`Invalid supported locale: ${locale}`);
    }
    if (canonical.has(key)) throw new TypeError(`Duplicate supported locale: ${locale}`);
    canonical.set(key, locale);
  }
  if (!locales.includes(config.defaultLocale)) {
    throw new TypeError("The default locale must be one of the supported locales");
  }
  const defaultLocale = config.defaultLocale;
  const cookieName = config.cookieName ?? "locale";
  if (!COOKIE_NAME.test(cookieName)) throw new TypeError("Invalid locale cookie name");
  const cookieMaxAgeSeconds = config.cookieMaxAgeSeconds ?? 60 * 60 * 24 * 365;
  if (!Number.isSafeInteger(cookieMaxAgeSeconds) || cookieMaxAgeSeconds < 0) {
    throw new TypeError("Locale cookie max age must be a nonnegative safe integer");
  }

  function isLocale(value: string): value is L {
    return locales.includes(value as L);
  }

  function normalizeLocale(value: string | null | undefined): L | undefined {
    if (!value) return undefined;
    let candidate = canonicalLocale(value);
    while (candidate) {
      const match = canonical.get(candidate);
      if (match) return match;
      const boundary = candidate.lastIndexOf("-");
      if (boundary < 0) break;
      candidate = candidate.slice(0, boundary);
      // RFC 4647 lookup also removes extension singletons after truncation.
      if (candidate.length >= 2 && candidate.at(-2) === "-") {
        candidate = candidate.slice(0, -2);
      }
    }
    return undefined;
  }

  function getLocaleCookie(cookieHeader: string | null | undefined): L | undefined {
    if (!cookieHeader) return undefined;
    const prefix = `${cookieName}=`;
    for (const part of cookieHeader.split(";")) {
      const cookie = part.trim();
      if (!cookie.startsWith(prefix)) continue;
      try {
        const locale = normalizeLocale(decodeURIComponent(cookie.slice(prefix.length)));
        if (locale) return locale;
      } catch {
        // A malformed duplicate does not hide a later valid cookie.
      }
    }
    return undefined;
  }

  function serializeLocaleCookie(locale: L, options: { secure?: boolean } = {}): string {
    if (!isLocale(locale)) throw new TypeError("Cannot persist an unsupported locale");
    return [
      `${cookieName}=${encodeURIComponent(locale)}`,
      "Path=/",
      `Max-Age=${cookieMaxAgeSeconds}`,
      "SameSite=Lax",
      ...(options.secure ? ["Secure"] : []),
    ].join("; ");
  }

  function resolveLocale({
    cookieLocale,
    acceptLanguage,
    fallbackLocale,
  }: LocaleSource<L> = {}): L {
    if (fallbackLocale !== undefined && !isLocale(fallbackLocale)) {
      throw new TypeError("Fallback locale must be one of the supported locales");
    }
    return (
      normalizeLocale(cookieLocale) ??
      parseAcceptLanguage(acceptLanguage)
        .map((preference) => normalizeLocale(preference.locale))
        .find((locale): locale is L => locale !== undefined) ??
      fallbackLocale ??
      defaultLocale
    );
  }

  return Object.freeze({
    locales,
    defaultLocale,
    cookieName,
    cookieMaxAgeSeconds,
    isLocale,
    normalizeLocale,
    getLocaleCookie,
    serializeLocaleCookie,
    resolveLocale,
  });
}
