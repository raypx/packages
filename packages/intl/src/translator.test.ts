import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlErrorCode } from "use-intl/core";
import { describe, expect, it, vi } from "vite-plus/test";

import { createTranslator } from "./translator.js";
import type { MessageCatalog } from "./types.js";

const messages = {
  home: {
    greeting: "Hi {name}",
    count: "{count, plural, one {# item} other {# items}}",
  },
} as const;

describe("ICU translator", () => {
  it("creates a synchronous namespaced translator", () => {
    const translate = createTranslator({ locale: "en", messages, namespace: "home" });

    expect(translate("greeting", { name: "Ada" })).toBe("Hi Ada");
    expect(translate("count", { count: 3 })).toBe("3 items");
  });

  it("supports select, ordinal and plural offsets with exact branches", () => {
    const translate = createTranslator({
      locale: "en",
      messages: {
        status: "{status, select, active {Active} other {Unknown}}",
        place: "{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}",
        guests:
          "{count, plural, offset:1 =0 {Nobody} one {You and # guest} other {You and # guests}}",
      },
    });
    expect(translate("status", { status: "active" })).toBe("Active");
    expect(translate("status", { status: "disabled" })).toBe("Unknown");
    expect(translate("place", { place: 21 })).toBe("21st");
    expect(translate("place", { place: 22 })).toBe("22nd");
    expect(translate("place", { place: 23 })).toBe("23rd");
    expect(translate("place", { place: 24 })).toBe("24th");
    expect(translate("guests", { count: 0 })).toBe("Nobody");
    expect(translate("guests", { count: 2 })).toBe("You and 1 guest");
    expect(translate("guests", { count: 5 })).toBe("You and 4 guests");
  });

  it("preserves apostrophe quoting and plain scalar interpolation", () => {
    const translate = createTranslator({
      locale: "en",
      messages: {
        greeting: "'{name}' {name}. It's today",
        scalar: "{value}",
        empty: "",
      },
    });
    expect(translate("greeting", { name: "Ada" })).toBe("{name} Ada. It's today");
    expect(translate("scalar", { value: 42 })).toBe("42");
    expect(translate("scalar", { value: true })).toBe("true");
    expect(translate("scalar", { value: null })).toBe("");
    expect(translate("empty")).toBe("");
  });

  it("falls back to the qualified key for missing or malformed messages and values", () => {
    const translate = createTranslator({
      locale: "en",
      namespace: "home",
      messages: { home: { greeting: "Hi {name}", invalid: "Unclosed {", nested: { value: "x" } } },
    });
    expect(translate("missing")).toBe("home.missing");
    expect(translate("greeting")).toBe("home.greeting");
    expect(translate("invalid")).toBe("home.invalid");
    expect(translate("nested")).toBe("home.nested");
    expect(translate("constructor")).toBe("home.constructor");
    const missingNamespace = createTranslator({ locale: "en", messages, namespace: "missing" });
    expect(missingNamespace("greeting")).toBe("missing.greeting");
  });

  it("uses UTC for native ICU date formats and skeletons", () => {
    const date = new Date("2026-08-24T00:30:00.000Z");
    const translate = createTranslator({
      locale: "en",
      messages: {
        day: "{date, date, day}",
        skeleton: "{date, date, ::yyyyMMdd}",
        short: "{date, date, short}",
      },
      formats: { dateTime: { day: { day: "numeric" } } },
    });
    expect(translate("day", { date })).toBe("24");
    expect(translate("skeleton", { date })).toBe(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
      }).format(date),
    );
    expect(translate("short", { date })).toBe(
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date),
    );
  });

  it("falls back for malformed catalog nodes and throwing accessors", () => {
    const malformed = { home: { nullNode: null, greeting: "Hello" } } as unknown as MessageCatalog;
    const translate = createTranslator({ locale: "en", messages: malformed, namespace: "home" });
    expect(translate("nullNode.child")).toBe("home.nullNode.child");
    expect(translate("constructor")).toBe("home.constructor");
    const catalog = Object.defineProperty({}, "home", {
      get() {
        throw new Error("Unavailable");
      },
    });
    const unavailable = createTranslator({ locale: "en", messages: catalog, namespace: "home" });
    expect(unavailable("greeting")).toBe("home.greeting");
    const missing = createTranslator({
      locale: "en",
      messages: malformed,
      namespace: "home.nullNode",
    });
    expect(missing("greeting")).toBe("home.nullNode.greeting");
  });

  it("maps custom dateTime presets to both ICU date and time with explicit timezone overrides", () => {
    const date = new Date("2026-08-24T00:30:00.000Z");
    const translate = createTranslator({
      locale: "en",
      timeZone: "America/Los_Angeles",
      messages: {
        day: "{date, date, day}",
        clock: "{date, time, clock}",
        dateClock: "{date, date, clock}",
      },
      formats: {
        dateTime: {
          day: { day: "numeric" },
          clock: { hour: "2-digit", hourCycle: "h23", timeZone: "UTC" },
        },
      },
    });
    expect(translate("day", { date })).toBe("23");
    expect(translate("clock", { date })).toBe("00");
    expect(translate("dateClock", { date })).toBe("00");
  });

  it("exposes upstream rich, markup, raw and presence behavior", () => {
    const translate = createTranslator({
      locale: "en",
      namespace: "home",
      messages: { home: { title: "Hello <strong>{name}</strong>", nested: { value: "x" } } },
    });
    const rich = translate.rich("title", {
      name: "Ada",
      strong: (chunks) => createElement("strong", null, chunks),
    });
    expect(renderToStaticMarkup(createElement("span", null, rich))).toBe(
      "<span>Hello <strong>Ada</strong></span>",
    );
    expect(translate.markup("title", { name: "Ada", strong: (chunks) => `<b>${chunks}</b>` })).toBe(
      "Hello <b>Ada</b>",
    );
    expect(translate.raw("nested")).toEqual({ value: "x" });
    expect(translate.has("title")).toBe(true);
    expect(translate.has("missing")).toBe(false);
  });

  it("preserves quiet default fallback and delegates explicit error policies", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(createTranslator({ locale: "en", messages, namespace: "home" })("missing")).toBe(
        "home.missing",
      );
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
    const onError = vi.fn();
    const translate = createTranslator({
      locale: "en",
      messages,
      namespace: "home",
      onError,
      getMessageFallback: ({ namespace, key, error }) => `${namespace}.${key}:${error.code}`,
    });
    expect(translate("missing")).toBe(`home.missing:${IntlErrorCode.MISSING_MESSAGE}`);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "MISSING_MESSAGE" }));
    const failure = new Error("Application error policy");
    const strict = createTranslator({
      locale: "en",
      messages,
      onError: () => {
        throw failure;
      },
    });
    expect(() => strict("missing")).toThrow(failure);
  });

  it("supports per-call upstream formats without mutating configured presets", () => {
    const translate = createTranslator({
      locale: "en",
      messages: { amount: "{value, number, money}", day: "{date, date, short}" },
      formats: { number: { money: { style: "currency", currency: "USD" } } },
    });
    expect(
      translate(
        "amount",
        { value: 2 },
        { number: { money: { style: "currency", currency: "EUR" } } },
      ),
    ).toBe("€2.00");
    expect(translate("amount", { value: 2 })).toBe("$2.00");
    expect(
      translate(
        "day",
        { date: new Date("2026-08-24T00:30:00Z") },
        { dateTime: { short: { dateStyle: "long" } } },
      ),
    ).toBe("August 24, 2026");
  });
});
