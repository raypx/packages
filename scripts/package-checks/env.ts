import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { byText, node, run, type PackageCheck } from "./shared.js";

export const env: PackageCheck = {
  assertArchive({ manifest, packed }) {
    assert.equal(packed.peerDependencies?.zod, manifest.devDependencies?.zod);
    assert.notEqual(packed.peerDependenciesMeta?.zod?.optional, true);
    assert.ok(!Object.hasOwn(packed.dependencies || {}, "zod"));
    assert.deepEqual(Object.keys(packed.exports).sort(byText), [".", "./runtime"]);
  },
  typeProbe: `
import { createEnv, defineEnv, type Preset } from "@voidmix/env";
import { runtimeEnv } from "@voidmix/env/runtime";
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
`,
  runtimeProbe: `
import assert from "node:assert/strict";
import { createEnv, defineEnv, EnvError, z as packageZod } from "@voidmix/env";
import { runtimeEnv } from "@voidmix/env/runtime";
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
`,
  async afterRuntime({ consumer, packed }) {
    await writeFile(
      join(consumer, ".env.test"),
      "VITE_API_URL=https://api.example.test\nVITE_APP_NAME=artifact-client\nSECRET=private-browser-placeholder\n",
    );
    await writeFile(
      join(consumer, "browser.ts"),
      `
import { createEnv, EnvError, z } from "@voidmix/env";
import { runtimeEnv } from "@voidmix/env/runtime";
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
      "@voidmix/env: Vite must not expose unprefixed environment values",
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
  },
};
