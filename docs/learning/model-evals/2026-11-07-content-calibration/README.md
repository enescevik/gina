# Content review calibration

User authorized experiments across generation and review models, evidence-based chain changes, deployment, and publication of qualifying questions. The0.85 threshold and all rubric/blocking checks are unchanged.

Eight pre-registered blind cases (four content-correct, four deliberately corrupted) compare the existing review prompt with a clarified prompt that distinguishes pending administrative approval from actual content defects. No target confidence is given to the model. Gold labels are not sent to providers. Source-cell evidence is retained, and no subject-expert approval is claimed.

| Model and spec | Correct cases accepted | Corrupted cases held | Incorrect acceptance |
|---|---:|---:|---:|
| Sonnet5.5 v2 |1/4|4/4|0/4|
| Sonnet5.5 v3 |0/4|4/4|0/4|
| Sol6.1 v3 |4/4|4/4|0/4|
| Astra6 v3 |4/4|4/4|0/4|
| Fable5.1 v3 |0/4|4/4|0/4|

The first batch comparison used a compact batch-verdict schema. Six new grade-five holdout cases (three correct, three corrupted) were then evaluated with the exact native verdict schema, including finding codes and item fields. Sol and Astra each accepted3/3 correct and held3/3 corrupted. Neither changed its prompt after seeing holdout outputs. This is a small, programmatically verified test set, not a teacher-validated general benchmark. A false hold is an operational threshold outcome, not necessarily a mistaken factual finding. Provider reasoning was medium for OpenAI; provider-default reasoning for Claude.

Provisional routing: Sol for economical authoring, Opus as a provider-diverse fallback, Astra for difficult repairs; Astra as the independent content reviewer for Sol-authored content, then Sonnet and Sol as technical fallbacks. A same-model fallback cannot by itself authorize publication. Generation and review chain mutations are separately audited after checks pass; this source change does not silently mutate chain assignments.

Code changes: version the clarification as prereview-v3; preserve OpenAI uncached/cache/output counters without double charging reasoning tokens; forward explicit calibrated review effort; version family generation prompts with outcome-to-task, rubric-consistency, complete-data and noncircular-evidence controls. Keep the provider schema and existing structured-question/assessment restrictions unchanged.

Negative labels are supported by exact arithmetic, explicit text facts, swapped controlled variables, or a direct rubric contradiction. All raw model responses, actual costs, timeouts and production content outcomes are stored in the operational night-run audit and the final user report.
