# @raypx/env

## 0.0.6

First release from `raypx/packages`, continuing the existing `@raypx/env` npm
package previously maintained in `raypx-kit`. Earlier npm versions remain immutable.

- Extract typed `createEnv` and `defineEnv` without product variables or application configuration.
- Preserve nested presets, later schema overrides, inferred output types, blank-value normalization,
  defaults, schema transforms and custom error hooks.
- Correct inherited-only preset output inference under TypeScript 7 while preserving runtime behavior.
- Keep browser access limited to declared shared and public variables.
- Export the reusable `NODE_ENV` preset through `@raypx/env/runtime`.
- Keep Zod external as a required peer so consumer schemas share one Zod runtime.
