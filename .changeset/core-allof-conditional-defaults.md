---
"@schema-ts/core": patch
---

Evaluate `allOf`/`if`/`anyOf`/`oneOf` against a value that carries the defaults
the runtime materializes (projected as each applicator merges). A discriminator
declared with a default but absent from the value (for example
`runMode: { default: "quick" }`) previously made `not anyOf` conditions that
`require` it vacuously true, rendering expert-only branches on first render.
