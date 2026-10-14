import assert from "node:assert/strict";

import { readArchived, type PackageCheck } from "./shared.js";

export const drizzle: PackageCheck = {
  assertArchive({ archive, entries, manifest, packed }) {
    assert.ok(![...entries].some((entry) => entry.startsWith("package/docs/")));
    assert.ok(![...entries].some((entry) => entry.startsWith("package/dist/pg/")));
    assert.ok(!Object.hasOwn(packed.exports, "./pg"));
    assert.equal(packed.peerDependencies?.postgres, "3.4.9");
    assert.equal(packed.peerDependenciesMeta?.postgres?.optional, true);
    // Adapted upstream code must ship its complete notices and licenses.
    assert.ok(manifest.files?.includes("NOTICE.md"), `${packed.name}: NOTICE.md must be published`);
    const notices = readArchived(archive, "NOTICE.md");
    const license = readArchived(archive, "LICENSE");
    assert.ok(notices.includes("Copyright (c) Alec Larson"));
    assert.ok(notices.includes("Permission is hereby granted, free of charge"));
    assert.ok(license.includes("Copyright 2026 Hiago Almeida"));
    assert.ok(license.includes("END OF TERMS AND CONDITIONS"));
  },
  typeProbe: `
import { withoutColumns } from "@voidmix/drizzle";
import { jsonNumber, excludedColumns } from "@voidmix/drizzle/postgres";
import { pgTable, integer, text, jsonb } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { SQL } from "drizzle-orm";
const users = pgTable("users", { id: integer(), secret: text(), data: jsonb() });
const projection = withoutColumns(users, "secret");
projection.id;
// @ts-expect-error Excluded columns cannot be read from the inferred projection.
projection.secret;
// @ts-expect-error Unknown schema keys must be rejected.
withoutColumns(users, "missing");
const updates = excludedColumns(users, "secret");
updates.secret;
// @ts-expect-error An explicit update mapping contains only the chosen keys.
updates.id;
const count: SQL<number | null> = jsonNumber(users.data, ["count"]);
void count;
const unsupported = sqliteTable("unsupported", { value: sqliteText() });
// @ts-expect-error The extension supports PostgreSQL tables only.
withoutColumns(unsupported, "value");
const client = postgres({ host: "127.0.0.1", port: 1, max: 1, prepare: false });
const db = drizzle({ client });
db.select({ id: users.id, count }).from(users).toSQL();
await client.end();
`,
  runtimeProbe: `
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
assert.equal(dialect.sqlToQuery(excludedColumns(users, "secret").secret).sql, 'excluded."private_value"');
assert.equal(isUniqueViolation({ cause: { code: "23505", constraint_name: "users_key" } }, "users_key"), true);
assert.equal(isUniqueViolation({ code: "23505", constraint_name: "other_key" }, "users_key"), false);
assert.equal(isUniqueViolation({ code: "23505", constraint: "users_key" }, "users_key"), false);
assert.equal(isUniqueViolation({ code: "23505", constraint_name: null, constraint: "users_key" }, "users_key"), false);
await assert.rejects(import("@voidmix/drizzle/pg"));
const client = postgres({ host: "127.0.0.1", port: 1, max: 1, prepare: false });
const db = drizzle({ client });
const selection = db.select({ value: jsonText(users.data, ["user.name"]) }).from(users).toSQL();
assert.deepEqual(selection.params, ["user.name"]);
await client.end();
assert.equal(await first(Promise.resolve([])), null);
assert.deepEqual(await inserted(Promise.resolve([{ id: 1 }]), "insert user"), { id: 1 });
await assert.rejects(inserted(Promise.resolve([]), "insert user"));
`,
};
