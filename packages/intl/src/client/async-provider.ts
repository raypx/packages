import { createElement, useCallback, useEffect, useRef, useState } from "react";

import type { LocaleProviderProps } from "../client.js";
import type { LocaleCatalogLoader, LocaleRuntime, MessageCatalog } from "../types.js";
import type { createClientRuntime } from "./runtime.js";

export type AsyncI18nProviderProps<L extends string = string> = LocaleProviderProps<L> & {
  messages: MessageCatalog;
  loadCatalog: LocaleCatalogLoader<L>;
};

type AsyncLocaleCatalogOptions<L extends string> = Pick<
  AsyncI18nProviderProps<L>,
  "locale" | "messages" | "loadCatalog" | "storage" | "onLocaleChange"
>;

type ActiveCatalog<L extends string> = { locale: L; messages: MessageCatalog };

export function createAsyncProvider<L extends string>(
  localeRuntime: LocaleRuntime<L>,
  {
    LocaleContextProvider,
    IntlCatalogProvider,
  }: Pick<
    ReturnType<typeof createClientRuntime<L>>,
    "LocaleContextProvider" | "IntlCatalogProvider"
  >,
) {
  function AsyncI18nProvider({
    children,
    timeZone,
    formats,
    onError,
    getMessageFallback,
    now,
    ...options
  }: AsyncI18nProviderProps<L>) {
    const { locale, messages, setLocale } = useAsyncLocaleCatalog(options);
    const runtime = {
      locale,
      ...(timeZone !== undefined ? { timeZone } : {}),
      ...(formats !== undefined ? { formats } : {}),
      ...(onError !== undefined ? { onError } : {}),
      ...(getMessageFallback !== undefined ? { getMessageFallback } : {}),
      ...(now !== undefined ? { now } : {}),
    };
    return createElement(
      LocaleContextProvider,
      { ...runtime, setLocale },
      createElement(IntlCatalogProvider, { ...runtime, messages }, children),
    );
  }

  function useAsyncLocaleCatalog({
    locale,
    messages,
    loadCatalog,
    storage,
    onLocaleChange,
  }: AsyncLocaleCatalogOptions<L>) {
    const [active, setActive] = useState<ActiveCatalog<L>>({ locale, messages });
    const requestId = useRef(0);
    const activeRef = useRef(active);
    const propsRef = useRef({ locale, messages });
    const catalogCache = useRef(
      new Map<L, Promise<MessageCatalog>>([[locale, Promise.resolve(messages)]]),
    );
    const mountedRef = useRef(true);
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        requestId.current += 1;
      };
    }, []);
    const propsChanged =
      propsRef.current.locale !== locale || propsRef.current.messages !== messages;

    useEffect(() => {
      if (!propsChanged) return;
      const nextActive = { locale, messages };
      propsRef.current = nextActive;
      requestId.current += 1;
      activeRef.current = nextActive;
      catalogCache.current.clear();
      catalogCache.current.set(locale, Promise.resolve(messages));
      setActive(nextActive);
    }, [locale, messages, propsChanged]);

    const setLocale = useCallback(
      async (nextLocale: L) => {
        const currentRequestId = ++requestId.current;
        const currentLocale = propsChanged ? locale : activeRef.current.locale;
        if (!localeRuntime.isLocale(nextLocale) || nextLocale === currentLocale) return;
        const nextMessages = await getOrLoadCatalog(catalogCache.current, nextLocale, loadCatalog);
        if (!mountedRef.current || currentRequestId !== requestId.current) return;
        try {
          storage?.write(nextLocale);
        } catch {
          // Persistence failures must not prevent a locale transition.
        }
        const nextActive = { locale: nextLocale, messages: nextMessages };
        activeRef.current = nextActive;
        setActive(nextActive);
        if (mountedRef.current) await onLocaleChange?.(nextLocale);
      },
      [loadCatalog, locale, onLocaleChange, propsChanged, storage],
    );

    return {
      locale: propsChanged ? locale : active.locale,
      messages: propsChanged ? messages : active.messages,
      setLocale,
    };
  }

  return AsyncI18nProvider;
}

function getOrLoadCatalog<L extends string>(
  catalogCache: Map<L, Promise<MessageCatalog>>,
  locale: L,
  loadCatalog: LocaleCatalogLoader<L>,
) {
  const cached = catalogCache.get(locale);
  if (cached) return cached;
  const catalogPromise = Promise.resolve()
    .then(() => loadCatalog(locale))
    .catch((error: unknown) => {
      if (catalogCache.get(locale) === catalogPromise) catalogCache.delete(locale);
      throw error;
    });
  catalogCache.set(locale, catalogPromise);
  return catalogPromise;
}
