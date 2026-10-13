import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { StrictMode } from "react";
import {
  useFormatter as useIntlFormatter,
  useLocale as useIntlLocale,
  useTranslations as useIntlTranslations,
} from "use-intl/react";

import {
  createIntlClient,
  createBrowserLocaleStorage,
  createLocalStorageLocaleStorage,
} from "../client.js";
import { createLocaleRuntime } from "../locale.js";
import type { MessagesByLocale } from "../types.js";

const runtime = createLocaleRuntime({
  locales: ["en-US", "de-DE"],
  defaultLocale: "en-US",
  cookieName: "test_language",
});
const { AsyncI18nProvider, I18nProvider, useLocale, useFormatter, useSetLocale, useTranslations } =
  createIntlClient(runtime);
type Locale = (typeof runtime.locales)[number];

const messages = {
  "en-US": { home: { greeting: "Hello {name}" } },
  "de-DE": { home: { greeting: "Hallo {name}" } },
} satisfies MessagesByLocale<Locale>;

afterEach(cleanup);

function Probe() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useTranslations("home");
  return (
    <div>
      <output data-testid="locale">{locale}</output>
      <output data-testid="message">{t("greeting", { name: "Ada" })}</output>
      <button onClick={() => void setLocale("en-US").catch(() => undefined)}>English</button>
      <button onClick={() => void setLocale("de-DE").catch(() => undefined)}>German</button>
    </div>
  );
}

function AsyncFormatterProbe() {
  const formatter = useFormatter();
  return (
    <output data-testid="async-formatted-date">
      {formatter.dateTime(new Date("2026-01-01T01:00:00.000Z"), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })}
    </output>
  );
}

function probe(
  props: Partial<Omit<import("../client.js").I18nProviderProps<Locale>, "children">> = {},
) {
  return (
    <I18nProvider locale="en-US" messages={messages} {...props}>
      <Probe />
    </I18nProvider>
  );
}

function asyncProbe({
  locale = "en-US",
  messages: catalog = messages[locale],
  children = <Probe />,
  ...props
}: Partial<import("../client.js").AsyncI18nProviderProps<Locale>> &
  Pick<import("../client.js").AsyncI18nProviderProps<Locale>, "loadCatalog">) {
  return (
    <AsyncI18nProvider locale={locale} messages={catalog} {...props}>
      {children}
    </AsyncI18nProvider>
  );
}

function pendingCatalog() {
  let resolve!: (catalog: (typeof messages)["de-DE"]) => void;
  const promise = new Promise<(typeof messages)["de-DE"]>((done) => {
    resolve = done;
  });
  return { loadCatalog: vi.fn(() => promise), resolve };
}

