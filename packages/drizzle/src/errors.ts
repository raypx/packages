/**
 * Adapted from better-drizzle src/shared/errors.ts at
 * f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d.
 * @license Apache-2.0, Copyright 2026 Hiago Almeida.
 * Modified for @voidmix/drizzle: postgres.js-only constraint_name matching and
 * cycle-safe cause traversal; no message parsing or node-postgres metadata.
 * Full license and source references: ../NOTICE.md.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const seen = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const fields = current as {
      code?: unknown;
      constraint_name?: unknown;
      cause?: unknown;
    };
    if (fields.code === "23505" && fields.constraint_name === constraint) return true;
    current = fields.cause;
  }
  return false;
}
