# Bounded first library batch

Historical operational evidence, not an automatically deployable feature. The temporary function was removed after the run; the job table and both RPCs were removed after archiving their full contents in `audit_log` (`library_generation.batch_completed`). No migration drift remains from this bridge. The endpoint never created jobs, consumed family entitlements, or published content.

`scope.json` is the selected existing curriculum candidate scope. `journal.sql` records the temporary claim/result protocol (tested transactionally for exclusive claim, cached result and unauthorized access). `temporary-handler.ts` records the final bounded operator implementation. It uses the existing operation chain, a narrow temporary secret, and fixed job/package identifiers. It is deliberately outside `functions/`; do not deploy it as a permanent interface or blindly reuse its fixed IDs.

The rejected original request used unsupported minItems/maxItems array constraints. The corrected request removed those constraints; count/outcome/rubric validation was performed on the returned data before import. The historical original request remains in the production audit event; the fixed request does not erase it.

Content, import receipt identifiers, quality notes, token accounting limitations and live evidence: `docs/learning/library-batches/2026-11-07-g7-math/`.
