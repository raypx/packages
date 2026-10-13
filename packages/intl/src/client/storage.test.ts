import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createLocaleRuntime } from "../locale.js";
import { createBrowserLocaleStorage, createLocalStorageLocaleStorage } from "./storage.js";

const runtime = createLocaleRuntime({
  locales: ["en-US", "de-DE"],
  defaultLocale: "en-US",
  cookieName: "sdk_language",
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("configured locale storage", () => {
  it("reads and writes only the configured localStorage key", () => {
    const storage = createLocalStorageLocaleStorage(runtime, { key: "sdk_language" });
    localStorage.setItem("other_language", "de-DE");
    expect(storage.read()).toBeUndefined();
    storage.write("en-US");
    expect(storage.read()).toBe("en-US");
    expect(localStorage.getItem("other_language")).toBe("de-DE");
  });

  it("normalizes stored locales and ignores unsupported values", () => {
    const storage = createLocalStorageLocaleStorage(runtime, { key: "sdk_language" });
    localStorage.setItem("sdk_language", "de-de");
    expect(storage.read()).toBe("de-DE");
    localStorage.setItem("sdk_language", "fr-FR");
    expect(storage.read()).toBeUndefined();
  });

  it("keeps independent configurations and storage keys isolated", () => {
    const other = createLocaleRuntime({ locales: ["fr-CA"], defaultLocale: "fr-CA" });
    const first = createLocalStorageLocaleStorage(runtime, { key: "first" });
    const second = createLocalStorageLocaleStorage(other, { key: "second" });
    first.write("de-DE");
    second.write("fr-CA");
    expect(first.read()).toBe("de-DE");
    expect(second.read()).toBe("fr-CA");
  });

  it("tolerates denied storage reads and writes", () => {
    const storage = createLocalStorageLocaleStorage(runtime, { key: "sdk_language" });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage reads denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage writes denied");
    });
    expect(storage.read()).toBeUndefined();
    expect(() => storage.write("de-DE")).not.toThrow();
  });

  it("uses the configured cookie name independently of other cookies", () => {
    document.cookie = "locale=fr-FR";
    const storage = createBrowserLocaleStorage(runtime);
    storage.write("de-DE");
    expect(storage.read()).toBe("de-DE");
    expect(document.cookie).toContain("sdk_language=de-DE");
    expect(document.cookie).toContain("locale=fr-FR");
  });

  it("requires an explicit non-empty localStorage key", () => {
    expect(() => createLocalStorageLocaleStorage(runtime, { key: "" })).toThrow("non-empty key");
  });
});
