/**
 * Adapted from better-drizzle src/shared/query/compiler.ts at
 * f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d.
 * @license Apache-2.0, Copyright 2026 Hiago Almeida.
 * Modified for @raypx/drizzle: explicit path segments, public SQL wrappers, CASE-guarded
 * scalar casts and finite-number decoding; no filter compiler or dotted paths.
 * Full license and source references: ../../NOTICE.md.
 */
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";

function pathExpression(path: readonly string[]): SQL {
  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    [...path].some((segment) => typeof segment !== "string" || segment.includes("\0"))
  ) {
    throw new TypeError("JSON paths require one or more string segments without NUL bytes.");
  }
  return sql`ARRAY[${sql.join(
    path.map((segment) => sql`${segment}`),
    sql`, `,
  )}]::text[]`;
}

/** Missing paths yield SQL NULL; JSON null remains a JSON null value. */
export function jsonValue(source: SQLWrapper, path: readonly string[]): SQL<JsonValue> {
  return sql<JsonValue>`(${source} #> ${pathExpression(path)})`;
}

/** PostgreSQL text extraction; containers and scalar values become text. */
export function jsonText(source: SQLWrapper, path: readonly string[]): SQL<string | null> {
  return sql<string | null>`(${source} #>> ${pathExpression(path)})`;
}

/** JSON null is the string "null"; a missing path or SQL NULL yields SQL NULL. */
export function jsonType(source: SQLWrapper, path: readonly string[]): SQL<JsonType | null> {
  return sql<JsonType | null>`jsonb_typeof(${jsonValue(source, path)})`;
}

function finiteNumber(value: unknown): number | null {
  if (value === null) return null;
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number)) throw new TypeError("Expected a finite PostgreSQL number.");
  return number;
}

/** Missing, JSON null and non-number values yield SQL NULL before the cast. */
export function jsonNumber(source: SQLWrapper, path: readonly string[]): SQL<number | null> {
  return sql<number | null>`CASE WHEN ${jsonType(source, path)} = 'number'
    THEN ${jsonText(source, path)}::double precision ELSE NULL END`.mapWith(finiteNumber);
}

/** Missing, JSON null and non-boolean values yield SQL NULL before the cast. */
export function jsonBoolean(source: SQLWrapper, path: readonly string[]): SQL<boolean | null> {
  return sql<boolean | null>`CASE WHEN ${jsonType(source, path)} = 'boolean'
    THEN ${jsonText(source, path)}::boolean ELSE NULL END`.mapWith((value: unknown) => {
    if (value === null || typeof value === "boolean") return value;
    throw new TypeError("Expected a PostgreSQL boolean.");
  });
}
