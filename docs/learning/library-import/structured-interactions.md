# Structured library questions

The v1 import envelope remains compatible. A structured question uses the existing
`student.kind: open_ended` envelope with empty choices and null teacher.correct_key,
and adds a private `metadata.interaction` object:

```json
{"type":"true_false","schema_version":1,"payload":{"statements":[{"id":"a","text":"A statement"}]},"answer_key":{"answers":{"a":true}}}
```

The type must be an enabled structured interaction in `public.interaction_types`.
The server validates payload and key with the same QT contract used for parent
and AI authoring. The twelve enabled structured types are supported; disabled
crossword is rejected. Region selection using a question image requires a source
with an immutable PNG asset. Teacher explanations and rubrics must agree with the
actual interaction and its native scoring policy; a four-part essay rubric is not
a replacement for the structured scoring key.

Metadata is immutable private import data and participates in the package hash.
The normalized prereview source includes the interaction and private key for the
authorized reviewer. Existing legacy packages produce identical normalized JSON,
so adding support does not invalidate their review fingerprints. Any actual
interaction edit requires a new package revision and a fresh prereview.

Acquisition calls the existing QT insert function, creating a real structured
question and a separate private `question_answer_keys` row. The exam item weight
is 1, matching legacy library items; a teacher rubric scored out of 100 does not
make an item one hundred times heavier in a mixed exam. It does not copy the
interaction or key into public question provenance. Sources, groups, publication
checks, plan gates, credit accounting and request replay remain atomic. Selected
practice-only types, or items explicitly marked `metadata.assessment_track=free`,
are rejected before acquisition into an OYSS (`meb_common`) draft. A free practice
acquisition remains available under the ordinary publication and plan gates.

Verification: the library integration test covers all twelve canonical type
contracts, invalid keys, disabled types, legacy source compatibility, structured
acquisition, private-key separation, native QT hash constraints, source copies,
quota rollback, replay, family isolation and OYSS exclusion.
