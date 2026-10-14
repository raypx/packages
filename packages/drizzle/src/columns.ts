/**
 * @license MIT, Copyright (c) Alec Larson.
 * Adapted from alloc/drizzle-plus at 5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9.
 * Modified for @voidmix/drizzle: explicit functions and update keys, without prototype extensions.
 * Full license and source references: ../NOTICE.md.
 */
import { getColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

type Columns<T extends PgTable> = T["_"]["columns"];

export function withoutColumns<T extends PgTable, K extends keyof Columns<T>>(
  table: T,
  ...keys: K[]
): Omit<Columns<T>, K> {
  const columns = { ...getColumns(table) };
  for (const key of keys) delete columns[key];
  return columns;
}
