# @raypx/drizzle

## 0.0.0

Initial independent release.

- Extract typed PostgreSQL column projections, explicit UPSERT mappings and
  postgres.js uniqueness classification into a standalone library.
- Target PostgreSQL through postgres.js only, using the `/postgres` entry point.
  Keep connection ownership with the consumer and declare `postgres` as an
  optional peer for SQL-only consumers.
- Add parameterized JSONB expressions with CASE-guarded scalar conversion.
- Add PostgreSQL EXPLAIN construction and sanitized plan summaries.
- Document the complete drizzle-plus and better-drizzle inventories and phased
  PostgreSQL merge design. The inventories include capabilities outside the
  implementation scope and planned APIs; they do not claim all capabilities are
  implemented.
- Preserve adapted-source provenance, original commits, full licenses and
  notices at the package root, without a `third-party` directory.
