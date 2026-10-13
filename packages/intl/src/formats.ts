import type { Formats as UseIntlFormats } from "use-intl/core";

import type { IntlFormats, ResolvedIntlFormats } from "./types.js";

export const formats = {
  dateTime: { short: { dateStyle: "medium" } },
  list: { conjunction: { type: "conjunction" } },
  number: { compact: { notation: "compact" } },
  relativeTime: { numeric: { numeric: "auto" } },
  displayName: {},
} as const satisfies ResolvedIntlFormats;

/** Override individual presets while preserving the other default definitions. */
export function mergeFormats(custom?: IntlFormats): ResolvedIntlFormats {
  if (!custom) return formats;
  return {
    dateTime: { ...formats.dateTime, ...custom.dateTime },
    list: { ...formats.list, ...custom.list },
    number: { ...formats.number, ...custom.number },
    relativeTime: { ...formats.relativeTime, ...custom.relativeTime },
    displayName: { ...formats.displayName, ...custom.displayName },
  };
}
/** Keep preset replacement semantics when FormatJS merges its built-in styles. */
export function toUseIntlFormats(custom: IntlFormats): UseIntlFormats {
  return {
    ...custom,
    ...(custom.dateTime && {
      dateTime: Object.fromEntries(
        Object.entries(custom.dateTime).map(([name, options]) => [
          name,
          {
            year: undefined,
            month: undefined,
            day: undefined,
            weekday: undefined,
            hour: undefined,
            minute: undefined,
            second: undefined,
            timeZoneName: undefined,
            ...options,
          },
        ]),
      ),
    }),
    ...(custom.number && {
      number: Object.fromEntries(
        Object.entries(custom.number).map(([name, options]) => [
          name,
          { style: undefined, maximumFractionDigits: undefined, ...options },
        ]),
      ),
    }),
  } as UseIntlFormats;
}
