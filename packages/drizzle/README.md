# @voidmix/drizzle

Drizzle extensions for PostgreSQL with postgres.js, maintained in
[Voidmix](https://github.com/raypx/voidmix).
Each package has its own version and changelog.

This initial package implements a small, tested base. The complete inventories
below include every upstream capability, including features not yet implemented.

## Current API

| Import                         | Exports                                                                                               | Dialect                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| `@voidmix/drizzle`             | `withoutColumns`                                                                                      | PostgreSQL tables          |
| `@voidmix/drizzle/postgres`    | `excludedColumn`, `excludedColumns`, `jsonValue`, `jsonText`, `jsonType`, `jsonNumber`, `jsonBoolean` | PostgreSQL                 |
| `@voidmix/drizzle/errors`      | `isUniqueViolation`                                                                                   | postgres.js error metadata |
| `@voidmix/drizzle/results`     | `first`, `inserted`                                                                                   | Promise-like row arrays    |
| `@voidmix/drizzle/diagnostics` | `buildExplain`, `summarizePlan`, `DrizzleDiagnosticError`                                             | PostgreSQL                 |

Compatibility is currently the exact tested Drizzle version
`1.0.0-rc.5-5935859`, with `postgres@3.4.9` and `drizzle-orm/postgres-js`.
PostgreSQL is the only supported database, and postgres.js is the only supported
driver. npm `pg` / node-postgres and other PostgreSQL adapters are unsupported.
Runtime code uses public Drizzle APIs and has no Raypx, Node or Bun imports.
Drizzle remains a peer dependency, and ESM/declarations are published in `dist/`.
`postgres` is an optional peer because SQL expression construction does not load
the driver. Database consumers install it explicitly and supply their own client.
Drizzle's `pg-core`, `pgTable`, `PgTable` and `PgDialect` refer to the PostgreSQL
dialect; these names are independent of the npm `pg` driver.

```bash
bun add @voidmix/drizzle drizzle-orm@1.0.0-rc.5-5935859 postgres@3.4.9
```

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { withoutColumns } from "@voidmix/drizzle";
import { excludedColumns, jsonNumber } from "@voidmix/drizzle/postgres";

const client = postgres(databaseUrl);
const db = drizzle({ client });

const memberFields = withoutColumns(members, "createdAt", "updatedAt");
const update = excludedColumns(members, "role", "status", "updatedAt");

await db
  .insert(members)
  .values(input)
  .onConflictDoUpdate({
    target: [members.projectId, members.userId],
    set: update,
  });

const rows = await db.select({ tokens: jsonNumber(usage.data, ["inputTokens"]) }).from(usage);
```

Column omission preserves Drizzle column types and does not change table metadata.
UPSERT mappings use explicitly selected physical column names; the caller supplies
the conflict target and retains ownership of transactions.

## JSONB semantics

Paths are segment arrays: `["settings", "plan.tier"]` addresses the literal key
`plan.tier` below `settings`. Every segment is bound; dot splitting is not used.
Empty paths, NUL bytes, sparse arrays and non-string segments are rejected.

`jsonValue` preserves JSON values. `jsonText` uses PostgreSQL text extraction,
including JSON containers converted to text. `jsonType` distinguishes JSON null
(`"null"`) from a missing path (SQL NULL). `jsonNumber` and `jsonBoolean` return
SQL NULL for missing, JSON null or incorrectly typed values, using CASE before
casting. Numeric result decoding rejects non-finite numbers.

An outer aggregate does not inherit an inner expression's decoder. Consumers
must validate aggregate results explicitly. Accounting or authorization queries
must choose their own policy for malformed stored data; nullable helpers do not
authorize ignoring it.

## Diagnostics

```ts
import { buildExplain, summarizePlan } from "@voidmix/drizzle/diagnostics";

const result = await db.execute(buildExplain(statement));
const summary = summarizePlan(result[0]?.["QUERY PLAN"]);
```

Default EXPLAIN returns JSON estimates without executing the statement.
`{ analyze: true, buffers: true }` explicitly executes it and collects buffer
metrics. The library constructs SQL and summarizes plans; the caller owns query
eligibility, connections, transaction access mode, database cancellation and
timeout settings. `summarizePlan` copies only structure and numeric metrics,
with bounded traversal, and excludes predicates, query text and parameters.

`isUniqueViolation(error, constraintName)` recognizes only SQLSTATE `23505` and
the exact supplied `constraint_name` returned by postgres.js, including
cycle-safe wrapped causes. Node-postgres's `constraint` field is unsupported.
It neither parses messages nor maps to an application's business errors.

## Complete upstream inventory and merge plan

- [drizzle-plus capabilities](https://github.com/raypx/voidmix/blob/main/docs/drizzle/drizzle-plus-capabilities.md)
- [better-drizzle capabilities](https://github.com/raypx/voidmix/blob/main/docs/drizzle/better-drizzle-capabilities.md)
- [Combined extension design](https://github.com/raypx/voidmix/blob/main/docs/drizzle/merge-plan.md)
- [Source provenance and licenses](NOTICE.md)

The package adapts selected MIT and Apache-2.0 sources. Full source licenses,
copyright and modification notices are distributed alongside the package.
Capability inventories and design documents are maintained in the repository's
root `docs/` directory and are not included in the npm archive.

## Development

From the repository root, using Bun 1.4.0:

```bash
bun install --frozen-lockfile
bun run verify
```

Releases use independent Changesets. See the repository's
[release guide](https://github.com/raypx/voidmix/blob/main/README.md#independent-releases).
