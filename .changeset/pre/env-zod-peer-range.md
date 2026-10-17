---
"@voidmix/env": patch
---

Accept any Zod 4 release as the peer dependency instead of requiring exactly 4.6.7, so applications keep a single shared Zod runtime without matching the development pin.
