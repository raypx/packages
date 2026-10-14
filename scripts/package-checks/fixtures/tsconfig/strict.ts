// @ts-expect-error verbatimModuleSyntax requires type-only imports to use import type.
import { Shape } from "./shape.js";
const shape: Shape = { value: "preset" };
void shape;
const values: string[] = [];
// @ts-expect-error noUncheckedIndexedAccess includes undefined in indexed reads.
const first: string = values[0];
void first;
interface Options {
  limit?: number;
}
// @ts-expect-error exactOptionalPropertyTypes rejects explicitly undefined optional keys.
const options: Options = { limit: undefined };
void options;
class Base {
  run(): void {}
}
export class Derived extends Base {
  // @ts-expect-error noImplicitOverride requires the override modifier.
  run(): void {}
}
try {
  void shape;
} catch (error) {
  // @ts-expect-error useUnknownInCatchVariables types catch variables as unknown.
  error.message;
}
