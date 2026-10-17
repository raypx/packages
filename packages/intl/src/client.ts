import { createElement, useMemo, type ComponentProps } from "react";
import {
  IntlProvider as NativeIntlProvider,
  useFormatter as useNativeFormatter,
  useLocale as useNativeLocale,
  useMessages as useNativeMessages,
  useNow as useNativeNow,
  useTimeZone as useNativeTimeZone,
  useTranslations as useNativeTranslations,
} from "use-intl/react";
import type { NamespaceKeys, NestedKeyOf } from "use-intl/core";

import { mergeFormats, resolveIntlOptions } from "./formats.js";
import type { Translator } from "./translator.js";
import type { CatalogShape, DynamicMessages, IntlDefaults, LocaleRuntime } from "./types.js";

export type IntlProviderProps<
  L extends string = string,
  M extends DynamicMessages = DynamicMessages,
> = Omit<ComponentProps<typeof NativeIntlProvider>, "locale" | "messages"> & {
  locale: L;
  messages: CatalogShape<M> | null;
};

/** Bind types and static defaults only. Locale, catalogs and loading belong to the application. */
export function createIntlClient<M extends DynamicMessages = DynamicMessages>() {
  return function bindLocale<L extends string>(
    runtime: LocaleRuntime<L>,
    defaults: IntlDefaults = {},
  ) {
    // Copy static configuration once; there is no mutable client state or private context.
    const configuredDefaults = {
      ...defaults,
      formats: mergeFormats(defaults.formats),
    };
    function IntlProvider({ locale, messages, ...options }: IntlProviderProps<L, M>) {
      if (!runtime.isLocale(locale)) throw new TypeError("Unsupported provider locale");
      const resolved = useMemo(() => {
        const formats =
          options.formats === undefined
            ? configuredDefaults.formats
            : options.formats === null
              ? null
              : {
                  dateTime: { ...configuredDefaults.formats.dateTime, ...options.formats.dateTime },
                  number: { ...configuredDefaults.formats.number, ...options.formats.number },
                  list: { ...configuredDefaults.formats.list, ...options.formats.list },
                  displayName: {
                    ...configuredDefaults.formats.displayName,
                    ...options.formats.displayName,
                  },
                };
        return resolveIntlOptions({ ...configuredDefaults, ...options, formats });
      }, [
        options.formats,
        options.timeZone,
        options.onError,
        options.getMessageFallback,
        options.now,
      ]);
      return createElement(NativeIntlProvider, { ...options, ...resolved, locale, messages });
    }
    function useTranslations<N extends NamespaceKeys<M, NestedKeyOf<M>> = never>(
      namespace?: N,
    ): Translator<M, N> {
      // The mounted provider owns the runtime data. This bridge binds its declared catalog shape.
      return useNativeTranslations(namespace as never) as unknown as Translator<M, N>;
    }
    function useLocale(): L {
      return useNativeLocale() as L;
    }
    function useMessages(): CatalogShape<M> {
      return useNativeMessages() as CatalogShape<M>;
    }
    return {
      IntlProvider,
      useLocale,
      useTranslations,
      useFormatter: useNativeFormatter,
      useNow: useNativeNow,
      useTimeZone: useNativeTimeZone,
      useMessages,
    };
  };
}
export type { CatalogShape, DynamicMessages, IntlDefaults, MessagesByLocale } from "./types.js";
