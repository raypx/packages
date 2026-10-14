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
