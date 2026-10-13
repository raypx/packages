import { createContext, createElement, useContext, useMemo, type PropsWithChildren } from "react";
import { IntlProvider } from "use-intl/react";

import { mergeFormats, toUseIntlFormats } from "../formats.js";
import type { IntlRuntimeOptions, MessageCatalog } from "../types.js";

type LocaleContextValue<L extends string> = IntlRuntimeOptions & {
  locale: L;
  setLocale: (locale: L) => Promise<void>;
  timeZone: string;
  formats: NonNullable<IntlRuntimeOptions["formats"]>;
};

type CatalogContextValue<L extends string> = IntlRuntimeOptions & {
  locale: L;
  timeZone: string;
  formats: NonNullable<IntlRuntimeOptions["formats"]>;
  messages: MessageCatalog;
};

const ignoreIntlError: NonNullable<IntlRuntimeOptions["onError"]> = () => {};
const messageFallback: NonNullable<IntlRuntimeOptions["getMessageFallback"]> = ({
  namespace,
  key,
}) => [namespace, key].filter(Boolean).join(".");

export function createClientRuntime<L extends string>() {
  const LocaleContext = createContext<LocaleContextValue<L> | null>(null);
  const CatalogContext = createContext<CatalogContextValue<L> | null>(null);

  function LocaleContextProvider({
    children,
    locale,
    setLocale,
    timeZone = "UTC",
    formats,
    onError = ignoreIntlError,
    getMessageFallback = messageFallback,
    now,
  }: PropsWithChildren<Pick<LocaleContextValue<L>, "locale" | "setLocale"> & IntlRuntimeOptions>) {
    const context = useMemo(
      () => ({
        locale,
        setLocale,
        timeZone,
        formats: mergeFormats(formats),
        onError,
        getMessageFallback,
        ...(now !== undefined ? { now } : {}),
      }),
      [locale, setLocale, timeZone, formats, onError, getMessageFallback, now],
    );
    const providerFormats = useMemo(() => toUseIntlFormats(context.formats), [context.formats]);
    return createElement(
      LocaleContext.Provider,
      { value: context },
      createElement(IntlProvider, {
        ...context,
        formats: providerFormats,
        messages: null,
        children,
      }),
    );
  }

  function IntlCatalogProvider({
    children,
    locale,
    messages,
    timeZone = "UTC",
    formats,
    onError = ignoreIntlError,
    getMessageFallback = messageFallback,
    now,
  }: PropsWithChildren<{ locale: L; messages: MessageCatalog } & IntlRuntimeOptions>) {
    const context = useMemo(
      () => ({
        locale,
        messages,
        timeZone,
        formats: mergeFormats(formats),
        onError,
        getMessageFallback,
        ...(now !== undefined ? { now } : {}),
      }),
      [locale, messages, timeZone, formats, onError, getMessageFallback, now],
    );
    const providerFormats = useMemo(() => toUseIntlFormats(context.formats), [context.formats]);
    // Each factory's hooks read its own context and use public core factories.
    // The shared upstream provider additionally supports direct use-intl hooks.
    return createElement(
      CatalogContext.Provider,
      { value: context },
      createElement(IntlProvider, {
        ...context,
        formats: providerFormats,
        children,
      }),
    );
  }

  function useLocaleContext() {
    const context = useContext(LocaleContext);
    if (!context)
      throw new Error(
        "Intl hooks must be used within this client's LocaleProvider or I18nProvider",
      );
    return context;
  }

  function useCatalogContext() {
    const context = useContext(CatalogContext);
    if (!context)
      throw new Error("Translation hooks must be used within this client's I18nProvider");
    return context;
  }

  return { LocaleContextProvider, IntlCatalogProvider, useLocaleContext, useCatalogContext };
}
