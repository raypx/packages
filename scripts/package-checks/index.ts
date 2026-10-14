import { drizzle } from "./drizzle.js";
import { env } from "./env.js";
import { intl } from "./intl.js";
import type { PackageCheck } from "./shared.js";
import { tsconfig } from "./tsconfig.js";

/** Every public package registers its archive and consumer checks here. */
export const packageChecks: Readonly<Record<string, PackageCheck>> = {
  "@voidmix/drizzle": drizzle,
  "@voidmix/env": env,
  "@voidmix/intl": intl,
  "@voidmix/tsconfig": tsconfig,
};
