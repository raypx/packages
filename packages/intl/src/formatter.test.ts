import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { createFormatter, createTranslator } from "./index.js";

describe("Intl format presets", () => {
  it("formats with custom names while preserving defaults", () => {
    const formatter = createFormatter("en", {
      formats: {
        number: { money: { style: "currency", currency: "EUR" } },
        list: { choice: { type: "disjunction" } },
        relativeTime: { strict: { numeric: "always" } },
      },
    });
    expect(formatter.number(2, "money")).toBe("€2.00");
    expect(formatter.number(1200, "compact")).toMatch(/1.2K/i);
    expect(formatter.list(["A", "B"], "choice")).toBe("A or B");
    expect(formatter.relativeTime(-1, "day", "strict")).toBe("1 day ago");
    expect(formatter.relativeTime(-1, "day", "numeric")).toBe("yesterday");
  });

  it("uses UTC by default and isolates effective format options", () => {
    const date = new Date("2026-08-24T00:30:00.000Z");
    const utc = createFormatter("en");
    const losAngeles = createFormatter("en", { timeZone: "America/Los_Angeles" });
    expect(createFormatter("en").dateTime(date, { day: "numeric" })).toBe("24");
    expect(createFormatter("en", { timeZone: "UTC" }).dateTime(date, { day: "numeric" })).toBe(
      "24",
    );
    expect(utc.dateTime(date, { day: "numeric" })).toBe("24");
    expect(losAngeles.dateTime(date, { day: "numeric" })).toBe("23");
    expect(utc).not.toBe(losAngeles);
    const custom = { number: { compact: { maximumFractionDigits: 0 } } };
    expect(createFormatter("en", { formats: custom })).not.toBe(utc);
    expect(createFormatter("en", { formats: custom }).number(1234.5, "compact")).toBe("1,235");
  });

  it("reports unknown named formats rather than resolving inherited object keys", () => {
    const formatter = createFormatter("en");
    expect(() => formatter.number(1, "missing")).toThrow(RangeError);
    expect(() => formatter.relativeTime(1, "day", "constructor")).toThrow(RangeError);
  });

  it("accepts per-call timezones and falls back for invalid native Intl input", () => {
    const formatter = createFormatter("en", { timeZone: "America/Los_Angeles" });
    const date = new Date("2026-08-24T00:30:00.000Z");
    expect(formatter.dateTime(date, { day: "numeric", timeZone: "UTC" })).toBe("24");
    expect(formatter.dateTime(date, { day: "numeric", timeZone: undefined })).toBe("23");
    expect(formatter.dateTime(new Date(NaN))).toBe("Invalid Date");
    expect(formatter.number(2, { style: "currency", currency: "X" })).toBe("2");
  });

  it("uses custom date and number formats in ICU messages", () => {
    const translate = createTranslator({
      locale: "en",
      messages: { cost: "Total {cost, number, money}", day: "{date, date, day}" },
      formats: {
        number: { money: { style: "currency", currency: "EUR" } },
        dateTime: { day: { day: "numeric" } },
      },
    });
    expect(translate("cost", { cost: 2 })).toBe("Total €2.00");
    expect(translate("day", { date: new Date("2026-08-24T00:30:00.000Z") })).toBe("24");
  });

  it("exposes upstream ranges, display names, format overrides and rich lists", () => {
    const formatter = createFormatter("en", {
      formats: {
        displayName: { languages: { type: "language" } },
        number: { money: { style: "currency", currency: "USD" } },
      },
    });
    const start = new Date("2026-08-24T00:30:00Z");
    const end = new Date("2026-08-26T00:30:00Z");
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    expect(formatter.dateTimeRange(start, end, options)).toBe(
      new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).formatRange(start, end),
    );
    expect(formatter.displayName("de", "languages")).toBe("German");
    expect(formatter.number(2, "money", { currency: "EUR" })).toBe("€2.00");
    const list = formatter.list([
      createElement("b", { key: "a" }, "A"),
      createElement("b", { key: "b" }, "B"),
    ]);
    expect(renderToStaticMarkup(createElement("span", null, list))).toBe(
      "<span><b>A</b> and <b>B</b></span>",
    );
    expect(() => formatter.displayName("de", "missing")).toThrow(RangeError);
  });

  it("delegates date-based relative time and preserves fractional/auto legacy formatting", () => {
    const now = new Date("2026-08-25T00:00:00Z");
    const yesterday = new Date("2026-08-24T00:00:00Z");
    const formatter = createFormatter("en", { now });
    expect(formatter.relativeTime(yesterday)).toBe("1 day ago");
    expect(formatter.relativeTime(yesterday, { now, unit: "day" })).toBe("1 day ago");
    expect(formatter.relativeTime(yesterday, now)).toBe("1 day ago");
    expect(formatter.relativeTime(-1, "day", "numeric")).toBe("yesterday");
    expect(formatter.relativeTime(-1.5, "day")).toBe("1.5 days ago");
  });

  it("reports upstream formatting errors through caller configuration", () => {
    const onError = vi.fn();
    const formatter = createFormatter("en", { onError });
    expect(formatter.dateTime(new Date(NaN))).toBe("Invalid Date");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "FORMATTING_ERROR" }));
  });
});
