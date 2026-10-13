import {
  createFormatter as createUseIntlFormatter,
  type RelativeTimeFormatOptions,
} from "use-intl/core";

import { mergeFormats, toUseIntlFormats } from "./formats.js";
import type { IntlRuntimeOptions } from "./types.js";

export type FormatterOptions = IntlRuntimeOptions;
type UseIntlFormatter = ReturnType<typeof createUseIntlFormatter>;

export type Formatter = Omit<UseIntlFormatter, "relativeTime" | "dateTime" | "dateTimeRange"> & {
  dateTime(
    value: Date | number,
    format?: string | Intl.DateTimeFormatOptions,
    overrides?: Intl.DateTimeFormatOptions,
  ): string;
  dateTimeRange(
    start: Date | number,
    end: Date | number,
    format?: string | Intl.DateTimeFormatOptions,
    overrides?: Intl.DateTimeFormatOptions,
  ): string;
  relativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    format?: string | Intl.RelativeTimeFormatOptions,
  ): string;
  relativeTime(date: number | Date, now?: number | Date): string;
  relativeTime(date: number | Date, options?: RelativeTimeFormatOptions): string;
};

const ignoreIntlError = () => {};

export function createFormatter(locale: string, options: FormatterOptions = {}): Formatter {
  const runtimeFormats = mergeFormats(options.formats);
  const upstream = createUseIntlFormatter({
    locale,
    timeZone: options.timeZone ?? "UTC",
    formats: toUseIntlFormats(runtimeFormats),
    onError: options.onError ?? ignoreIntlError,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  function requireFormat(category: keyof typeof runtimeFormats, format: unknown) {
    if (typeof format === "string" && !Object.hasOwn(runtimeFormats[category], format))
      throw new RangeError(`Unknown Intl format: ${format}`);
  }

  function checked<F extends (...args: never[]) => unknown>(
    category: keyof typeof runtimeFormats,
    method: F,
    formatIndex = 1,
  ): F {
    return ((...args: Parameters<F>) => {
      requireFormat(category, args[formatIndex]);
      return Reflect.apply(method, undefined, args);
    }) as F;
  }

  function relativeTime(
    value: Date | number,
    unitOrOptions?: Intl.RelativeTimeFormatUnit | Date | number | RelativeTimeFormatOptions,
    format?: string | Intl.RelativeTimeFormatOptions,
  ): string {
    if (typeof unitOrOptions !== "string")
      return upstream.relativeTime(value, unitOrOptions as RelativeTimeFormatOptions);
    requireFormat("relativeTime", format);
    const relativeOptions =
      typeof format === "string" ? runtimeFormats.relativeTime[format] : format;
    // use-intl's date-based API rounds values and fixes numeric:always for days.
    // Native formatting keeps the existing fractional/auto numeric unit API.
    return new Intl.RelativeTimeFormat(locale, relativeOptions).format(
      value as number,
      unitOrOptions,
    );
  }

  return {
    ...upstream,
    dateTime: checked("dateTime", upstream.dateTime) as Formatter["dateTime"],
    dateTimeRange: checked("dateTime", upstream.dateTimeRange, 2) as Formatter["dateTimeRange"],
    number: checked("number", upstream.number),
    list: checked("list", upstream.list),
    displayName: checked("displayName", upstream.displayName),
    relativeTime,
  };
}
