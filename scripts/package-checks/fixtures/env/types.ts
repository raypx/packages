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
  runtimeEnv: {
    NODE_ENV: "test",
    PUBLIC_ORIGIN: "https://example.test",
    SECRET: "private-placeholder",
  },
});
const port: number = env.PORT;
const mode: "development" | "production" | "test" = env.NODE_ENV;
const origin: string = env.PUBLIC_ORIGIN;
void port;
void mode;
void origin;
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
