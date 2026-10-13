import type { LocaleRuntime, LocaleStorage } from "../types.js";

export function createBrowserLocaleStorage<L extends string>(
  runtime: LocaleRuntime<L>,
): LocaleStorage<L> {
  return {
    read() {
      if (typeof document === "undefined") return undefined;
      try {
        return runtime.getLocaleCookie(document.cookie);
      } catch {
        return undefined;
      }
    },
    write(locale) {
      if (typeof document === "undefined") return;
      try {
        const secure = globalThis.location?.protocol === "https:";
        document.cookie = runtime.serializeLocaleCookie(locale, { secure });
      } catch {
        // Cookie access may be denied by browser privacy settings or a sandbox.
      }
    },
  };
}

export function createLocalStorageLocaleStorage<L extends string>(
  runtime: LocaleRuntime<L>,
  { key }: { key: string },
): LocaleStorage<L> {
  if (!key) throw new Error("Locale storage requires a non-empty key");
  return {
    read() {
      try {
        return runtime.normalizeLocale(globalThis.localStorage?.getItem(key));
      } catch {
        return undefined;
      }
    },
    write(locale) {
      try {
        globalThis.localStorage?.setItem(key, locale);
      } catch {
        // Storage may be unavailable in private or restricted WebViews.
      }
    },
  };
}
