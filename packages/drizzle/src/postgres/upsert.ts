/**
 * @license MIT, Copyright (c) Alec Larson.
 * Adapted from alloc/drizzle-plus src/extensions/internal.ts at
 * 5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9.
 * Modified: standalone PostgreSQL expressions with explicit update keys.
 * Full license and source references: ../../NOTICE.md.
 */
import { getColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

type Columns<T extends PgTable> = T["_"]["columns"];

export function excludedColumn(name: string): SQL {
  return sql`excluded.${sql.identifier(name)}`;
}

export function excludedColumns<T extends PgTable, K extends keyof Columns<T>>(
  table: T,
  ...keys: K[]
): Record<K, SQL> {
  const columns = getColumns(table);
  return Object.fromEntries(
    keys.map((key) => {
      if (!Object.hasOwn(columns, key)) throw new Error(`Unknown update column: ${String(key)}.`);
      const column = columns[key];
      if (!column) throw new Error(`Unknown update column: ${String(key)}.`);
      return [key, excludedColumn(column.name)];
    }),
  ) as Record<K, SQL>;
}
