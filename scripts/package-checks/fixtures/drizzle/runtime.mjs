import assert from "node:assert/strict";
import { withoutColumns } from "@voidmix/drizzle";
import { jsonText, excludedColumns } from "@voidmix/drizzle/postgres";
import { isUniqueViolation } from "@voidmix/drizzle/errors";
import { first, inserted } from "@voidmix/drizzle/results";
import { pgTable, integer, text, jsonb, PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const users = pgTable("users", { id: integer(), secret: text("private_value"), data: jsonb() });
assert.deepEqual(Object.keys(withoutColumns(users, "secret")), ["id", "data"]);
assert.equal(users.secret.name, "private_value");
const dialect = new PgDialect();
const textQuery = dialect.sqlToQuery(jsonText(users.data, ["user.name"]));
assert.deepEqual(textQuery.params, ["user.name"]);
assert.ok(!textQuery.sql.includes("user.name"));
assert.equal(
  dialect.sqlToQuery(excludedColumns(users, "secret").secret).sql,
  'excluded."private_value"',
);
assert.equal(
  isUniqueViolation({ cause: { code: "23505", constraint_name: "users_key" } }, "users_key"),
  true,
);
assert.equal(
  isUniqueViolation({ code: "23505", constraint_name: "other_key" }, "users_key"),
  false,
);
assert.equal(isUniqueViolation({ code: "23505", constraint: "users_key" }, "users_key"), false);
assert.equal(
  isUniqueViolation({ code: "23505", constraint_name: null, constraint: "users_key" }, "users_key"),
  false,
);
await assert.rejects(import("@voidmix/drizzle/pg"));
const client = postgres({ host: "127.0.0.1", port: 1, max: 1, prepare: false });
const db = drizzle({ client });
const selection = db
  .select({ value: jsonText(users.data, ["user.name"]) })
  .from(users)
  .toSQL();
assert.deepEqual(selection.params, ["user.name"]);
await client.end();
assert.equal(await first(Promise.resolve([])), null);
assert.deepEqual(await inserted(Promise.resolve([{ id: 1 }]), "insert user"), { id: 1 });
await assert.rejects(inserted(Promise.resolve([]), "insert user"));
