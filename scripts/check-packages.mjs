import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const temporary = await mkdtemp(join(tmpdir(), "raypx-toolkit-pack-"));
const node = process.env.TOOLKIT_NODE_BINARY || "node";

function run(binary, args, cwd) {
  return execFileSync(binary, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function exportTargets(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargets);
  return [];
}

try {
  // Require the second runtime before doing network work. This checks a real
  // consumer rather than loading source files or workspace aliases.
  run(node, ["--version"], temporary);
  const directories = await readdir(join(root, "packages"), { withFileTypes: true });
  let checked = 0;
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const packageDirectory = join(root, "packages", directory.name);
    const manifest = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
    if (manifest.private) continue;
    const archive = join(temporary, `${directory.name}.tgz`);
    run(
      process.execPath,
      ["pm", "pack", "--ignore-scripts", "--filename", archive],
      packageDirectory,
    );
    const entries = new Set(run("tar", ["-tzf", archive], temporary).trim().split("\n"));
    const packed = JSON.parse(run("tar", ["-xOf", archive, "package/package.json"], temporary));
    assert.equal(packed.name, manifest.name);
    assert.equal(packed.version, manifest.version);
    assert.ok(entries.has("package/LICENSE"), `${packed.name}: missing LICENSE`);
    assert.ok(entries.has("package/README.md"), `${packed.name}: missing README.md`);
    assert.ok(![...entries].some((entry) => entry.startsWith("package/node_modules/")));
    assert.ok(![...entries].some((entry) => entry.startsWith("package/third-party/")));
    if (packed.name === "@raypx/drizzle") {
      assert.ok(![...entries].some((entry) => entry.startsWith("package/docs/")));
      assert.ok(![...entries].some((entry) => entry.startsWith("package/dist/pg/")));
      assert.ok(!Object.hasOwn(packed.exports, "./pg"));
      assert.equal(packed.peerDependencies.postgres, "3.4.9");
      assert.equal(packed.peerDependenciesMeta.postgres.optional, true);
    }
    if (packed.name === "@raypx/intl") {
      assert.equal(packed.dependencies["use-intl"], "4.14.9");
      assert.equal(packed.peerDependencies.react, "^19.0.0");
      assert.notEqual(packed.peerDependenciesMeta?.react?.optional, true);
      assert.ok(!Object.hasOwn(packed.dependencies, "intl-messageformat"));
    }
    if (packed.name === "@raypx/env") {
      assert.equal(packed.peerDependencies.zod, manifest.devDependencies.zod);
      assert.notEqual(packed.peerDependenciesMeta?.zod?.optional, true);
      assert.ok(!Object.hasOwn(packed.dependencies || {}, "zod"));
      assert.deepEqual(Object.keys(packed.exports).sort(), [".", "./runtime"]);
    }
    if (packed.name === "@raypx/drizzle" || manifest.files?.includes("NOTICE.md")) {
      for (const filename of ["NOTICE.md", "LICENSE"]) {
        assert.ok(entries.has(`package/${filename}`), `${packed.name}: missing ${filename}`);
        assert.equal(
          run("tar", ["-xOf", archive, `package/${filename}`], temporary),
          await readFile(join(packageDirectory, filename), "utf8"),
          `${packed.name}: incomplete ${filename}`,
        );
      }
      if (packed.name === "@raypx/drizzle") {
        const notices = run("tar", ["-xOf", archive, "package/NOTICE.md"], temporary);
        const license = run("tar", ["-xOf", archive, "package/LICENSE"], temporary);
        assert.ok(notices.includes("Copyright (c) Alec Larson"));
        assert.ok(notices.includes("Permission is hereby granted, free of charge"));
        assert.ok(license.includes("Copyright 2026 Hiago Almeida"));
        assert.ok(license.includes("END OF TERMS AND CONDITIONS"));
      }
    }
    for (const target of exportTargets(packed.exports)) {
      assert.ok(target.startsWith("./dist/"), `${packed.name}: export must point to build output`);
      assert.ok(
        entries.has(`package/${target.slice(2)}`),
        `${packed.name}: missing export ${target}`,
      );
    }
    for (const dependencies of [
      packed.dependencies,
      packed.optionalDependencies,
      packed.peerDependencies,
    ]) {
      for (const [name, version] of Object.entries(dependencies || {})) {
        assert.ok(
          !/^(?:workspace:|catalog:|file:|link:)/.test(version),
          `${packed.name}: local dependency ${name}`,
        );
      }
    }

    const consumer = join(temporary, directory.name);
    await mkdir(consumer);
    const dependencies = { [packed.name]: archive, ...packed.peerDependencies };
    // A peer can be explicitly optional. Install it for the export smoke check
    // so all advertised subpaths are exercised, independent of workspace deps.
    const typescript = rootManifest.devDependencies.typescript;
    const intlDependencies =
      packed.name === "@raypx/intl" ? { "react-dom": packed.peerDependencies.react } : {};
    const intlTypes =
      packed.name === "@raypx/intl"
        ? {
            "@types/react": manifest.devDependencies["@types/react"],
            "@types/react-dom": manifest.devDependencies["@types/react-dom"],
          }
        : {};
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify(
        {
          name: "toolkit-artifact-consumer",
          private: true,
          type: "module",
          dependencies: { ...dependencies, ...intlDependencies },
          devDependencies: {
            typescript,
            "@types/node": rootManifest.devDependencies["@types/node"],
            ...intlTypes,
          },
        },
        null,
        2,
      ),
    );
    run(process.execPath, ["install", "--ignore-scripts"], consumer);
    const specifiers = Object.keys(packed.exports).map((key) =>
      key === "." ? packed.name : `${packed.name}${key.slice(1)}`,
    );
    const imports = specifiers
      .map(
        (specifier, index) =>
          `import * as module${index} from ${JSON.stringify(specifier)};\nvoid module${index};`,
      )
      .join("\n");
    const typeProbe =
      packed.name === "@raypx/drizzle"
        ? `
import { withoutColumns } from "@raypx/drizzle";
import { jsonNumber, excludedColumns } from "@raypx/drizzle/postgres";
import { pgTable, integer, text, jsonb } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { SQL } from "drizzle-orm";
const users = pgTable("users", { id: integer(), secret: text(), data: jsonb() });
const projection = withoutColumns(users, "secret");
projection.id;
// @ts-expect-error Excluded columns cannot be read from the inferred projection.
projection.secret;
// @ts-expect-error Unknown schema keys must be rejected.
withoutColumns(users, "missing");
const updates = excludedColumns(users, "secret");
updates.secret;
// @ts-expect-error An explicit update mapping contains only the chosen keys.
updates.id;
const count: SQL<number | null> = jsonNumber(users.data, ["count"]);
void count;
const unsupported = sqliteTable("unsupported", { value: sqliteText() });
// @ts-expect-error The extension supports PostgreSQL tables only.
withoutColumns(unsupported, "value");
const client = postgres({ host: "127.0.0.1", port: 1, max: 1, prepare: false });
const db = drizzle({ client });
db.select({ id: users.id, count }).from(users).toSQL();
await client.end();
`
        : packed.name === "@raypx/intl"
          ? `
import { createLocaleRuntime, createFormatter, createTranslator } from "@raypx/intl";
import { createIntlServer } from "@raypx/intl/server";
import { createIntlClient, createLocalStorageLocaleStorage } from "@raypx/intl/client";
import { extractIcuArguments } from "@raypx/intl/testing";
import type { ReactNode } from "react";
const runtime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"] as const,
  defaultLocale: "en",
  cookieName: "demo_locale",
  cookieMaxAgeSeconds: 3600,
});
const locale: "en" | "zh" | "de-DE" = runtime.normalizeLocale("DE_de") ?? runtime.defaultLocale;
void locale;
runtime.serializeLocaleCookie("zh");
// @ts-expect-error Only the configured locales are accepted.
runtime.serializeLocaleCookie("fr");
const server = createIntlServer(runtime);
const requestLocale: "en" | "zh" | "de-DE" = server.resolveRequestLocale(new Headers());
void requestLocale;
// @ts-expect-error The server fallback must be a configured locale.
server.resolveConfiguredLocale(undefined, "fr");
createIntlClient(runtime);
createLocalStorageLocaleStorage(runtime, { key: "demo_locale_preference" }).write("de-DE");
createFormatter("de-DE", {
  formats: { number: { money: { style: "currency", currency: "EUR" } } },
}).number(2, "money");
const translate = createTranslator({
  locale: "de-DE",
  messages: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" },
  onError: () => {},
});
translate("greeting", { name: "Ada" });
const exists: boolean = translate.has("greeting");
const rich: ReactNode = translate.rich("rich", { name: "Ada", b: (chunks) => chunks });
const markup: string = translate.markup("rich", { name: "Ada", b: (chunks) => "<b>" + chunks + "</b>" });
void exists; void rich; void markup;
translate.raw("greeting");
const formatter = createFormatter("de-DE");
formatter.dateTimeRange(new Date(), new Date());
formatter.displayName("de", { type: "language" });
extractIcuArguments("{count, plural, one {# file} other {# files}}");
`
          : packed.name === "@raypx/env"
            ? `
import { createEnv, defineEnv, type Preset } from "@raypx/env";
import { runtimeEnv } from "@raypx/env/runtime";
import { z } from "zod";
const base = {
  extends: [runtimeEnv],
  shared: { PORT: z.string().default("3000").transform(Number) },
} as const satisfies Preset;
const nested = {
  extends: [base],
  clientPrefix: "PUBLIC_",
  client: { PUBLIC_ORIGIN: z.url() },
  server: { SECRET: z.string() },
} as const satisfies Preset;
const env = createEnv({
  extends: [nested],
  isServer: true,
  runtimeEnv: { NODE_ENV: "test", PUBLIC_ORIGIN: "https://example.test", SECRET: "private-placeholder" },
});
const port: number = env.PORT;
const mode: "development" | "production" | "test" = env.NODE_ENV;
const origin: string = env.PUBLIC_ORIGIN;
void port; void mode; void origin;
// @ts-expect-error Transformed defaults infer their output type.
const rawPort: string = env.PORT;
void rawPort;
// @ts-expect-error Undeclared variables do not appear in the environment.
env.MISSING;
const transformed = defineEnv({
  server: { PORT: z.string() },
  runtimeEnv: { PORT: "3002" },
  transform: () => z.object({ PORT: z.coerce.number().int() }),
});
const transformedPort: number = transformed.PORT;
void transformedPort;
createEnv({
  isServer: false,
  client: {
    // @ts-expect-error createEnv client variables require the VITE_ prefix.
    SECRET: z.string(),
  },
  runtimeEnv: {},
});
`
            : "";
    await writeFile(join(consumer, "consumer.ts"), `${imports}\n${typeProbe}\nexport {};\n`);
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            noEmit: true,
            // Drizzle's shared declarations reference optional drivers for all
            // dialects. Check consumer API inference without installing them.
            skipLibCheck: true,
          },
          files: ["consumer.ts"],
        },
        null,
        2,
      ),
    );
    run(
      process.execPath,
      ["--bun", "./node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
      consumer,
    );
    const intlCoreProbe = `
import assert from "node:assert/strict";
import { createLocaleRuntime, createFormatter, createTranslator } from "@raypx/intl";
import { createIntlServer } from "@raypx/intl/server";
import { extractIcuArguments, compareMessageCatalogs, assertMessageCatalogParity } from "@raypx/intl/testing";
const runtime = createLocaleRuntime({
  locales: ["en", "zh", "de-DE"],
  defaultLocale: "en",
  cookieName: "demo_locale",
  cookieMaxAgeSeconds: 3600,
});
assert.equal(runtime.normalizeLocale("DE_de"), "de-DE");
assert.equal(runtime.normalizeLocale("fr"), undefined);
assert.ok(runtime.serializeLocaleCookie("zh").startsWith("demo_locale=zh;"));
assert.ok(runtime.serializeLocaleCookie("zh").includes("Max-Age=3600"));
const server = createIntlServer(runtime);
assert.equal(server.resolveRequestLocale(new Headers({ cookie: "demo_locale=de-DE", "accept-language": "zh;q=1" })), "de-DE");
assert.equal(server.resolveRequestLocale(new Headers({ "accept-language": "fr;q=1, de-DE;q=0.8, zh;q=0.5" })), "de-DE");
assert.equal(server.resolveRequestLocaleHint(new Headers()), undefined);
assert.equal(server.resolveConfiguredLocale("DE_de"), "de-DE");
assert.equal(server.resolveConfiguredLocale(undefined, "zh"), "zh");
const formatter = createFormatter("de-DE", {
  formats: {
    number: { money: { style: "currency", currency: "EUR" } },
    dateTime: { day: { day: "numeric", timeZone: "UTC" } },
    relativeTime: { strict: { numeric: "always" } },
  },
});
assert.equal(formatter.number(2, "money"), new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(2));
assert.equal(formatter.number(2000, "compact"), new Intl.NumberFormat("de-DE", { notation: "compact" }).format(2000));
assert.equal(formatter.dateTime(new Date("2026-10-13T00:00:00Z"), "day"), "13");
assert.equal(formatter.relativeTime(-1, "day", "strict"), new Intl.RelativeTimeFormat("de-DE", { numeric: "always" }).format(-1, "day"));
const translate = createTranslator({
  locale: "de-DE",
  messages: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" },
});
assert.equal(translate("greeting", { name: "Ada" }), "Hallo Ada");
assert.equal(translate.has("greeting"), true);
assert.equal(translate.has("missing"), false);
assert.equal(translate.raw("greeting"), "Hallo {name}");
assert.equal(translate.markup("rich", { name: "Ada", b: (chunks) => "<strong>" + chunks + "</strong>" }), "Hallo <strong>Ada</strong>");
assert.equal(typeof formatter.dateTimeRange(new Date("2026-10-13T00:00:00Z"), new Date("2026-10-14T00:00:00Z")), "string");
assert.equal(formatter.displayName("de", { type: "language" }), new Intl.DisplayNames("de-DE", { type: "language" }).of("de"));
assert.deepEqual(extractIcuArguments("{count, plural, one {# file for {name}} other {# files for {name}}}"), ["count", "name"]);
assert.deepEqual(compareMessageCatalogs({ greeting: "Hello {name}" }, { greeting: "Hallo {name}" }), []);
assert.throws(() => assertMessageCatalogParity({ greeting: "Hello {name}" }, { greeting: "Hallo {other}" }));
`;
    const runtimeProbe =
      packed.name === "@raypx/drizzle"
        ? `
import assert from "node:assert/strict";
import { withoutColumns } from "@raypx/drizzle";
import { jsonText, excludedColumns } from "@raypx/drizzle/postgres";
import { isUniqueViolation } from "@raypx/drizzle/errors";
import { first, inserted } from "@raypx/drizzle/results";
import { pgTable, integer, text, jsonb, PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const users = pgTable("users", { id: integer(), secret: text("private_value"), data: jsonb() });
assert.deepEqual(Object.keys(withoutColumns(users, "secret")), ["id", "data"]);
assert.equal(users.secret.name, "private_value");
const dialect = new PgDialect();
const textQuery = dialect.sqlToQuery(jsonText(users.data, ["user.name"]));
assert.deepEqual(textQuery.params, ["user.name"]);
assert.ok(!textQuery.sql.includes("user.name"));
assert.equal(dialect.sqlToQuery(excludedColumns(users, "secret").secret).sql, 'excluded."private_value"');
assert.equal(isUniqueViolation({ cause: { code: "23505", constraint_name: "users_key" } }, "users_key"), true);
assert.equal(isUniqueViolation({ code: "23505", constraint_name: "other_key" }, "users_key"), false);
assert.equal(isUniqueViolation({ code: "23505", constraint: "users_key" }, "users_key"), false);
assert.equal(isUniqueViolation({ code: "23505", constraint_name: null, constraint: "users_key" }, "users_key"), false);
await assert.rejects(import("@raypx/drizzle/pg"));
const client = postgres({ host: "127.0.0.1", port: 1, max: 1, prepare: false });
const db = drizzle({ client });
const selection = db.select({ value: jsonText(users.data, ["user.name"]) }).from(users).toSQL();
assert.deepEqual(selection.params, ["user.name"]);
await client.end();
assert.equal(await first(Promise.resolve([])), null);
assert.deepEqual(await inserted(Promise.resolve([{ id: 1 }]), "insert user"), { id: 1 });
await assert.rejects(inserted(Promise.resolve([]), "insert user"));
`
        : packed.name === "@raypx/intl"
          ? `${intlCoreProbe}
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations as useUpstreamTranslations } from "use-intl/react";
import { createIntlClient, createLocalStorageLocaleStorage } from "@raypx/intl/client";
const { I18nProvider, useTranslations } = createIntlClient(runtime);
function Greeting() {
  const t = useTranslations("home");
  const upstream = useUpstreamTranslations("home");
  assert.equal(upstream("greeting", { name: "Ada" }), t("greeting", { name: "Ada" }));
  return React.createElement("p", null, t.rich("rich", {
    name: "Ada", b: (chunks) => React.createElement("strong", null, chunks),
  }));
}
assert.equal(renderToStaticMarkup(React.createElement(I18nProvider, {
  locale: "de-DE",
  messages: {
    en: { home: { greeting: "Hello {name}", rich: "Hello <b>{name}</b>" } },
    zh: { home: { greeting: "你好 {name}", rich: "你好 <b>{name}</b>" } },
    "de-DE": { home: { greeting: "Hallo {name}", rich: "Hallo <b>{name}</b>" } },
  },
}, React.createElement(Greeting))), "<p>Hallo <strong>Ada</strong></p>");
const stored = new Map();
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
});
const storage = createLocalStorageLocaleStorage(runtime, { key: "demo_locale_preference" });
storage.write("de-DE");
assert.equal(stored.get("demo_locale_preference"), "de-DE");
assert.equal(storage.read(), "de-DE");
stored.set("demo_locale_preference", "fr");
assert.equal(storage.read(), undefined);
if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
else delete globalThis.localStorage;
`
          : packed.name === "@raypx/env"
            ? `
import assert from "node:assert/strict";
import { createEnv, defineEnv, EnvError, z as packageZod } from "@raypx/env";
import { runtimeEnv } from "@raypx/env/runtime";
import { z } from "zod";
assert.equal(packageZod, z);
assert.ok(runtimeEnv.shared.NODE_ENV instanceof z.ZodDefault);
const base = {
  extends: [runtimeEnv],
  shared: { PORT: z.string().default("3000").transform(Number) },
};
const nested = {
  extends: [base],
  clientPrefix: "PUBLIC_",
  client: { PUBLIC_ORIGIN: z.url() },
  server: { SECRET: z.string() },
};
const values = {
  NODE_ENV: "test",
  PORT: "  ",
  PUBLIC_ORIGIN: "https://example.test",
  SECRET: "private-placeholder",
};
const server = createEnv({ extends: [nested], isServer: true, runtimeEnv: values });
assert.equal(server.PORT, 3000);
assert.equal(server.NODE_ENV, "test");
assert.equal(server.PUBLIC_ORIGIN, "https://example.test");
assert.equal(server.SECRET, "private-placeholder");
assert.equal(values.PORT, "  ");
assert.ok(server._schema instanceof z.ZodObject);
const browser = createEnv({ extends: [nested], isServer: false, runtimeEnv: values });
assert.equal(browser.PUBLIC_ORIGIN, "https://example.test");
assert.equal(browser.PORT, 3000);
assert.throws(() => browser.SECRET, EnvError);
assert.ok(!Object.keys(browser).includes("SECRET"));
assert.ok(!JSON.stringify({ ...browser }).includes("private-placeholder"));
assert.ok(!Object.hasOwn(browser._schema.shape, "SECRET"));
const finalSchema = z.object({ PORT: z.coerce.number().int() });
const transformed = defineEnv({
  server: { PORT: z.string() },
  runtimeEnv: { PORT: "3002" },
  transform: () => finalSchema,
});
assert.equal(transformed.PORT, 3002);
assert.equal(transformed._schema, finalSchema);
const skipped = defineEnv({
  clientPrefix: "PUBLIC_",
  client: { PUBLIC_NAME: z.string() },
  server: { SECRET: z.string() },
  isServer: false,
  skip: true,
  runtimeEnv: { PUBLIC_NAME: "example", SECRET: "private-placeholder" },
});
assert.equal(skipped.PUBLIC_NAME, "example");
assert.throws(() => skipped.SECRET, EnvError);
assert.throws(
  () => defineEnv({ server: { PORT: z.number().positive().default(-1) }, runtimeEnv: {} }),
  EnvError,
);
`
            : "";
    await writeFile(
      join(consumer, "consumer.mjs"),
      `${imports}\n${runtimeProbe}\nconsole.log(${JSON.stringify(`${packed.name}@${packed.version}: exports loaded and runtime behavior passed`)});\n`,
    );
    run(process.execPath, ["consumer.mjs"], consumer);
    run(node, ["consumer.mjs"], consumer);
    if (packed.name === "@raypx/env") {
      await writeFile(
        join(consumer, ".env.test"),
        "VITE_API_URL=https://api.example.test\nVITE_APP_NAME=artifact-client\nSECRET=private-browser-placeholder\n",
      );
      await writeFile(
        join(consumer, "browser.ts"),
        `
import { createEnv, EnvError, z } from "@raypx/env";
import { runtimeEnv } from "@raypx/env/runtime";
const publicPreset = {
  extends: [runtimeEnv],
  shared: { VITE_APP_NAME: z.string() },
  clientPrefix: "VITE_",
  client: { VITE_API_URL: z.url() },
  server: { SECRET: z.string() },
};
const inheritedPreset = { extends: [publicPreset] };
const env = createEnv({ extends: [inheritedPreset] });
let blocked = false;
try { void env.SECRET; } catch (error) { blocked = error instanceof EnvError; }
export const result = {
  mode: env.NODE_ENV,
  appName: env.VITE_APP_NAME,
  apiUrl: env.VITE_API_URL,
  keys: Object.keys(env),
  blocked,
};
`,
      );
      const { build } = await import("vite-plus");
      await build({
        configFile: false,
        root: consumer,
        mode: "test",
        logLevel: "silent",
        build: {
          outDir: "browser-dist",
          target: "es2022",
          minify: false,
          rolldownOptions: {
            input: join(consumer, "browser.ts"),
            preserveEntrySignatures: "strict",
            output: { entryFileNames: "browser.mjs" },
          },
        },
      });
      assert.ok(
        !(await readFile(join(consumer, "browser-dist/browser.mjs"), "utf8")).includes(
          "private-browser-placeholder",
        ),
        "@raypx/env: Vite must not expose unprefixed environment values",
      );
      await writeFile(
        join(consumer, "browser-consumer.mjs"),
        `
import assert from "node:assert/strict";
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalProcess = Object.getOwnPropertyDescriptor(globalThis, "process");
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
Object.defineProperty(globalThis, "process", { configurable: true, value: undefined });
try {
  const { result } = await import("./browser-dist/browser.mjs");
  assert.equal(result.mode, "test");
  assert.equal(result.appName, "artifact-client");
  assert.equal(result.apiUrl, "https://api.example.test");
  assert.equal(result.blocked, true);
  assert.deepEqual(result.keys.sort(), ["NODE_ENV", "VITE_API_URL", "VITE_APP_NAME"]);
} finally {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete globalThis.window;
  if (originalProcess) Object.defineProperty(globalThis, "process", originalProcess);
  else delete globalThis.process;
}
`,
      );
      run(process.execPath, ["browser-consumer.mjs"], consumer);
      run(node, ["browser-consumer.mjs"], consumer);
      console.log(`${packed.name}@${packed.version}: Vite browser environment passed`);
    }
    console.log(
      `${packed.name}@${packed.version}: tarball, declarations, Bun and Node consumers passed`,
    );
    checked += 1;
  }
  assert.ok(checked > 0, "No public packages were checked.");
} finally {
  if (process.env.TOOLKIT_KEEP_PACK_CHECK === "1") {
    console.log(`Package check files retained at ${temporary}`);
  } else {
    // This path is exclusively created by mkdtemp above, never user-provided.
    await rm(resolve(temporary), { recursive: true, force: true });
  }
}
