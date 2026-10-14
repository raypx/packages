# Source provenance

`@voidmix/drizzle` adapts selected public implementations and maintains the
complete upstream inventories. The upstream packages themselves are not runtime
dependencies. Retain these notices, complete licenses and source headers when
distributing the adapted modules.

## drizzle-plus

- Project: [alloc/drizzle-plus](https://github.com/alloc/drizzle-plus).
- Commit: `5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9`.
- Copyright (c) Alec Larson; [complete MIT license](#drizzle-plus-mit-license).
- Sources: [column omission](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/extensions/%24without.ts)
  and [excluded expressions](https://github.com/alloc/drizzle-plus/blob/5840bdb4c5b3c7526b7db132f0b14cbe8a89eae9/src/extensions/internal.ts).
- Adapted modules: [columns](https://github.com/raypx/voidmix/blob/main/packages/drizzle/src/columns.ts), [PostgreSQL UPSERT](https://github.com/raypx/voidmix/blob/main/packages/drizzle/src/postgres/upsert.ts).

Modifications: standalone public-API functions replace prototype methods;
explicit update keys and quoted physical names replace conflict discovery and
private metadata. Initial adaptations were maintained in Raypx at commit
`69da503` before extraction into Toolkit.

## better-drizzle

- Project: [almeidazs/better-drizzle](https://github.com/almeidazs/better-drizzle).
- Commit: `f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d`.
- Copyright 2026 Hiago Almeida; [complete Apache-2.0 license](LICENSE).
- Sources: [error classification](https://github.com/almeidazs/better-drizzle/blob/f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d/src/shared/errors.ts),
  [JSON path filters](https://github.com/almeidazs/better-drizzle/blob/f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d/src/shared/query/compiler.ts),
  [EXPLAIN construction](https://github.com/almeidazs/better-drizzle/blob/f93f1b7aa528fe2db4cddc92a047e7a0ae710a0d/src/shared/client/explain.ts).
- Adapted modules: [errors](https://github.com/raypx/voidmix/blob/main/packages/drizzle/src/errors.ts), [JSON expressions](https://github.com/raypx/voidmix/blob/main/packages/drizzle/src/postgres/json.ts),
  [EXPLAIN](https://github.com/raypx/voidmix/blob/main/packages/drizzle/src/diagnostics/explain.ts).

Modifications: exact PostgreSQL constraint matching and cycle-safe causes;
parameterized path segments replace dotted paths and the complete filter
compiler; CASE guards protect scalar casts; finite numbers are decoded explicitly.
EXPLAIN has a fixed PostgreSQL JSON option allowlist and no connection facade,
raw parameter reporting or Promise.race timeout. The pinned upstream checkout
has no separate NOTICE file.

## Original Toolkit modules and maintenance

Result unwrapping and sanitized plan summarization are original Voidmix
code, distributed under the package Apache-2.0 license. No PEV2 code is included.

The inventories describe future work; source listing is not a claim that all
upstream modules were copied or implemented. Before updating a pinned source,
review the diff, license and required Drizzle APIs, then run the compatibility
and published-artifact tests. See the repository's
[merge design](https://github.com/raypx/voidmix/blob/main/docs/drizzle/merge-plan.md).

## drizzle-plus MIT license

```text
MIT License

Copyright (c) Alec Larson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
