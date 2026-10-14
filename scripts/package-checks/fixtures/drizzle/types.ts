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
