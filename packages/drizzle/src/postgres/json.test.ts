import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";
import {
  jsonBoolean,
  jsonNumber,
  jsonText,
  jsonType,
  jsonValue,
  type JsonType,
  type JsonValue,
} from "./json.js";

const source = sql`document`;
const sparsePath: string[] = [];
sparsePath.length = 1;
const dialect = new PgDialect();

async function decoded<T>(expression: SQL<T>, value: unknown): Promise<T | undefined> {
  const client = postgres({ max: 1 });
  const result = Object.assign(Promise.resolve([{ value }]), {
    values: async () => [[value]],
  });
  const execute = vi
    .spyOn(client, "unsafe")
    .mockReturnValue(result as unknown as ReturnType<typeof client.unsafe>);
  try {
    const db = drizzle({ client });
    const rows = await db.select({ value: expression }).from(sql`(select 1) as unit`);
    return rows[0]?.value;
  } finally {
    execute.mockRestore();
    await client.end();
  }
}

describe("JSONB expressions", () => {
  it("binds each path segment without splitting or interpolating keys", () => {
    const path = ["with.dot", 'quote"; DROP TABLE users; --', "", "0"];
    const query = dialect.sqlToQuery(jsonValue(source, path));
    expect(query.sql).toBe("(document #> ARRAY[$1, $2, $3, $4]::text[])");
    expect(query.params).toEqual(path);
    expect(dialect.sqlToQuery(jsonText(source, path)).sql).toBe(
      "(document #>> ARRAY[$1, $2, $3, $4]::text[])",
    );
  });

  it("keeps input paths unchanged and constructs independent expressions", () => {
    const path = Object.freeze(["usage", "inputTokens"]);
    const first = jsonNumber(source, path);
    const second = jsonNumber(source, path);
    expect(first).not.toBe(second);
    expect(dialect.sqlToQuery(first).params).toEqual([...path, ...path]);
    expect(path).toEqual(["usage", "inputTokens"]);
  });

  it.each([[], sparsePath, ["nul\0key"], [undefined], [3], "key", null])(
    "rejects invalid paths: %j",
    (path) => {
      expect(() => jsonValue(source, path as readonly string[])).toThrow(TypeError);
    },
  );

  it("guards scalar casts with CASE rather than relying on WHERE evaluation order", () => {
    const numberQuery = dialect.sqlToQuery(jsonNumber(source, ["usage"]));
    expect(numberQuery.sql).toMatch(
      /CASE WHEN jsonb_typeof\(\(document #> ARRAY\[\$1\]::text\[\]\)\) = 'number'\s+THEN \(document #>> ARRAY\[\$2\]::text\[\]\)::double precision ELSE NULL END/,
    );
    const booleanQuery = dialect.sqlToQuery(jsonBoolean(source, ["enabled"]));
    expect(booleanQuery.sql).toContain("= 'boolean'");
    expect(booleanQuery.sql).toContain("::boolean ELSE NULL END");
  });

  it("preserves nullable result types and JSON type discrimination", () => {
    expectTypeOf(jsonValue(source, ["payload"])).toEqualTypeOf<SQL<JsonValue>>();
    expectTypeOf(jsonText(source, ["name"])).toEqualTypeOf<SQL<string | null>>();
    expectTypeOf(jsonType(source, ["name"])).toEqualTypeOf<SQL<JsonType | null>>();
    expectTypeOf(jsonNumber(source, ["usage"])).toEqualTypeOf<SQL<number | null>>();
    expectTypeOf(jsonBoolean(source, ["enabled"])).toEqualTypeOf<SQL<boolean | null>>();
  });

  it.each([0, 1.5, -3, "12.5", "-2.5e+2"])("decodes finite numeric results: %j", async (value) => {
    expect(await decoded(jsonNumber(source, ["usage"]), value)).toBe(Number(value));
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "Infinity",
    "NaN",
    "",
    " ",
    "0x10",
    true,
    {},
  ])("rejects invalid numeric driver results: %j", async (value) => {
    await expect(decoded(jsonNumber(source, ["usage"]), value)).rejects.toThrow(
      "Expected a finite PostgreSQL number.",
    );
  });

  it.each([true, false])("preserves boolean driver results: %j", async (value) => {
    expect(await decoded(jsonBoolean(source, ["enabled"]), value)).toBe(value);
  });

  it("rejects driver values that are not PostgreSQL booleans", async () => {
    await expect(decoded(jsonBoolean(source, ["enabled"]), "false")).rejects.toThrow(
      "Expected a PostgreSQL boolean.",
    );
  });

  it("preserves SQL NULL through Drizzle result mapping", async () => {
    expect(await decoded(jsonNumber(source, ["missing"]), null)).toBeNull();
    expect(await decoded(jsonBoolean(source, ["missing"]), null)).toBeNull();
    expect(await decoded(jsonText(source, ["missing"]), null)).toBeNull();
    expect(await decoded(jsonValue(source, ["missing"]), null)).toBeNull();
  });
});
