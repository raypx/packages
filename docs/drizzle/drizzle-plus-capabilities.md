# drizzle-plus Complete Capability Inventory and Merge Recommendations

Reviewed on 2026-10-13. The pinned upstream version is `drizzle-plus@1.0.0-rc.8`, at commit
[`5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9`](https://github.com/alloc/drizzle-plus/tree/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9).
The license is MIT; the author is Alec Larson. This inventory checks package exports,
the root entry point, all three dialect entry points, the generated manifest,
extension templates, low-level utilities and types. README examples do not define
the full capability boundary.

This document is a complete capability and migration inventory, **not a list of implemented APIs**.
“Planned” means the API is not yet exported by `@raypx/drizzle`. The only implemented
helpers with direct drizzle-plus counterparts are `withoutColumns`, `excludedColumn`
and `excludedColumns`. The current result-unwrapping, JSONB path/scalar and diagnostic
helpers have other sources; they do not imply that upstream extensions with the
same names have been ported.

Implementation scope is PostgreSQL with postgres.js (the npm package `postgres`),
using `drizzle-orm/postgres-js`. `pg`/node-postgres is unsupported; Bun SQL, PGlite
and other drivers are not planned. The complete inventory of all three upstream
dialects is retained, but MySQL/SQLite entry points, functions, types and internal
implementations are **retained for reference, outside the current implementation scope**.
Their inclusion is not a commitment to port them. “Planned” below applies only to
shared and PostgreSQL capabilities. Features with the same name across dialects
will implement PostgreSQL semantics only. Drizzle's `pg-core` remains the
PostgreSQL modeling interface; its name does not imply support for npm `pg`.

## Entry Points, Generation and Compatibility

Published entry points are defined in the pinned
[package.json](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/package.json).

| Upstream entry point               | Actual contents                                                                                                                                                                          | Toolkit decision                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle-plus`                     | 2 query-configuration mergers, 4 categories of syntax utilities, 18 scalar functions and `SQLTimestamp`                                                                                  | Separate pure expressions, combinators and types; do not copy entry-point side effects                                                  |
| `drizzle-plus/pg`                  | PG functions and cast types; does not automatically enable every extension                                                                                                               | Keep PostgreSQL/postgres.js-specific capabilities in `@raypx/drizzle/postgres`                                                          |
| `drizzle-plus/mysql`               | MySQL functions and cast types                                                                                                                                                           | Retained for reference, outside the current scope; no corresponding entry point is planned                                              |
| `drizzle-plus/sqlite`              | SQLite functions and cast types                                                                                                                                                          | Retained for reference, outside the current scope; no corresponding entry point is planned                                              |
| `drizzle-plus/{pg,mysql,sqlite}/*` | Separate build entry points for generated features; explicit imports enable extensions. `types` is published separately; `internal` has generated source only, with no build entry point | Do not copy wildcard exports. An export pattern does not establish that every generated file can be imported from the published package |
| `drizzle-plus/utils`               | 13 low-level runtime utilities                                                                                                                                                           | Rewrite or internalize the required parts individually; do not expose private query operations wholesale                                |
| `drizzle-plus/types`               | 27 main type exports                                                                                                                                                                     | Planned reconstruction using maintainable public Drizzle types                                                                          |
| `drizzle-plus/types/*`             | The current source contains 5 JSON types in `types/json.ts`                                                                                                                              | Can be ported separately, with `undefined` and actual JSON serialization semantics reconciled                                           |

The generation manifest contains **19 items**: 17 behavioral features plus the
`internal` and `types` support modules. It generates 19 PG, 16 MySQL and 17 SQLite
feature files, for a total of 52, plus a root generated index and 3 dialect indexes.
Generated source contains `@ts-nocheck`; a file's existence is not evidence of
cross-RC type compatibility. The inventory is checked against the
[manifest](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/codegen/manifest.ts)
and
[registry](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/codegen/registry.ts).

The
[rolldown.config.ts](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/rolldown.config.ts)
and
[verify-package.ts](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/scripts/verify-package.ts)
were also checked. The build selects only `index`, `types` and features containing
`declare module`; package verification explicitly skips `internal`. Therefore,
the 52 generated feature files yield 49 independently published feature entry
points. `internal` must not be described as an importable published API.

Upstream runtime source uses radashi's `isPlainObject/isDate/isFunction/select`;
its types use `Simplify`. Radashi is listed in devDependencies, and the build
externalizes only Drizzle and drizzle-plus, so these helpers are bundled into
the output. Toolkit's small expression implementations do not need to inherit
that dependency. Generation/build tools such as pnpm, Rolldown, dts and tinyglobby
are development tools; forking source does not make them runtime dependencies.

The upstream peer range is `drizzle-orm >=1.0.0-0`. Toolkit currently supports
only the version it actually tests, `1.0.0-rc.5-5935859`. A broad peer range is
not a substitute for a compatibility matrix. Prototype extensions modify
Database, Table, RelationalQueryBuilder, RelationalQuery, SelectBuilder,
SelectBase and QueryPromise; CTE features also replace the dialect's
`buildWithCTE`. Toolkit excludes these global changes and uses ordinary
functions, explicit query factories and consumer-supplied
PostgresJsDatabase/PostgresJsTransaction handles. Consumers own the lifecycle
of Sql/TransactionSql.

In the tables below, `P` means public SQL construction APIs, `I` means internal
query/session/selection structures, and `G` means global prototype or method
changes. Dialect columns describe the upstream manifest and entry points;
**they do not indicate that Toolkit implements or has verified those dialects**.
MySQL/SQLite behavior is retained solely to preserve the complete upstream record.

## Complete Query Feature Inventory

Source links refer to the pinned
[extensions directory](https://github.com/alloc/drizzle-plus/tree/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/extensions).

| Manifest feature / actual API                                                                 | Upstream dialects   | Behavior and implementation dependencies                                                                                                                                                     | Merge and extension decision                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$cursor`; `InferCursor`, `RelationalQueryCursor`                                             | PG / MySQL / SQLite | Builds lexicographic OR/AND conditions from multiple `orderBy` columns; missing cursor values are treated as null; G                                                                         | Plan a pure keyset predicate, sharing direction/NULL/composite-key rules with better-drizzle `cursor`. Require a unique final tie-breaker and explicit NULL ordering. Applications still own cursor signing and actor/scope binding                                                        |
| `$findMany`; single- and two-configuration overloads                                          | All three dialects  | The single-argument overload preserves literal types; the two-argument overload calls `mergeFindManyArgs`; G                                                                                 | Plan pure `defineQuery`/`composeQuery` type helpers, removing RQB prototype changes. Keep configuration composition separate from query execution                                                                                                                                          |
| `$select(fields)`                                                                             | All three dialects  | Calls `toSelection(fields,{addAliases:true})`; G/P, with some object identification relying on I                                                                                             | Plan an explicit typed selection helper; share underlying selection rules with better-drizzle projection/include                                                                                                                                                                           |
| `$values`, `$withValues`; `ValuesList`, `ValuesListSubquery`                                  | All three dialects  | Builds VALUES SQL from data, with optional first-row casts/table-column decoders, aliases, CTEs and `inlineParams()`; G/I                                                                    | Plan `valuesList`, checking consistent row-key sets, empty rows and parameter limits. Allowlist type names. Keep values bound by default; inline parameters only in explicit trusted contexts                                                                                              |
| `$withMaterialized`, `$withNotMaterialized`                                                   | PG                  | Marks CTE materialization and replaces Dialect `buildWithCTE`; G/I                                                                                                                           | Plan explicit CTE SQL combinators. Prefer native Drizzle support and do not modify dialect prototypes. Preserve MATERIALIZED / NOT MATERIALIZED semantics                                                                                                                                  |
| `$withRecursive`                                                                              | All three dialects  | Supplies a self-selection proxy to a callback, injects recursive flags and decoders, and replaces CTE construction; G/I                                                                      | Plan typed recursive CTEs. Tests and callers must express self-referencing column lists, SQL/type consistency and termination conditions                                                                                                                                                   |
| `$without(...fields)`                                                                         | All three dialects  | Removes fields from a copy of `getColumns(table)`; G/P                                                                                                                                       | **Implemented as `withoutColumns`**, an ordinary function with no prototype changes                                                                                                                                                                                                        |
| `RelationalQuery.as(alias)`, `SelectBuilder.as(alias)`; `RelationalSubquery`                  | All three dialects  | Turns an RQB or a selection without FROM into a referenceable subquery while preserving decoders; uses private `_getQuery`, selection and dialect internals; G/I                             | Plan an explicit `subquery` helper. Prefer native select `.as`; do not reproduce the RQB's private selection pipeline                                                                                                                                                                      |
| `count(filter)`; `CountQueryPromise`                                                          | All three dialects  | Converts aliases and relational filters to SQL; accesses session.objects/dialect; G/I                                                                                                        | Plan an explicit `countQuery` adapter using native `count`/`$count`. Share expressions with better-drizzle `count`/`exists`; retain string/bigint options for large integer results                                                                                                        |
| `create(config)`; `DBCreateConfig`, `CreateQueryResult`, `CreateQueryPromise`                 | **PG only**         | Single/batch inserts, skipDuplicates and boolean/SQL returning projections; uses internal context and InsertBuilder; G/I                                                                     | Plan PostgreSQL insert-construction helpers shared with better-drizzle `create/createMany`. Preserve consumer transactions and distinguish affected-row counts from returning types. Generic types cannot establish that the actual driver returns a number                                |
| `findManyAndCount(config)`; `FindManyAndCountResult`                                          | All three dialects  | Runs findMany and a where-only count concurrently through `Promise.all`; also exposes two `toSQL()` statements; G/I                                                                          | Plan a `pageAndCount` query-factory composition shared with better-drizzle `paginate`. Consumers explicitly choose a transaction with one snapshot or accept inconsistent reads. Do not promise atomic pagination by default                                                               |
| `findUnique(config)`; `FindUniqueConfig`                                                      | All three dialects  | Finds PK/unique constraints from top-level where keys, then runs `findFirst`; composite constraints are checked only at runtime; G/I                                                         | Plan explicit unique-key lookup shared with better-drizzle `findUnique`. Check equality values, partial/expression-index conditions and constraint completeness. Checking keys alone does not prove that a predicate is unique                                                             |
| `fromSingle()`                                                                                | All three dialects  | Uses `(select 1) as placeholder` as a base row, ensuring one row before left joins; G/P, with field validation using I                                                                       | Plan a pure SQL `singleRowSource`. Document that a left join can still expand it to multiple rows                                                                                                                                                                                          |
| `orThrow(message)`                                                                            | All three dialects  | Changes instance execution and overrides QueryPromise, RQB and SelectBase prototypes; throws DrizzleError for an empty array or null/undefined; G                                            | Share the design with better-drizzle `.orThrow()`. Current `first/inserted` helpers cover only part of result unwrapping and **do not constitute a port of this prototype API**. Plan `requireResult/requireRows`, preserving array/single-row distinctions and configurable errors        |
| `updateMany(config)`; `DBUpdateManyConfig`, `UpdateManyQueryResult`, `UpdateManyQueryPromise` | All three dialects  | Supports set callbacks, relational where, ordering and limits. PG uses CTE + ctid + FOR UPDATE; MySQL/SQLite use native limits; PG/SQLite support returning; G/I                             | Plan update factories with explicit target sets, sharing a safe mutation core with better-drizzle `updateMany/updateEach`. Unfiltered writes require explicit permission; locking and batch order must be explicit. Prefer stable PG primary keys over retaining ctid references long term |
| `upsert(config)`; `UpsertSelectQuery`, `DBUpsertConfig`, `UpsertQueryPromise`                 | **PG / SQLite**     | Accepts single/multiple rows or SELECT input; inferred/explicit conflict targets; current/excluded callbacks, updateWhere, returning and CTEs; changes SELECT config/`_.selectedFields`; G/I | **Only excluded expressions are implemented.** Plan a rewritten full upsert shared with better-drizzle `upsert/upsertMany`. Require explicit targets and update allowlists; do not infer write permissions or implicitly update a primary key merely to force a returned row               |
| `withoutFrom()`; `SelectWithoutFrom`                                                          | All three dialects  | Hand-built SELECT-without-FROM query subclass; copies SelectBase descriptors and uses session preparation/mapping; G/I                                                                       | Plan pure `selectExpressions` SQL with consumer-supplied execution/decoders. Use native support where available; do not copy QueryPromise/SelectBase internal executors                                                                                                                    |
| `internal`                                                                                    | All three dialects  | Private context, target/returning, CTE patches, decoders and subquery helpers; complete inventory below                                                                                      | No public compatibility promise. Only stable pure helpers may be rewritten and reused                                                                                                                                                                                                      |
| `types`; `RelationalQueryBuilder`, `InferColumns`, `RawFieldsToSubquery`                      | All three dialects  | Generates dialect-specific RQB aliases, field inference and Subquery types                                                                                                                   | Plan reconstructed type-only helpers without publishing internal RQB shapes as public interfaces                                                                                                                                                                                           |

## Root Syntax and Configuration Mergers

| API / type                                       | Upstream behavior and dependencies                                                                                                                                                               | Toolkit merge decision and status                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mergeFindManyArgs`, `MergeFindManyArgs`         | Shallow-merges columns/extras/with; right-hand limit/offset/order overrides; where delegates to the next helper; types use radashi Simplify                                                      | Plan separate configuration-override and predicate-composition semantics. Do not add undefined properties to returned objects; respect exactOptionalPropertyTypes                                                    |
| `mergeRelationsFilter`, `MergeRelationsFilter`   | Combines two OR/RAW branches under AND and recursively merges two NOT branches; ordinary duplicate fields and existing AND branches may be overwritten by the right-hand side                    | Plan redesigned `andFilters` and explicit override modes. **Do not use the upstream merger directly for mandatory tenant/permission filters**; repeated conditions must retain logical intersection                  |
| `caseWhen`, `SQLCaseWhen` (`when/else/elseNull`) | Composes public `sql`, ignores undefined conditions and accumulates THEN/ELSE union types                                                                                                        | Plan a pure SQL CASE builder. A missing ELSE adds null to the type; define the behavior of an empty CASE explicitly                                                                                                  |
| `nest(query)`                                    | Scalar subqueries must contain exactly one column; reads `_getQuery`/`_.selectedFields` and decoders to obtain the result                                                                        | Plan `scalarSubquery(query,decoder)` with an explicit decoder or native selection. Zero rows must yield a nullable result; reject multiple columns and avoid private introspection                                   |
| `toSQL(value)`, `ToSQL`                          | Passes SQLWrapper through; binds every other value as a parameter                                                                                                                                | Plan a pure binding helper. Correct string/Date/object types; type declarations are not evidence of actual driver decoding                                                                                           |
| `toSelection(fields,options)`                    | Ignores undefined; uses SQL literals for numbers/booleans/null, parameters for string/Date/JSON, and preserves SQL/column/subquery values; uses TypedQueryBuilder/FakePrimitiveParam and radashi | Plan explicit parameterized selection. Reject or bind non-finite numbers; preserve JSON keys; reject ambiguous serialization of functions/cyclic objects. Do not depend on FakePrimitiveParam or private query state |
| `SQLTimestamp<T>.toDate()`                       | Builds a new SQL object from SQL queryChunks and decodes strings as JS Date                                                                                                                      | Plan timestamp decoders with explicit date/timezone/invalid-value policies. Do not obscure driver differences with permissive `new Date()` conversion                                                                |

## Complete Root Scalar Function Inventory (18)

These functions produce only SQL and types; the root entry point does not detect
the database dialect. Unless stated otherwise, they use public `sql`/`mapWith`
and require no prototype patches. All are **planned**. Porting requires tests of
PostgreSQL syntax, NULL behavior and postgres.js decoding. MySQL/SQLite differences
remain documented, but are neither implementation tasks nor compatibility claims.
The pinned source is under
[functions](https://github.com/alloc/drizzle-plus/tree/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/functions).

| API                   | Purpose                                                              | Porting and extension requirements                                                                       |
| --------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `abs`                 | Absolute value                                                       | Nullable results; integer/decimal decoders                                                               |
| `ceil`                | Round upward                                                         | PostgreSQL numeric/float overloads and result ranges; SQLite math compilation options are reference only |
| `floor`               | Round downward                                                       | PostgreSQL numeric/float overloads and result ranges; SQLite math compilation options are reference only |
| `sqrt`                | Square root                                                          | Verify PostgreSQL negative-value/NULL behavior and result decoding                                       |
| `mod`                 | Modulo                                                               | PostgreSQL division-by-zero/negative-value behavior; SQLite `%`/math support is reference only           |
| `power`               | Exponentiation                                                       | PostgreSQL overflow and precision; SQLite math support is reference only                                 |
| `round`               | Rounding, with optional decimal places                               | PG numeric/float overload differences, rounding rules and precision                                      |
| `length`              | String length                                                        | PostgreSQL Unicode character length; MySQL byte/character differences are reference only                 |
| `lower`               | Lowercase conversion with a declared Lowercase type                  | Database collation/locale behavior need not match TS Lowercase; avoid overly precise return types        |
| `upper`               | Uppercase conversion with a declared Uppercase type                  | Same concern as lower; test Unicode                                                                      |
| `trim`                | Trim leading/trailing spaces                                         | Define the character set and database behavior explicitly                                                |
| `substring`           | 1-based start and optional length; emits FROM/FOR syntax             | Verify PostgreSQL FROM/FOR; SQLite function-argument syntax differences are reference only               |
| `concatWithSeparator` | `concat_ws`; skips NULL values and returns NULL for a NULL separator | Explicit engine-version requirements and bound parameters                                                |
| `coalesce`            | First non-NULL value                                                 | Rebuild null-union inference and verify the decoder; do not mix incompatible SQL types                   |
| `nullif`              | NULL when values are equal                                           | Upstream return generics do not always add null; Toolkit must preserve nullable types                    |
| `currentDate`         | current_date; SQLTimestamp supports `.toDate()`                      | Session timezone and date-only decoding policy                                                           |
| `currentTime`         | current_time as a string                                             | Keep timezone/precision behavior consistent with declarations                                            |
| `currentTimestamp`    | current_timestamp; SQLTimestamp supports `.toDate()`                 | Transaction timestamp semantics, timezones and driver types                                              |

## Complete Dialect Function and Cast Type Inventory

Dialect SQL will not be implemented twice in the better-drizzle facade and
expression layer. Future facades or pure query helpers call the same PostgreSQL
implementation. Except for the explicitly implemented excluded/JSONB path
helpers, shared and PostgreSQL APIs are **planned**. MySQL/SQLite APIs are
**retained for reference, outside the current implementation scope**. The full
function inventory, cast keys and semantic differences remain documented.

| Dialect                    | API                                           | Behavior and migration requirements                                                                                                                                           | Implementation status                                                    |
| -------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| PG                         | `cast`                                        | Uses raw type names with bound values. Plan built-in type allowlists and explicit trusted SQL types; TS literal restrictions cannot prevent runtime injection                 | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `concat`                                      | Treats NULL as empty, unlike MySQL; requires decoder/engine tests                                                                                                             | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `position`                                    | Case-sensitive SQL position; returns 0 when absent; nullable                                                                                                                  | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `jsonAgg`, `jsonAggNotNull`, `JsonAggOptions` | `jsonb_agg` with orderBy/filter; empty sets yield null or []; require explicit item decoders and fix the upstream array decoder's risk of calling map on null                 | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `jsonBuildObject`                             | Builds JSONB objects from field maps or subqueries, with field decoders                                                                                                       | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `rowToJson`, `RowToJson`                      | Converts tables/views/subqueries through row_to_json; depends on `_` selection and decoders. Upstream types intentionally omit null for missing rows; Toolkit must restore it | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `uuidv7(shift?)`                              | Calls the database UUIDv7 function; requires PostgreSQL 18 explicitly and must not claim PG17 support                                                                         | Planned (PostgreSQL/postgres.js)                                         |
| PG                         | `uuidExtractTimestamp`                        | Extracts timestamps from UUIDv1/v7; also requires PostgreSQL 18 and may return a nullable timestamp                                                                           | Planned (PostgreSQL/postgres.js)                                         |
| MySQL                      | `cast`                                        | Separate SQLType and cast syntax; do not reuse raw PG type names                                                                                                              | Retained for reference, outside the current scope                        |
| MySQL                      | `concat`                                      | Any NULL produces NULL; keep its model separate from PG/SQLite                                                                                                                | Retained for reference, outside the current scope                        |
| MySQL                      | `position`                                    | position/in; comparison depends on collation                                                                                                                                  | Retained for reference, outside the current scope                        |
| MySQL                      | `jsonArrayAgg`                                | JSON array aggregation plus decoder; empty sets yield null, and ordering support must be restated per engine version                                                          | Retained for reference, outside the current scope                        |
| MySQL                      | `jsonObject`                                  | JSON object construction; do not rename field keys through simple character filtering                                                                                         | Retained for reference, outside the current scope                        |
| SQLite                     | `cast`                                        | integer/real/text/blob types and affinity; do not promise unverified strict casts                                                                                             | Retained for reference, outside the current scope                        |
| SQLite                     | `concat`                                      | Upstream reuses the PG function; test engine versions rather than inferring equal semantics from shared source                                                                | Retained for reference, outside the current scope                        |
| SQLite                     | `instr`                                       | string/substr argument order differs from position; nullable, with 0 when absent                                                                                              | Retained for reference, outside the current scope                        |
| SQLite                     | `jsonGroupArray`                              | JSON group aggregation; test textual/native JSON and item decoding                                                                                                            | Retained for reference, outside the current scope                        |
| SQLite                     | `jsonObject`                                  | Upstream reuses the MySQL constructor; recheck JSON subtypes, nested objects and textual driver results                                                                       | Retained for reference, outside the current scope                        |
| Each of the three dialects | `SQLType`, `SQLTypeToJS`, `InferCastResult`   | 3 cast types per entry point; complete type-key sets appear below. A number type must not imply lossless bigint/decimal handling                                              | PG types only are planned; MySQL/SQLite remain outside the current scope |

PG UUID version requirements and behavior are documented in
[PostgreSQL 18 UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html).
Dialect-specific SQLite function forms are documented in
[SQLite core functions](https://www.sqlite.org/lang_corefunc.html).

Complete cast-type mapping keys:

- PG: `int2`, `int4`, `int8`, `smallint`, `integer`, `bigint`, `decimal`,
  `numeric`, `real`, `float4`, `float8`, `double`, `serial`, `bigserial`, `money`,
  `bool`, `char`, `varchar`, `text`, `citext`, `name`, `date`, `time`, `timetz`,
  `timestamp`, `timestamptz`, `interval`, `uuid`, `json`, `jsonb`, `inet`, `cidr`,
  `macaddr`, `bit`, `varbit`.
- MySQL: `tinyint`, `smallint`, `mediumint`, `int`, `bigint`, `float`, `double`,
  `decimal`, `real`, `boolean`, `char`, `varchar`, `text`, `date`, `time`,
  `datetime`, `json`.
- SQLite: `integer`, `real`, `text`, `blob`.

## All 13 Exports from `./utils`

Pinned source:
[utils.ts](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/utils.ts).
None of these tools has been ported as a Toolkit public API.

| API                           | Behavior / dependencies                                                                                      | Decision                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `getOriginalTableName`        | Reads `Symbol.for('drizzle:OriginalName')`                                                                   | Do not expose internal symbols; use public table metadata if needed                                                  |
| `getSelectedFields`           | Probes RQB config/table/with/extras, `_.selectedFields` and `_getQuery().selection` through multiple paths   | Rewrite around explicit selection inputs; do not retain introspection                                                |
| `getDecoder`                  | Uses column decoders or private SQL `.decoder`, preferring mapFromJsonValue                                  | Rewrite around explicit DriverValueDecoder inputs; separate JSON/native/SQL driver decoding                          |
| `getSQL`                      | Calls query.getSQL()                                                                                         | Reuse the public SQLWrapper protocol without a redundant public facade                                               |
| `getDialect`                  | Reads query.dialect                                                                                          | Do not port private access; consumers provide the compiler/executor                                                  |
| `buildRelationalQuery`        | Calls private `_getQuery()`                                                                                  | Do not port; RQB-to-SQL conversion must use verified public entry points                                             |
| `createJsonArrayDecoder`      | Parses string JSON with JSON.parse, then applies item decoders                                               | Planned internal reuse with null/array-shape checks; do not call map on null                                         |
| `buildJsonProperties`         | Converts selection fields to JSON key/value pairs and collects decoders; filters keys by deleting characters | Plan explicit field maps and bound keys. Preserve Unicode/punctuation; character deletion can create key collisions  |
| `createJsonObjectDecoder`     | Parses string JSON, then decodes each property in place                                                      | Plan a decoder registry with object/null/missing-field checks; avoid unexpectedly mutating input objects             |
| `getDefinedColumns`           | Selects columns having a non-undefined value in any row                                                      | Plan internal write projection sharing explicit write allowlists; do not infer which business columns may be updated |
| `pushStringChunk`             | Merges text into StringChunk.value                                                                           | Prefer public sql.join composition over mutable internal chunk layouts                                               |
| `orderSelectedFields`         | Flattens nested table/object selections into ordered path+field entries                                      | Plan a rewritten decoder/selection registry instead of copying obsolete Drizzle internal utilities                   |
| `mapSelectedFieldsToDecoders` | Maps decoders by alias/final key                                                                             | Share a single JSON codec layer; repeated final keys in nested objects must not overwrite each other                 |

## Main Types, JSON Types and Feature-Specific Types

Pinned main-type source:
[types.ts](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/types.ts).
The following is the complete set of **27** exported types/interfaces. Shared
and PostgreSQL forms are planned for reconstruction. Multi-dialect generics and
MySQL/SQLite-specific forms remain inventory only; Toolkit does not currently
provide compatible exports with those names.

| Group              | Complete type set                                                                                                                             | Merge direction                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| SQL values/results | `SQLValue`, `SQLExpression`, `SQLResult`, `InferSQLNull`                                                                                      | Unify with better-drizzle query-leaf/expression types; distinguish runtime decoding from type declarations                          |
| Query/scalar       | `AnyQuery`, `AnySelectQuery`, `QueryToResult`, `QueryToSQL`, `AnyDialect`                                                                     | Retain public SQLWrapper/executor protocols; discard AnySelectQuery's required `_.selectedFields` shape                             |
| Relational query   | `AnyRelationsFilter`, `AnyDBQueryConfig`, `InferRelationsFilter`, `InferRelations`, `InferOrderBy`, `InferFindManyArgs`, `InferFindFirstArgs` | Share typed filter compilers/configuration combinators; match the current Drizzle RC precisely and handle exact optional properties |
| Write/returning    | `ReturningClause`, `ReturningResultFields`, `ExtractTable`, `OrderByClause`, `InsertSelectedFields`                                           | Share better-drizzle write/returning handling; declare constraints and field allowlists explicitly                                  |
| Selection/JSON     | `RawFieldsToSelection`, `ToJsonObject`, `ResultFieldsToSelection`, `SQLFields`, `DecodedFields`, `RowToJson`                                  | Share PG JSONB/JSON aggregation codecs; correct empty-result nullability and key structure                                          |

The **5** types in `types/json.ts` are `JSONPrimitive`, `JSONObjectCodable`,
`JSONCodable`, `JSONObject` and `JSON`. Source types allow undefined object values,
readonly arrays and `toJSON()`. A port must distinguish encodable values from
encoded JSON; undefined and non-finite numbers are not database JSON primitives.

All additional types/classes exported by feature files are included in their
corresponding feature rows:
`InferCursor`, `RelationalQueryCursor`, `ValuesListSubquery`, `ValuesList`,
`RelationalSubquery`, `CountQueryPromise`, `DBCreateConfig`, `CreateQueryResult`,
`CreateQueryPromise`, `FindManyAndCountResult`, `FindUniqueConfig`,
`RelationalQueryBuilder`, `InferColumns`, `RawFieldsToSubquery`,
`DBUpdateManyConfig`, `UpdateManyQueryResult`, `UpdateManyQueryPromise`,
`UpsertSelectQuery`, `DBUpsertConfig`, `UpsertQueryPromise`, `SelectWithoutFrom`.
The root file also exports `MergeFindManyArgs`, `MergeRelationsFilter`, `ToSQL`,
`SQLCaseWhen` and `SQLTimestamp`. Dialect files add `JsonAggOptions` and the
3 cast types for each dialect.

## Complete `internal` Exports and Adapter Support

`internal` supports generated source. The published build and verify-package
exclude it as a standalone entry point; wildcard exports alone do not establish
that it can be imported. All **11 runtime exports + 2 type exports** are retained
in the source capability inventory below. Toolkit does not promise compatibility
with their internal operations. Pinned source:
[internal.ts](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/extensions/internal.ts).

| Export                           | Purpose                                                                                          | Toolkit decision                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `getContext`                     | Casts RQB to table/schema/tableConfig/dialect/session context                                    | Do not port. Use explicit PostgreSQL table/relation context and PostgresJsDatabase/Tx                                              |
| `getFilterSQL`                   | Uses relationsFilterToSQL with private relation context                                          | Plan public filter compilers taking explicit metadata, without probing database internals                                          |
| `getReturningFields`             | Returning projections from boolean/include/exclude/SQL callbacks                                 | Plan pure returning projections sharing better-drizzle select/omit rules                                                           |
| `getTargetColumns`               | Infers single-column PK/unique and composite PK/unique/index targets                             | Retain only explicit constraint validation. Do not guess targets from inserted fields; model partial/expression indexes separately |
| `injectWithSubqueryAddons`       | Replaces the withBuilder.as wrapper method                                                       | Do not port instance patches; create independent CTE builders                                                                      |
| `setWithSubqueryAddons`          | Stores CTE flags in a WeakMap and modifies Dialect prototypes                                    | Do not port global patches; use explicit CTE metadata/SQL                                                                          |
| `InferDialect`, `ExcludeDialect` | Infers and excludes dialects from table `_` metadata                                             | Retain the upstream type inventory; rebuild PostgreSQL types only, without dialect generics                                        |
| `excluded`                       | An `excluded.identifier` expression                                                              | **Adapted as `excludedColumn`, with added `excludedColumns(table,...keys)`**                                                       |
| `sqlNull`                        | SQL null constant                                                                                | Public sql can express this directly; no separate stable API is needed                                                             |
| `buildInsertSelect`              | Workaround for an old Drizzle issue: fill missing columns with null and reject generated columns | Do not copy unchanged. Verify current Drizzle insert-select behavior before deciding whether a workaround is needed                |
| `buildRelationalQuery`           | `_getQuery()`                                                                                    | Do not port private calls; deduplicate the equivalent utils capability                                                             |
| `createWithSubquery`             | Constructs WithSubquery/SelectionProxyHandler and decoders manually                              | Plan public subquery/explicit selection construction without binding to private handlers                                           |

The three supporting adapter files define `RelationalQuery` / `InsertQuery`
types and `createInsertBuilder`, `selectRowsToUpdateOrDelete`, `innerJoinMatchedRows`,
`limitUpdateOrDelete`, `setReturningClauseForUpdateOrDelete` and `executeSelect`.
Some dialect functions are declaration-only placeholders, not usable runtime
implementations. These files live in `src/internal/dialects/{pg,mysql,sqlite}.ts`
and are not stable public package entry points. PG limited updates use ctid and
locking CTEs; MySQL/SQLite use native limits. All three executeSelect implementations
depend on different private session.prepareQuery argument orders. Toolkit uses
consumer-supplied PostgresJsDatabase/PostgresJsTransaction handles and implements
PostgreSQL only. It will not port MySQL/SQLite adapters or replace native DB/Tx handles.

The codegen registry, placeholders, emit, validate and generation scripts are
development tools, not database runtime APIs. Use a single capability definition
with a PostgreSQL/postgres.js version-validation matrix; do not import generated
@ts-nocheck APIs or the upstream pnpm toolchain.

## Unified Extension Roadmap with better-drizzle

| Shared capability                       | Single implementation layer              | Merge rules                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table fields, select/omit and returning | Pure column/selection layer              | `$without` and facade projections share field functions; do not maintain two include/exclude semantics                                                              |
| JSON scalar/filter/mutation/aggregate   | PostgreSQL SQL with explicit codecs      | Share bound paths/decoders between better-drizzle JSON leaves and drizzle-plus JSON construction/aggregation; validate paths, object keys and type names separately |
| findUnique/count/exists                 | Native query factories with predicates   | Derive uniqueness from explicit constraints; share count decoders and cardinality rules                                                                             |
| cursor/paginate/pageAndCount            | Separate pagination layer                | Share lexicographic SQL and NULL/order/tie-breaker rules; separate result encoding from business signing                                                            |
| create/updateMany/upsert                | Explicit mutation layer                  | Accept native DB/Tx handles and explicit target/set/returning rules; place nested writes in optional relation orchestration                                         |
| orThrow/result selection                | Result layer                             | Extend current `first/inserted` with generic required-result helpers, without overriding query.execute                                                              |
| CTE/VALUES/subquery                     | PostgreSQL expression layer              | Reuse native Drizzle behavior where sufficient; fill gaps through pure SQL composition                                                                              |
| facade/hooks/plugins                    | Optional higher-level package            | Facades may call drizzle-plus-derived ordinary functions; the facade stays out of the expression package's default entry point and introduces no global changes     |
| diagnostics/errors                      | Separate diagnostics/errors entry points | Share extractions from better-drizzle; exclude query parameters, predicates and raw driver causes from diagnostic output                                            |

Suggested implementation order: first release the verified column, excluded,
JSONB scalar, result, unique-constraint and diagnostic foundations. Second, add
all pure scalar/CASE/codec helpers and PG JSON aggregation. Third, unify filters,
pagination, explicit mutations and VALUES/CTE support. Fourth, develop separate
relation orchestration and optional plugins. Planned APIs do not enter exports
or expand peer support until real PostgreSQL/postgres.js, type and packed-consumer
tests pass. There is no multi-dialect or multi-driver porting phase.
Prepared statements, transactions/savepoints, hook commit ordering and diagnostic
timeout/cancellation share the postgres.js execution core described in the
[merge plan](merge-plan.md), without copying private session access.

As each capability is completed, update its status, source commit/license,
design decisions, public exports, minimum PostgreSQL version, postgres.js/Drizzle
versions and verification evidence. An inventoried capability or a proposed fork
must not be reported as an implemented feature.
