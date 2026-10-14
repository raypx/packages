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
try {
  void env.SECRET;
} catch (error) {
  blocked = error instanceof EnvError;
}
export const result = {
  mode: env.NODE_ENV,
  appName: env.VITE_APP_NAME,
  apiUrl: env.VITE_API_URL,
  keys: Object.keys(env),
  blocked,
};
