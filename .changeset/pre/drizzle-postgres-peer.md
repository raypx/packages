---
"@voidmix/drizzle": patch
---

Remove the optional `postgres` peer dependency. Published entries never import postgres.js; it remains a development dependency for integration tests.