describe("I18nProvider", () => {
  it.each(["synchronous", "asynchronous"])(
    "provides use-intl hooks with locale, messages, formats and a fixed clock: %s",
    async (mode) => {
      const catalog = {
        "en-US": {
          greeting: "Welcome <strong>{name}</strong>",
          price: "Price {value, number, amount}",
        },
        "de-DE": {
          greeting: "Willkommen <strong>{name}</strong>",
          price: "Preis {value, number, amount}",
        },
      } satisfies MessagesByLocale<Locale>;
      function UpstreamProbe() {
        const locale = useIntlLocale();
        const t = useIntlTranslations();
        const formatter = useIntlFormatter();
        const setLocale = useSetLocale();
        return (
          <>
            <output data-testid="upstream-locale">{locale}</output>
            <output data-testid="upstream-rich">
              {t.rich("greeting", { name: "Ada", strong: (chunks) => <strong>{chunks}</strong> })}
            </output>
            <output data-testid="upstream-price">{t("price", { value: 12.5 })}</output>
            <output data-testid="upstream-relative">
              {formatter.relativeTime(new Date("2026-01-02T00:00:00Z"), { unit: "day" })}
            </output>
            <button onClick={() => void setLocale("de-DE")}>Upstream German</button>
          </>
        );
      }
      const options = {
        locale: "en-US" as const,
        now: new Date("2026-01-01T00:00:00Z"),
        formats: { number: { amount: { style: "currency" as const, currency: "EUR" } } },
      };
      render(
        mode === "synchronous" ? (
          <I18nProvider {...options} messages={catalog}>
            <UpstreamProbe />
          </I18nProvider>
        ) : (
          <AsyncI18nProvider
            {...options}
            messages={catalog["en-US"]}
            loadCatalog={async (locale) => catalog[locale]}
          >
            <UpstreamProbe />
          </AsyncI18nProvider>
        ),
      );
      expect(screen.getByTestId("upstream-locale").textContent).toBe("en-US");
      expect(screen.getByTestId("upstream-rich").querySelector("strong")?.textContent).toBe("Ada");
      expect(screen.getByTestId("upstream-price").textContent).toBe("Price €12.50");
      expect(screen.getByTestId("upstream-relative").textContent).toBe("in 1 day");
      fireEvent.click(screen.getByRole("button", { name: "Upstream German" }));
      await waitFor(() => expect(screen.getByTestId("upstream-locale").textContent).toBe("de-DE"));
      expect(screen.getByTestId("upstream-rich").textContent).toBe("Willkommen Ada");
      expect(screen.getByTestId("upstream-price").textContent).toBe("Preis 12,50 €");
    },
  );

  it("exposes rich translations and public use-intl translator methods from factory hooks", () => {
    function RichProbe() {
      const t = useTranslations("home");
      return (
        <>
          <output data-testid="factory-rich">
            {t.rich("greeting", { name: "Ada", strong: (chunks) => <strong>{chunks}</strong> })}
          </output>
          <output data-testid="factory-markup">
            {t.markup("greeting", {
              name: "Ada",
              strong: (chunks) => `<strong>${chunks}</strong>`,
            })}
          </output>
          <output data-testid="factory-raw">{String(t.raw("greeting"))}</output>
          <output data-testid="factory-has">
            {String(t.has("greeting") && !t.has("missing"))}
          </output>
        </>
      );
    }
    render(
      <I18nProvider
        locale="en-US"
        messages={{
          "en-US": { home: { greeting: "Hello <strong>{name}</strong>" } },
          "de-DE": { home: { greeting: "Hallo <strong>{name}</strong>" } },
        }}
      >
        <RichProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("factory-rich").querySelector("strong")?.textContent).toBe("Ada");
    expect(screen.getByTestId("factory-markup").textContent).toBe("Hello <strong>Ada</strong>");
    expect(screen.getByTestId("factory-raw").textContent).toBe("Hello <strong>{name}</strong>");
    expect(screen.getByTestId("factory-has").textContent).toBe("true");
  });

  it("uses provider time zones and dateStyle overrides for both translation APIs", () => {
    function DateStyleProbe() {
      const t = useTranslations();
      const upstream = useIntlTranslations();
      const formatter = useFormatter();
      const value = new Date("2026-01-01T01:00:00.000Z");
      return (
        <>
          <output data-testid="factory-date-style">{t("date", { value })}</output>
          <output data-testid="upstream-date-style">{upstream("date", { value })}</output>
          <output data-testid="formatted-date-style">{formatter.dateTime(value, "short")}</output>
        </>
      );
    }
    render(
      <I18nProvider
        locale="en-US"
        timeZone="America/Los_Angeles"
        formats={{ dateTime: { short: { dateStyle: "short" } } }}
        messages={{
          "en-US": { date: "Date {value, date, short}" },
          "de-DE": { date: "Datum {value, date, short}" },
        }}
      >
        <DateStyleProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("factory-date-style").textContent).toBe("Date 12/31/25");
    expect(screen.getByTestId("upstream-date-style").textContent).toBe("Date 12/31/25");
    expect(screen.getByTestId("formatted-date-style").textContent).toBe("12/31/25");
  });

  it("renders a complete static catalog without suspending and switches locale", async () => {
    const write = vi.fn();
    render(<StrictMode>{probe({ storage: { read: () => "en-US", write } })}</StrictMode>);

    expectLocale("en-US", "Hello Ada");

    fireEvent.click(screen.getByRole("button", { name: "German" }));

    expect(write).toHaveBeenCalledWith("de-DE");

    expect((await screen.findByTestId("locale")).textContent).toBe("de-DE");
    expect(screen.getByTestId("message").textContent).toBe("Hallo Ada");
    expect(write).toHaveBeenCalledWith("de-DE");
  });

  it("adopts a new locale when the provider props change", async () => {
    const { rerender } = render(probe({}));

    rerender(probe({ locale: "de-DE" }));

    await waitFor(() => {
      expectLocale("de-DE", "Hallo Ada");
    });
  });

  it("keeps the locale and storage update when the side-effect callback fails", async () => {
    const write = vi.fn();
    const onLocaleChange = vi.fn(async () => {
      throw new Error("document update failed");
    });

    render(probe({ onLocaleChange: onLocaleChange, storage: { read: () => "en-US", write } }));

    fireEvent.click(screen.getByRole("button", { name: "German" }));

    expect((await screen.findByTestId("locale")).textContent).toBe("de-DE");
    expect(screen.getByTestId("message").textContent).toBe("Hallo Ada");
    expect(write).toHaveBeenCalledWith("de-DE");
    expect(onLocaleChange).toHaveBeenCalledWith("de-DE");
  });

  it.each([
    ["is a no-op", () => {}],
    [
      "throws",
      () => {
        throw new Error("storage unavailable");
      },
    ],
  ] as const)("keeps an in-memory switch when locale persistence %s", async (_name, write) => {
    const onLocaleChange = vi.fn();
    render(probe({ onLocaleChange, storage: { read: () => "en-US", write } }));
    fireEvent.click(screen.getByRole("button", { name: "German" }));
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("de-DE"));
    expect(onLocaleChange).toHaveBeenCalledWith("de-DE");
  });

  it("uses the shared cookie and localStorage locale adapters", () => {
    document.cookie = "test_language=de-DE";
    const browserStorage = createBrowserLocaleStorage(runtime);
    expect(browserStorage.read()).toBe("de-DE");
    browserStorage.write("en-US");
    expect(document.cookie).toContain("test_language=en-US");

    const localStorage = createLocalStorageLocaleStorage(runtime, { key: "test_language" });
    localStorage.write("de-DE");
    expect(localStorage.read()).toBe("de-DE");
  });

  it.each(["synchronous", "asynchronous"])(
    "remains interactive under StrictMode: %s",
    async (mode) => {
      const loadCatalog = async (locale: keyof typeof messages) => messages[locale];
      render(
        <StrictMode>{mode === "synchronous" ? probe() : asyncProbe({ loadCatalog })}</StrictMode>,
      );
      fireEvent.click(screen.getByRole("button", { name: "German" }));
      await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("de-DE"));
      expect((await screen.findByTestId("locale")).textContent).toBe("de-DE");
    },
  );
});

