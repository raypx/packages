import type {
  Formats as UseIntlFormats,
  IntlConfig,
  MarkupTagsFunction,
  NumberFormatOptions as UseIntlNumberFormatOptions,
  RichTagsFunction,
} from "use-intl/core";

export type MessageTree = {
  readonly [key: string]: string | MessageTree;
};

export type MessageCatalog = MessageTree;
export type MessagesByLocale<L extends string = string> = Readonly<Record<L, MessageCatalog>>;
export type TranslationValue = string | number | bigint | boolean | Date | null;
export type TranslationValues = Record<string, TranslationValue>;
export type RichTranslationValues = Record<string, TranslationValue | RichTagsFunction>;
export type MarkupTranslationValues = Record<string, TranslationValue | MarkupTagsFunction>;

export type {
  DateTimeFormatOptions,
  NumberFormatOptions,
  RelativeTimeFormatOptions,
  RichTagsFunction,
  MarkupTagsFunction,
} from "use-intl/core";

export interface IntlFormats {
  dateTime?: Readonly<Record<string, Intl.DateTimeFormatOptions>>;
  list?: Readonly<Record<string, Intl.ListFormatOptions>>;
  number?: Readonly<Record<string, Intl.NumberFormatOptions | UseIntlNumberFormatOptions>>;
  relativeTime?: Readonly<Record<string, Intl.RelativeTimeFormatOptions>>;
  displayName?: UseIntlFormats["displayName"];
}

export interface ResolvedIntlFormats {
  dateTime: Readonly<Record<string, Intl.DateTimeFormatOptions>>;
  list: Readonly<Record<string, Intl.ListFormatOptions>>;
  number: Readonly<Record<string, Intl.NumberFormatOptions | UseIntlNumberFormatOptions>>;
  relativeTime: Readonly<Record<string, Intl.RelativeTimeFormatOptions>>;
  displayName: NonNullable<UseIntlFormats["displayName"]>;
}

export interface IntlRuntimeOptions {
  timeZone?: string;
  formats?: IntlFormats;
  now?: Date;
  onError?: NonNullable<IntlConfig["onError"]>;
  getMessageFallback?: NonNullable<IntlConfig["getMessageFallback"]>;
}

export type LocaleCatalogLoader<L extends string = string> = (locale: L) => Promise<MessageCatalog>;

export interface LocaleStorage<L extends string = string> {
  read(): L | undefined;
  write(locale: L): void;
}

export interface LocaleConfig<L extends string> {
  locales: readonly L[];
  defaultLocale: NoInfer<L>;
  cookieName?: string;
  cookieMaxAgeSeconds?: number;
}

export interface LocaleSource<L extends string = string> {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
  fallbackLocale?: L;
}

export interface AcceptLanguagePreference {
  locale: string;
  quality: number;
}

export interface LocaleRuntime<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly cookieName: string;
  readonly cookieMaxAgeSeconds: number;
  isLocale(value: string): value is L;
  normalizeLocale(value: string | null | undefined): L | undefined;
  getLocaleCookie(cookieHeader: string | null | undefined): L | undefined;
  serializeLocaleCookie(locale: L, options?: { secure?: boolean }): string;
  resolveLocale(source?: LocaleSource<L>): L;
}
