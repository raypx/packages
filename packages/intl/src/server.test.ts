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