describe("AsyncI18nProvider", () => {
  it("renders the initial catalog without loading another locale", () => {
    const loadCatalog = vi.fn(async (locale: keyof typeof messages) => messages[locale]);

    render(asyncProbe({ loadCatalog }));

    expectLocale("en-US", "Hello Ada");
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it("passes formatter options through the async provider context", () => {
    const loadCatalog = vi.fn(async (locale: keyof typeof messages) => messages[locale]);

    render(
      asyncProbe({
        loadCatalog,
        timeZone: "America/Los_Angeles",
        children: <AsyncFormatterProbe />,
      }),
    );

    expect(screen.getByTestId("async-formatted-date").textContent).toContain("12/31/2025");
  });

  it("adopts a new locale and catalog when the provider props change", async () => {
    const loadCatalog = vi.fn(async (locale: keyof typeof messages) => messages[locale]);
    const { rerender } = render(asyncProbe({ loadCatalog }));

    rerender(asyncProbe({ locale: "de-DE", messages: messages["de-DE"], loadCatalog }));

    await waitFor(() => {
      expectLocale("de-DE", "Hallo Ada");
    });
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it("ignores a pending switch after newer provider props arrive", async () => {
    const { loadCatalog, resolve: resolveGerman } = pendingCatalog();
    const refreshedEnglish = { home: { greeting: "Hello refreshed {name}" } };
    const { rerender } = render(asyncProbe({ loadCatalog }));

    fireEvent.click(screen.getByRole("button", { name: "German" }));
    rerender(asyncProbe({ locale: "en-US", messages: refreshedEnglish, loadCatalog }));
    resolveGerman?.(messages["de-DE"]);

    await waitFor(() => {
      expectLocale("en-US", "Hello refreshed Ada");
    });
  });

  it("loads a target catalog once and commits locale and messages together", async () => {
    const write = vi.fn();
    const loadCatalog = vi.fn(async (locale: keyof typeof messages) => messages[locale]);

    render(
      asyncProbe({
        loadCatalog,
        storage: { read: () => "en-US", write },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "German" }));

    await waitFor(() => {
      expectLocale("de-DE", "Hallo Ada");
    });
    expect(loadCatalog).toHaveBeenCalledTimes(1);
    expect(loadCatalog).toHaveBeenCalledWith("de-DE");
    expect(write).toHaveBeenCalledWith("de-DE");
  });

  it("keeps a loaded locale and persistence when the async side-effect callback fails", async () => {
    const write = vi.fn();
    const onLocaleChange = vi.fn(async () => {
      throw new Error("document update failed");
    });
    render(
      asyncProbe({
        loadCatalog: async (locale) => messages[locale],
        storage: { read: () => "en-US", write },
        onLocaleChange,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "German" }));
    await waitFor(() => expectLocale("de-DE", "Hallo Ada"));
    expect(write).toHaveBeenCalledWith("de-DE");
    expect(onLocaleChange).toHaveBeenCalledWith("de-DE");
  });

  it("shares the pending catalog promise across concurrent requests", async () => {
    const { loadCatalog, resolve: resolveCatalog } = pendingCatalog();

    render(asyncProbe({ loadCatalog }));

    fireEvent.click(screen.getByRole("button", { name: "German" }));
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "German" }));
    expect(loadCatalog).toHaveBeenCalledTimes(1);

    resolveCatalog?.(messages["de-DE"]);
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("de-DE"));
  });

  it("keeps the current locale after a load failure and retries later", async () => {
    const loadCatalog = vi
      .fn<() => Promise<(typeof messages)["de-DE"]>>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce(messages["de-DE"]);

    render(asyncProbe({ loadCatalog }));

    fireEvent.click(screen.getByRole("button", { name: "German" }));
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("locale").textContent).toBe("en-US");

    fireEvent.click(screen.getByRole("button", { name: "German" }));
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("de-DE"));
    expect(loadCatalog).toHaveBeenCalledTimes(2);
  });

  it("does not commit a stale catalog after a newer locale request", async () => {
    const { loadCatalog, resolve: resolveGerman } = pendingCatalog();
    const write = vi.fn();

    render(
      asyncProbe({
        loadCatalog,
        storage: { read: () => "en-US", write },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "German" }));
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    resolveGerman?.(messages["de-DE"]);

    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en-US"));
    expect(screen.getByTestId("message").textContent).toBe("Hello Ada");
    expect(write).not.toHaveBeenCalled();
  });

  it("does not persist or notify a catalog that finishes after unmount", async () => {
    const { loadCatalog, resolve } = pendingCatalog();
    const write = vi.fn();
    const onLocaleChange = vi.fn();
    const { unmount } = render(
      asyncProbe({ loadCatalog, storage: { read: () => "en-US", write }, onLocaleChange }),
    );
    fireEvent.click(screen.getByRole("button", { name: "German" }));
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      resolve(messages["de-DE"]);
    });
    expect(write).not.toHaveBeenCalled();
    expect(onLocaleChange).not.toHaveBeenCalled();
  });
});

