# @voidmix/env

## 0.0.0-alpha.3

### Patch Changes

- 34bf76b: Accept any Zod 4 release as the peer dependency instead of requiring exactly 4.6.7, so applications keep a single shared Zod runtime without matching the development pin.

## 0.0.0-alpha.2

### Patch Changes

- Export InferEnv type helper for explicit type inference

## 0.0.0-alpha.1

### Patch Changes

- Add `InferEnv` helper type to work around TypeScript's type inference limits with deeply nested preset chains

## 0.0.0-alpha.0

Initial prerelease.

- Extract typed `createEnv` and `defineEnv` without product variables or application configuration.
- Preserve nested presets, later schema overrides, inferred output types, blank-value normalization,
  defaults, schema transforms and custom error hooks.
- Correct inherited-only preset output inference under TypeScript 7 while preserving runtime behavior.
- Keep browser access limited to declared shared and public variables.
- Export the reusable `NODE_ENV` preset through `@voidmix/env/runtime`.
- Keep Zod external as a required peer so consumer schemas share one Zod runtime.
