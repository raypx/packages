import { describe, expect, it } from "vite-plus/test";

import { createLocaleRuntime } from "./index.js";
import { createIntlServer } from "./server.js";

const runtime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"] as const,
  defaultLocale: "zh",
  cookieName: "site_locale",
});
const server = createIntlServer(runtime);

describe("server locale factory", () => {
  it("returns only explicit supported request hints", () => {
    expect(server.resolveRequestLocaleHint(new Headers())).toBeUndefined();
    expect(
      server.resolveRequestLocaleHint(new Headers({ "accept-language": "fr-FR" })),
    ).toBeUndefined();
    expect(
      server.resolveRequestLocaleHint(
        new Headers({
          cookie: "site_locale=en",
          "accept-language": "de-DE",
        }),
      ),
    ).toBe("en");
    expect(
      server.resolveRequestLocaleHint(new Headers({ "accept-language": "de-DE-u-ca-gregory" })),
    ).toBe("de-DE");
  });

  it("preserves configured defaults and explicit fallback values", () => {
    expect(server.resolveRequestLocale(new Headers())).toBe("zh");
    expect(server.resolveRequestLocale(new Headers(), "en")).toBe("en");
    expect(server.resolveConfiguredLocale("en-US")).toBe("en");
    expect(server.resolveConfiguredLocale(undefined)).toBe("zh");
    expect(server.resolveConfiguredLocale("fr", "de-DE")).toBe("de-DE");
    // @ts-expect-error The fallback must be a configured locale.
    expect(() => server.resolveConfiguredLocale(undefined, "fr")).toThrow(TypeError);
  });

  it("is isolated across applications with different cookies and locales", () => {
    const other = createIntlServer(
      createLocaleRuntime({
        locales: ["fr", "es"] as const,
        defaultLocale: "fr",
        cookieName: "other_locale",
      }),
    );
    const headers = new Headers({ cookie: "site_locale=en; other_locale=es" });
    expect(server.resolveRequestLocale(headers)).toBe("en");
    expect(other.resolveRequestLocale(headers)).toBe("es");
  });
});

it("accepts structural header readers without DOM types", () => {
  const values: Record<string, string> = { cookie: "site_locale=en", "accept-language": "de-DE" };
  expect(server.resolveRequestLocale({ get: (name) => values[name] ?? null })).toBe("en");
});
it("validates fallbacks before consuming valid request hints", () => {
  const headers = { get: (name: string) => (name === "cookie" ? "site_locale=en" : "de-DE") };
  // @ts-expect-error invalid values from untyped callers still fail with a cookie hint
  expect(() => server.resolveRequestLocale(headers, "fr")).toThrow(TypeError);
  expect(() =>
    server.resolveRequestLocale(
      { get: (name) => (name === "accept-language" ? "en" : null) },
      // @ts-expect-error invalid values still fail with an accept-language hint
      "fr",
    ),
  ).toThrow(TypeError);
  expect(server.resolveRequestLocaleHint({ get: () => null })).toBeUndefined();
});