describe("configured client isolation", () => {
  it("keeps nested factory formatting, clock and error options independent", () => {
    const other = createIntlClient(
      createLocaleRuntime({ locales: ["de-DE"], defaultLocale: "de-DE" }),
    );
    const outerError = vi.fn();
    const innerError = vi.fn();
    function OptionsProbe() {
      const firstFormatter = useFormatter();
      const firstTranslation = useTranslations("home");
      const secondFormatter = other.useFormatter();
      const secondTranslation = other.useTranslations("home");
      const date = new Date("2026-01-02T00:00:00Z");
      return (
        <>
          <output data-testid="outer-options">
            {firstFormatter.number(12.5, "amount")}:
            {firstFormatter.relativeTime(date, { unit: "day" })}:{firstTranslation("missing")}
          </output>
          <output data-testid="inner-options">
            {secondFormatter.number(12.5, "amount")}:
            {secondFormatter.relativeTime(date, { unit: "day" })}:{secondTranslation("missing")}
          </output>
        </>
      );
    }
    render(
      <I18nProvider
        locale="en-US"
        messages={messages}
        now={new Date("2026-01-01T00:00:00Z")}
        formats={{ number: { amount: { style: "currency", currency: "USD" } } }}
        onError={outerError}
        getMessageFallback={({ key }) => `outer:${key}`}
      >
        <other.I18nProvider
          locale="de-DE"
          messages={{ "de-DE": messages["de-DE"] }}
          now={new Date("2026-01-03T00:00:00Z")}
          formats={{ number: { amount: { style: "currency", currency: "EUR" } } }}
          onError={innerError}
          getMessageFallback={({ key }) => `inner:${key}`}
        >
          <OptionsProbe />
        </other.I18nProvider>
      </I18nProvider>,
    );
    expect(screen.getByTestId("outer-options").textContent).toBe("$12.50:in 1 day:outer:missing");
    expect(screen.getByTestId("inner-options").textContent).toBe("12,50 €:vor 1 Tag:inner:missing");
    expect(outerError).toHaveBeenCalledTimes(1);
    expect(innerError).toHaveBeenCalledTimes(1);
  });

  it("keeps nested client locale and translation contexts independent", async () => {
    const otherRuntime = createLocaleRuntime({
      locales: ["fr-CA", "es-MX"],
      defaultLocale: "fr-CA",
    });
    const other = createIntlClient(otherRuntime);
    const otherMessages = {
      "fr-CA": { home: { greeting: "Bonjour {name}" } },
      "es-MX": { home: { greeting: "Hola {name}" } },
    };
    function NestedProbe() {
      const firstLocale = useLocale();
      const firstTranslation = useTranslations("home");
      const secondLocale = other.useLocale();
      const secondTranslation = other.useTranslations("home");
      const setSecondLocale = other.useSetLocale();
      return (
        <>
          <output data-testid="first">
            {firstLocale}:{firstTranslation("greeting", { name: "Ada" })}
          </output>
          <output data-testid="second">
            {secondLocale}:{secondTranslation("greeting", { name: "Ada" })}
          </output>
          <button onClick={() => void setSecondLocale("es-MX")}>Spanish</button>
        </>
      );
    }
    render(
      <I18nProvider locale="en-US" messages={messages}>
        <other.I18nProvider locale="fr-CA" messages={otherMessages}>
          <NestedProbe />
        </other.I18nProvider>
      </I18nProvider>,
    );
    expect(screen.getByTestId("first").textContent).toBe("en-US:Hello Ada");
    expect(screen.getByTestId("second").textContent).toBe("fr-CA:Bonjour Ada");
    fireEvent.click(screen.getByRole("button", { name: "Spanish" }));
    await waitFor(() => expect(screen.getByTestId("second").textContent).toBe("es-MX:Hola Ada"));
    expect(screen.getByTestId("first").textContent).toBe("en-US:Hello Ada");
  });

  it("applies custom format definitions to formatter and ICU translation", () => {
    function CustomProbe() {
      const formatter = useFormatter();
      const translate = useTranslations();
      return (
        <>
          <output data-testid="custom-number">{formatter.number(12.5, "amount")}</output>
          <output data-testid="custom-message">{translate("price", { price: 12.5 })}</output>
        </>
      );
    }
    render(
      <I18nProvider
        locale="en-US"
        messages={{
          "en-US": { price: "Price {price, number, amount}" },
          "de-DE": { price: "Preis {price, number, amount}" },
        }}
        formats={{ number: { amount: { style: "currency", currency: "EUR" } } }}
      >
        <CustomProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("custom-number").textContent).toBe("€12.50");
    expect(screen.getByTestId("custom-message").textContent).toBe("Price €12.50");
  });

  it("ignores an unsupported locale passed by an untyped caller", async () => {
    const write = vi.fn();
    const onLocaleChange = vi.fn();
    function InvalidProbe() {
      const setLocale = useSetLocale();
      const locale = useLocale();
      return (
        <>
          <output data-testid="invalid-locale">{locale}</output>
          <button onClick={() => void setLocale("fr-FR" as Locale)}>Unsupported</button>
        </>
      );
    }
    render(
      <I18nProvider
        locale="en-US"
        messages={messages}
        storage={{ read: () => "en-US", write }}
        onLocaleChange={onLocaleChange}
      >
        <InvalidProbe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Unsupported" }));
    await act(async () => {});
    expect(screen.getByTestId("invalid-locale").textContent).toBe("en-US");
    expect(write).not.toHaveBeenCalled();
    expect(onLocaleChange).not.toHaveBeenCalled();
  });
});

function expectLocale(locale: string, text: string) {
  expect(screen.getByTestId("locale").textContent).toBe(locale);
  expect(screen.getByTestId("message").textContent).toBe(text);
}
