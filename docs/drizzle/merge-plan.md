# Drizzle Integration and Extension Plan

Status: Packages now contains the complete design and capability inventories.
The current version implements only the foundation capabilities explicitly
identified below. The query client, relation compiler and plugins remain planned
work, not existing exports. Every upstream capability belongs in the inventory,
whether or not Raypx currently uses it.

## Goals and ownership

The repository is `raypx/packages`, with `@raypx/drizzle` as its first package.
Packages maintains shared build, test, documentation and release tooling. Each
package has its own version, CHANGELOG and npm artifact. All Drizzle subpaths
belong to one package and use that package's version.

The extension library serves Drizzle applications using PostgreSQL and
postgres.js, the npm package `postgres`. Raypx is its first consumer. Account
authorization, billing rules, Run leases and fences, business errors, application
tables, environment variables and migration execution stay with the application.
The library creates no default database connection, reads no `.env` files and
does not modify global query prototypes.

## Pinned sources and complete inventories

| Source                                                        | Version / commit                                          | Original license | Integration boundary                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| [drizzle-plus](https://github.com/alloc/drizzle-plus)         | `1.0.0-rc.8` / `5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9` | MIT              | Selections, SQL expressions, CTEs, query extensions and type utilities                      |
| [better-drizzle](https://github.com/almeidazs/better-drizzle) | `0.3.0` / `f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d`      | Apache-2.0       | Query semantics, relations, bulk writes, prepared queries, diagnostics and optional plugins |

The itemized inventories and source evidence are in the
[drizzle-plus inventory](drizzle-plus-capabilities.md) and
[better-drizzle inventory](better-drizzle-capabilities.md). They distinguish
implemented behavior, declarations without implementations, internal supporting
code and entry points actually included in published artifacts. A wildcard
export does not prove that its target artifact exists. Full licenses, source
commits and adaptation notes are recorded in
[NOTICE](../../packages/drizzle/NOTICE.md).

The two libraries cannot be combined unchanged. Many drizzle-plus features depend
on global prototypes and internal query state. The original better-drizzle peer
range, `>=1.0.0-rc.4 <1.0.0-rc.5`, excludes the current RC.5. This plan merges APIs
and semantics by capability while replacing unstable implementation mechanisms.

### Fixed implementation scope

PostgreSQL is the only database implemented. postgres.js, the npm package
`postgres`, is the only supported driver, through `drizzle-orm/postgres-js`.
`pg` / node-postgres is incompatible, and the library will not introduce an
abstract executor for multiple drivers. Drizzle's official `pg-core` table and
SQL types remain the PostgreSQL modeling API; their names do not imply a
dependency on the npm package `pg`.

All upstream MySQL and SQLite entry points, functions, types and internal
differences remain fully documented. Their status is **retained in the inventory,
outside the current implementation scope**. Neither `./mysql` nor `./sqlite`,
nor a later porting phase for those databases, is planned. The ability to compose
a pure expression does not establish support for another driver. Bun SQL, PGlite
and all other drivers are outside the compatibility commitment.

## Available foundation

| Subpath         | Implemented capabilities                                         | Semantics                                                                                       |
| --------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.`             | `withoutColumns`                                                 | Preserve Drizzle column types without modifying the table object                                |
| `./postgres`    | `excludedColumn`, `excludedColumns`                              | Explicit update fields using physical column names and quoted identifiers                       |
| `./postgres`    | `jsonValue`, `jsonText`, `jsonType`, `jsonNumber`, `jsonBoolean` | Bind each path segment; guard scalar conversions with CASE; distinguish SQL NULL from JSON null |
| `./errors`      | `isUniqueViolation`                                              | Classify by SQLSTATE and exact constraint; follow nested causes with cycle protection           |
| `./results`     | `first`, `inserted`                                              | Empty reads return null; writes that require a returned row can fail explicitly                 |
| `./diagnostics` | `buildExplain`, `summarizePlan`                                  | Plan without execution by default; require explicit ANALYZE; emit only allowlisted metrics      |

Builds include ESM, declarations and sourcemaps. Drizzle is a peer dependency and
is never bundled. The current compatibility commitment covers only the tested
combination of `drizzle-orm@1.0.0-rc.5-5935859`, `postgres@3.4.9` and PostgreSQL 17.
The former `./pg` subpath has been replaced by `./postgres`, without an alias.
There are no Node- or Bun-specific runtime imports and no runtime dependencies
on Raypx workspaces.

## Unified module design

The following future subpaths are design targets. Apart from the foundation
exports listed above, they are not yet exported.

| Module                             | Capabilities to integrate                                                                                    | Implementation approach                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `.` / `./sql`                      | Column projection, toSQL, CASE, coalesce/nullif, text/numeric/time functions and public types                | Composable pure functions using Drizzle's public SQLWrapper and explicit decoders                                                 |
| `./postgres`                       | Casts, JSON aggregation/objects/paths/patches, excluded, VALUES, CTE materialization and UUID time functions | PostgreSQL-specific ASTs and expressions, with a declared PG version requirement for each capability                              |
| `./query`                          | CRUD, count/exists, pagination, bulk operations, prepared queries, locks and scopes                          | Use public PostgresJsDatabase/PostgresJsTransaction capabilities directly; create an explicit local client                        |
| `./relations`                      | include/select, some/every/none/is, relation ordering and nested connect/set/disconnect                      | One relation planner with explicit schema/relations input; reads and writes share the same transaction                            |
| `./diagnostics`                    | PostgreSQL EXPLAIN construction, result summaries and plan comparison                                        | Separate SQL construction from pure plan processing; a postgres.js executor handles timeout/cancellation through explicit handles |
| `./plugins/*`                      | timestamps, uuid, rules, tenant, soft-delete, cache and validation                                           | Explicit registration and independently importable plugins; optional dependencies belong only to their entry points               |
| `./compat/plus`, `./compat/better` | Original API names and migration mappings                                                                    | Delegate to the unified implementation and document differences; do not maintain a second compiler                                |
| `./types`, `./testing`             | Result/nullability/path/selection types, PostgreSQL capability gates and test helpers                        | Derive from the unified IR, public PG table model and postgres.js types; avoid a generic multiple-driver type system              |

The first release remains one npm package, with subpaths separating capabilities.
A separate npm package is justified only when a plugin has a different
maintenance cycle, substantial independent dependencies or its own consumers;
`@raypx/drizzle-cache` is one possible example. Every new package must define its
independent version and dependency constraints.

## Decisions for overlapping capabilities

| Overlapping area                       | Unified semantics                                                                                                                    | Treatment of the upstream implementations                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| findUnique/findFirst/findOne           | `findFirst` is nullable; `findUnique` must prove a complete unique key; `findOne` is only a compatibility alias                      | Keep one query executor; proving uniqueness for a partial unique index also requires its predicate   |
| count/exists/findManyAndCount/paginate | Counts and data share a filter AST; offset pagination returns total, while keyset pagination does not add a count by default         | The caller explicitly selects a transaction snapshot mode for page/count consistency                 |
| `$cursor`/cursor                       | Stable keyset pagination across multiple fields, with explicit ascending/descending order, NULL ordering and forward/backward paging | Generate predicates once; consumers inject the cursor codec and context binding                      |
| create/createMany/upsert/upsertMany    | Single and bulk writes share an executor; update keys and conflict targets are explicit                                              | Conflict-target inference is an explicit opt-in and must not silently overwrite business fields      |
| updateMany                             | Apply the same set to multiple rows; define where/limit/order/returning according to PostgreSQL                                      | Distinguish it from `updateEach`; plus updateMany is not a bulk update with different values per row |
| updateEach                             | Different values per row, identified by the same matching key, using a unified CASE or VALUES/JOIN strategy                          | Define duplicate input keys, empty input, parameter budgets and transactions across chunks           |
| orThrow/`.throw()`                     | Separate nullable results from required results; allow an injected error factory                                                     | Do not change the original Promise or execute prototypes; compatibility methods only wrap results    |
| JSON selection/JSONB compiler          | Explicit JSON expressions, path IR and decoders; selection and filtering reuse the same rules                                        | Avoid hidden `.decoder` or `_getQuery` introspection; test SQL NULL and JSON null separately         |
| timestamps                             | Assign UTC-aware types and default values as separate responsibilities                                                               | Schema defaults, write plugins and SQL current-time expressions must not override each other         |
| errors                                 | Classify structured postgres.js SQLSTATE errors; consumers own business mappings                                                     | Preserve the original error for caller diagnostics; logs use a separate safe summary                 |
| Type utilities                         | One set of value/selection/filter/returning types                                                                                    | Publish compatibility aliases without evaluating two complex recursive type systems                  |

## Query and relation boundaries

The following illustrates the future client shape. It is not an executable API
exported by the current package:

```ts
// The caller creates sql with postgres(...) and owns max/prepare, connections and shutdown.
const db = drizzle({ client: sql, relations });
const extended = extendDatabase(db, {
  client: sql,
  tables,
  relations,
  plugins: [timestamps(options)],
});

await extended.transaction(async (tx) => {
  await tx.table(users).upsert({ data, target: [users.email], update: [users.name] });
});
```

- Supply tables/relations/client explicitly. There is no switchable dialect or
  driver, and metadata or underlying connections are not discovered through
  private `db._`, session or dialect fields. The execution core accepts public
  `PostgresJsDatabase<TRelations>` or `PostgresJsTransaction<TRelations>` values and
  uses their public select/insert/update/delete/execute/transaction capabilities.
- Leave the original `db` unchanged. A transaction wrapper must bind to the
  original tx; every query, nested relation write, lock and hook uses that tx.
  A transaction explicitly provided by the application cannot be replaced with
  another connection.
- The caller owns postgres.js `Sql` creation, pool size, prepare configuration
  and connection shutdown. The extension library never calls a shared
  client.end(). Explicit raw execution may accept a caller-owned Sql or
  TransactionSql. TransactionSql is valid only during its transaction/savepoint
  lifetime, exposes no pool shutdown API and is never constructed or inferred
  through private Drizzle transaction fields.
- The filter IR retains AND/OR/NOT and relation nodes. Query reuse must declare
  its merge strategy: authorization conditions combine with AND. A later object
  cannot remove an earlier restriction by overwriting the same field.
- include/select share one relation read plan, batching reads by relation node
  rather than querying each row. Relation counts, parent filtering and ordering
  SQL, and child-record pagination are separate capabilities with separate
  verification.
- A single update/delete must affect at most one row. Bulk operations over an
  entire table require an explicit authorization-like parameter. An empty where
  cannot mean an unrestricted operation in one entry point and a silent no-op
  or something else in another. Preserve better-drizzle's unconditional bulk
  no-op only in the compatibility layer and document the difference.
- Bulk counts represent rows actually affected by PostgreSQL, not the number
  of input rows sent. Obtain results through RETURNING or a verified postgres.js
  RowList.count, defining count semantics for conflict-do-nothing, upsert,
  triggers and empty input. Do not add a multiple-driver count adapter.
- Existing connect/disconnect/set implementations are included in the porting
  work. Mark nested create, connectOrCreate, groupBy/aggregate and other upstream
  areas that have declarations but no evaluator as new development.

## Cursor and prepared-query integration

Cursors use a serializable IR of `{ version, order, values, binding }`. They must
include a unique tie-breaker and validate date precision, missing values, types
and ordering directions. For NULLS FIRST/LAST and ordering by SQL expressions,
an explicit order descriptor supplies the decoder. Do not infer it from an
arbitrary query's private selectedFields.

The library generates only seek SQL, page boundaries and cursor payloads.
Signing, encryption and actor/query binding come from an injected codec/context.
Raypx retains its existing millisecond alignment and authorization-binding
policies. Export offset/page-count and keyset modes separately, with no implicit
default count across all matching rows.

Prepared reads use the current RC's PostgreSQL builder `.prepare()` and
placeholders, adding a typed parameter list, missing/extra parameter validation
and the same result shape. The caller controls postgres.js prepare configuration,
query reuse, transaction connections and deployment requirements for PgBouncer
in transaction pooling mode. A Drizzle prepared object does not guarantee a
named prepared statement on the server. Test prepare enabled and disabled,
parameter binding, repeated execution, single-connection transactions and
rollback rather than inferring driver behavior from an API name.

Authorization and tenant scopes must be revalidated on every execution, and
before/after hooks run on every execution. The fact that an upstream library
runs its before hook during preparation does not justify freezing dynamic access
context at compilation time. Enable prepared writes, relation preloading and
the full hook lifecycle only after real postgres.js/PostgreSQL tests pass.

## Plugins and transaction lifecycle

Every plugin declares its minimum PostgreSQL version, read/write operations,
parameter transformations, result transformations and required context. Plugins
do not advertise switchable drivers or multiple dialects. Configuration belongs
to the current extended client instance; there is no global registry.

| Plugin            | Integration and extension rules                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| timestamps / uuid | Explicit column configuration; distinguish application-generated and database-generated values; gate PG18 uuidv7 separately                                  |
| rules             | Port real evaluators first; declaration-only rules remain pending features, and their types cannot promise runtime execution                                 |
| tenant            | Supply tenant context externally and enforce it consistently across queries/relations/raw/transactions; RLS requires explicit executor support               |
| soft-delete       | Separate default read filters, delete rewrites and includeDeleted; apply them to relation loading without silently changing FK or unique constraints         |
| cache / Redis     | Include scope/tenant/parameters/projection and plugin version in keys; invalidate only after the outermost commit succeeds, and do not broadcast on rollback |
| Zod / ATA         | Separate adapters for one validation contract; build from public column metadata and allow schema-policy overrides                                           |
| ESLint / Oxlint   | Share a semantic rule inventory with separate parser adapters; do not introduce the ESLint runtime into the library's root entry point                       |

The upstream cache already defers invalidation until afterCommit; preserve that
mechanism when porting it. New tests cover concurrent readers, invalidation
across processes, failure retries and read consistency inside transactions.
TTL is not a substitute for authorization isolation. External effects such as
cache updates, logs and network requests must never represent a failed
transaction as committed.

The transaction API wraps PostgresJsDatabase.transaction. Nested calls use
PostgresJsTransaction.transaction savepoints and never fall back to the root db.
Run afterCommit only after the outermost native transaction promise succeeds.
On rollback, discard pending commit effects and run the corresponding
afterRollback hooks. A savepoint rollback removes only that layer's work; a
successful savepoint is not an outer commit. Tests cover commit, a callback
throwing, explicit rollback, nested success/rollback, connection ownership and
hook ordering.

When the caller supplies an existing Drizzle tx or TransactionSql directly, the
library cannot observe the outer commit. The consumer must explicitly connect
commit/rollback notifications. Without that integration, the library must not
claim automatic afterCommit behavior or broadcast cache invalidation early.

The raw interface accepts only parameterized SQL by default. SQL-file and unsafe
text entry points must be explicitly identified and disableable. A Promise.race
timeout stops waiting; it does not cancel the database query. Inside a Drizzle
transaction, use public execute to set transaction-local statement_timeout and
lock_timeout. After a timeout, wait for the actual failure and rollback to finish
so the connection is not left in a failed transaction.

Use the public `.cancel()` only when the executor explicitly holds a
caller-provided postgres.js PendingQuery. Verify cancellation races, SQLSTATE
57014 and subsequent connection usability. Do not extract handles from private
Drizzle sessions or claim that AbortSignal inherently cancels driver queries.
Diagnostic execution tests must cover explicit ANALYZE, read-only transactions,
lock waits, timeouts, rollback after cancellation and connection recovery. The
current pure construction/summary helpers manage no connections and provide no
cancellation guarantee themselves.

## SQL functions and decoder rules

- Inventory every existing text, math, NULL and current-time helper. Move
  general-purpose and PostgreSQL capabilities into pure-function modules by
  category, verifying PostgreSQL parameter order, NULL, empty-string and rounding
  behavior. MySQL/SQLite-specific implementations remain in the inventory and
  semantic comparison, outside the current implementation scope.
- Casts use a closed PostgreSQL type mapping or an explicit trusted PG type
  descriptor. Do not represent bigint/numeric as number by default; the caller
  chooses a decoder for any precision conversion.
- JSON aggregation specifies whether an empty set returns null or [], and
  explicitly distinguishes filtering NULL rows from a left join. Test aggregate
  ordering, DISTINCT, FILTER and date conversion separately; selection supplies
  the decoder.
- Implement VALUES, scalar subqueries, aliases and recursive/materialized CTEs
  as pure ASTs/factories. Do not replace Drizzle's global dialect/buildWithCTE or
  use `_getQuery`.
- A Date exposed directly by a query and a string inside JSON are different
  contracts. Nested JSON decoders convert only fields explicitly marked by the
  selection; they do not scan arbitrary payloads for date-shaped strings.

## Implementation phases and acceptance

| Phase                                | Deliverables                                                                                                                                  | Completion criteria                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: Current foundation                | Implemented foundation helpers, standalone package build, complete inventories, this integration design and independent release configuration | Types/unit tests, postgres.js/PG17 consumer tests, tarball installation outside the repository, Bun/Node imports, license and export checks          |
| B: Complete SQL layer                | 18 common functions, CASE/selection/JSON aggregation, VALUES, CTEs and time-type utilities                                                    | Individual SQL and decoding cases; PG17/18 capability gates; execution of every expression through postgres.js                                       |
| C: Unified query layer               | CRUD, uniqueness, count/exists, offset/keyset, updateEach/upsertMany, prepared queries and locks                                              | postgres.js prepare configuration, real concurrency/locks, transaction rollback, bulk conflicts, NULL ordering and dynamic-scope tests               |
| D: Relations and plugins             | include/filters/sorts/count and relation writes; timestamps/uuid/rules/tenant/soft-delete/validation/cache                                    | Transactions across layers, tenant/soft-delete consistency, plugin ordering, commit/rollback, cache races and correction of types without evaluators |
| E: Compatibility and developer tools | PostgreSQL-scoped plus/better compatibility entry points, development-check plugins and migration guides                                      | Inventory rows distinguish implemented/planned/out-of-scope status; tested postgres.js, PG17/18 and Drizzle peer matrix                              |

No phase removes an inventory capability merely because Raypx does not need it.
Order general-purpose and PostgreSQL work by dependencies and verification cost.
Preserve every MySQL/SQLite entry point, type, implementation difference and
declared capability with the status "retained in the inventory, outside the
current implementation scope" rather than scheduling a later porting phase.
node-postgres (`pg`), Bun SQL and PGlite are also outside the compatibility plan.

Each phase updates the inventories' implementation status and API documentation.
A capability without source evidence or real database tests cannot be declared
complete based on a type declaration, an empty implementation or a test filter
that did not execute any tests.

## Releases and consumer migration

Changesets uses `fixed: []` and `linked: []`. Packages has no overall product
version. Each package's changes determine its version, CHANGELOG and tags;
internal dependencies follow their actual compatibility ranges. Version PRs and
npm publication are separate. Maintainers configure the initial credentials or
Trusted Publisher. Creating the code repository does not make its packages
installable from npm.

Before every release, verify the actual tarball: all exports load, declarations
resolve, Drizzle is not bundled again, licenses are complete, and runtime
dependencies contain neither `workspace:` references nor local machine paths.
Release only commits that passed verify. Extending peers without tests is an
explicit compatibility change.

Before the first npm publication, Raypx can consume pinned archive artifacts
that record their source commit and SHA256. After publication, switch the Raypx
product repository's dependency catalog to the published registry version. Packages remains the sole maintenance
source for the code. Cross-repository source paths or permanent helper copies
must not create a second implementation.

## Admission criteria for further extensions

Every new capability needs actual source or specification evidence, a stable
API, a declared minimum PostgreSQL version and postgres.js/Drizzle peers,
transaction and decoding semantics, at least one independent consumer test and
complete provenance. The root library must remain importable when an optional
plugin's dependencies are absent. Reuse Drizzle's native implementation wherever
it already provides the required behavior; add capabilities for its gaps.

Packages may gradually add other general-purpose packages such as env/logger.
They release independently of Drizzle. Shared maintenance does not justify
sharing business schemas or building an all-purpose shared package whose
components depend on one another.
