import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { createAsyncProvider } from "./client/async-provider.js";
import { createClientRuntime } from "./client/runtime.js";
import { createFormatter, type Formatter } from "./formatter.js";
import { createTranslator, type Translator } from "./translator.js";
import type {
  IntlRuntimeOptions,
  LocaleRuntime,
  LocaleStorage,
  MessagesByLocale,
} from "./types.js";

export type LocaleProviderProps<L extends string = string> = PropsWithChildren<
  IntlRuntimeOptions & {
    locale: L;
    storage?: LocaleStorage<L>;
    onLocaleChange?: (locale: L) => void | Promise<void>;
  }
>;

export type I18nProviderProps<L extends string = string> = LocaleProviderProps<L> & {
  messages: MessagesByLocale<L>;
};

/** Create providers and hooks once, outside React renders, for one locale configuration. */
export function createIntlClient<L extends string>(runtime: LocaleRuntime<L>) {
  const { LocaleContextProvider, IntlCatalogProvider, useLocaleContext, useCatalogContext } =
    createClientRuntime<L>();

  function LocaleProvider({
    children,
    locale: initialLocale,
    storage,
    onLocaleChange,
    ...intlOptions
  }: LocaleProviderProps<L>) {
    const [locale, setActiveLocale] = useState(initialLocale);
    const localeRef = useRef(initialLocale);
    const mountedRef = useRef(true);
    useEffect(() => {
      if (localeRef.current === initialLocale) return;
      localeRef.current = initialLocale;
      setActiveLocale(initialLocale);
    }, [initialLocale]);
    useEffect(() => {
      // StrictMode replays effect setup; the replay remains a live mount.
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    const setLocale = useCallback(
      async (nextLocale: L) => {
        if (!runtime.isLocale(nextLocale) || nextLocale === localeRef.current) return;
        localeRef.current = nextLocale;
        try {
          storage?.write(nextLocale);
        } catch {
          // Persistence failures must not prevent an in-memory locale change.
        }
        if (mountedRef.current) setActiveLocale(nextLocale);
        await onLocaleChange?.(nextLocale);
      },
      [onLocaleChange, storage],
    );

    return createElement(
      LocaleContextProvider,
      {
        locale,
        setLocale,
        ...intlOptions,
      },
      children,
    );
  }

  function IntlMessagesProvider({
    children,
    messages,
    ...intlOptions
  }: PropsWithChildren<{ messages: MessagesByLocale<L> } & IntlRuntimeOptions>) {
    const locale = useLocale();
    return createElement(
      IntlCatalogProvider,
      {
        locale,
        messages: messages[locale],
        ...intlOptions,
      },
      children,
    );
  }

  function I18nProvider({
    messages,
    children,
    locale,
    storage,
    onLocaleChange,
    ...intlOptions
  }: I18nProviderProps<L>) {
    return createElement(
      LocaleProvider,
      {
        locale,
        ...(storage !== undefined ? { storage } : {}),
        ...(onLocaleChange !== undefined ? { onLocaleChange } : {}),
        ...intlOptions,
      },
      createElement(
        IntlMessagesProvider,
        {
          messages,
          ...intlOptions,
        },
        children,
      ),
    );
  }

  function useLocale(): L {
    return useLocaleContext().locale;
  }

  function useSetLocale() {
    return useLocaleContext().setLocale;
  }

  function useTranslations(namespace?: string): Translator {
    const { locale, messages, ...options } = useCatalogContext();
    const { timeZone, formats, onError, getMessageFallback, now } = options;
    return useMemo(
      () =>
        createTranslator({
          locale,
          messages,
          ...options,
          ...(namespace !== undefined ? { namespace } : {}),
        }),
      [locale, messages, timeZone, formats, onError, getMessageFallback, now, namespace],
    );
  }

  function useFormatter(options: IntlRuntimeOptions = {}): Formatter {
    const { locale, setLocale: _setLocale, ...contextOptions } = useLocaleContext();
    const resolvedOptions = { ...contextOptions, ...options };
    const { timeZone, formats, onError, getMessageFallback, now } = resolvedOptions;
    return useMemo(
      () => createFormatter(locale, resolvedOptions),
      [locale, formats, timeZone, onError, getMessageFallback, now],
    );
  }

  const AsyncI18nProvider = createAsyncProvider(runtime, {
    LocaleContextProvider,
    IntlCatalogProvider,
  });
  return {
    LocaleProvider,
    I18nProvider,
    AsyncI18nProvider,
    useLocale,
    useSetLocale,
    useTranslations,
    useFormatter,
  };
}

export { createBrowserLocaleStorage, createLocalStorageLocaleStorage } from "./client/storage.js";
export type { AsyncI18nProviderProps } from "./client/async-provider.js";
export type {
  LocaleStorage,
  MessageCatalog,
  MessageTree,
  MessagesByLocale,
  LocaleCatalogLoader,
} from "./types.js";
