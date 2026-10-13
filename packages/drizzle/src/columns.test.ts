import { getColumns } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

const members = pgTable("test_members", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
import { withoutColumns } from "./columns.js";
import { excludedColumn, excludedColumns } from "./postgres/upsert.js";

describe("typed column helpers", () => {
  it("omits metadata without mutating the table or losing column types", () => {
    expectTypeOf(withoutColumns).parameter(0).toExtend<PgTable>();
    const projection = withoutColumns(members, "id", "createdAt", "updatedAt");
    expect(Object.keys(projection).sort()).toEqual(["projectId", "role", "status", "userId"]);
    expect(projection.projectId).toBe(members.projectId);
    expect(getColumns(members).id).toBe(members.id);
    expectTypeOf(projection).toEqualTypeOf<
      Omit<(typeof members)["_"]["columns"], "id" | "createdAt" | "updatedAt">
    >();
  });

  it("maps only the chosen update keys to physical PostgreSQL column names", () => {
    const update = excludedColumns(members, "role", "status", "updatedAt");
    expect(Object.keys(update).sort()).toEqual(["role", "status", "updatedAt"]);
    expect(new PgDialect().sqlToQuery(update.updatedAt)).toEqual({
      sql: 'excluded."updated_at"',
      params: [],
    });
    expectTypeOf(update).toHaveProperty("updatedAt");
    expectTypeOf(update).not.toHaveProperty("id");
  });

  it("quotes identifiers rather than accepting SQL fragments", () => {
    expect(new PgDialect().sqlToQuery(excludedColumn('role"; drop table users; --'))).toEqual({
      sql: 'excluded."role""; drop table users; --"',
      params: [],
    });
  });

  it.each(["missing", "constructor", "__proto__"])(
    "rejects unknown JavaScript update keys, including inherited properties: %s",
    (key) => {
      expect(() => excludedColumns(members, key as keyof (typeof members)["_"]["columns"])).toThrow(
        "Unknown update column",
      );
    },
  );
});
