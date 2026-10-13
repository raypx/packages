/**
 * @license Apache-2.0, Copyright 2026 Hiago Almeida.
 * EXPLAIN construction adapted from better-drizzle src/shared/client/explain.ts
 * at f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d.
 * Modified: PostgreSQL JSON output, fixed option allowlist, public SQL wrappers;
 * connection handling and cancellation remain the caller's responsibility.
 * Full source and license: ../../NOTICE.md.
 */
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { DrizzleDiagnosticError, type ExplainOptions } from "./types.js";

/** ANALYZE executes the wrapped statement; callers must choose eligible queries. */
export function buildExplain(statement: SQLWrapper, options: ExplainOptions = {}): SQL {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== "analyze" && key !== "buffers") ||
    [options.analyze, options.buffers].some(
      (value) => value !== undefined && typeof value !== "boolean",
    ) ||
    (options.buffers && !options.analyze)
  )
    throw new DrizzleDiagnosticError("INVALID_OPTIONS");
  const parts = ["FORMAT JSON"];
  if (options.analyze) parts.push("ANALYZE true");
  if (options.buffers) parts.push("BUFFERS true");
  return sql`EXPLAIN (${sql.raw(parts.join(", "))}) ${statement}`;
}
