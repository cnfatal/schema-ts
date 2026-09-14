---
"@schema-ts/core": patch
---

Add a materialization policy seam. `DraftNormalizer` stays JSON-Schema faithful
(`strict`), while `BetterNormalizer` materializes optional containers that hold
nested defaults (`display`), so conditional branches are selected against the
value the form displays. This fixes nested gating such as
`charts/default/llamafactory`, where `finetuningType` defaults inside the
optional `basic` object and previously rendered `quantization` + `lora` +
`freeze` at once.
