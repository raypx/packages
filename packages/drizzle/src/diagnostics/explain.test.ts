import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vite-plus/test";
import { buildExplain } from "./explain.js";
import { DrizzleDiagnosticError, type ExplainOptions } from "./types.js";

describe("PostgreSQL EXPLAIN construction", () => {
  const dialect = new PgDialect();
  it("preserves bound values and defaults to a JSON estimate", () => {
    expect(dialect.sqlToQuery(buildExplain(sql`SELECT ${"private-value"}`))).toEqual({
      sql: "EXPLAIN (FORMAT JSON) SELECT $1",
      params: ["private-value"],
    });
  });
  it("requires explicit execution before collecting buffer metrics", () => {
    expect(
      dialect.sqlToQuery(buildExplain(sql`SELECT 1`, { analyze: true, buffers: true })).sql,
    ).toBe("EXPLAIN (FORMAT JSON, ANALYZE true, BUFFERS true) SELECT 1");
  });
  it.each([null, [], { analyze: "yes" }, { buffers: true }, { format: "text" }])(
    "rejects malformed or unsupported options: %j",
    (options) => {
      expect(() => buildExplain(sql`SELECT 1`, options as ExplainOptions)).toThrow(
        new DrizzleDiagnosticError("INVALID_OPTIONS"),
      );
    },
  );
});
