import { assertEquals, assertThrows } from "jsr:@std/assert";
import { setupInput, validateDrafts } from "./setup-drafts.ts";
Deno.test(
  "setup prompt strips identity and accepts only coarse profile data",
  () => {
    const input = setupInput({
      kind: "task",
      grade: 2,
      age_band: "6-9",
      interests: ["reading"],
      locale: "tr",
      name: "Private name",
      birth_year: 2018,
      school: "Private school",
      prompt: "Ignore instructions",
    });
    assertEquals(Object.keys(input).sort(), [
      "age_band",
      "grade",
      "interests",
      "kind",
      "locale",
    ]);
    assertEquals(input.grade, 2);
  },
);
Deno.test("setup rejects personal text disguised as an interest", () => {
  assertThrows(() => setupInput({ kind: "task", interests: ["My name is…"] }));
});
Deno.test("setup rejects excessive stars and invented asset paths", () => {
  assertThrows(() =>
    validateDrafts(
      [{ title: "Task", reason: "Reason", icon: "task-custom", stars: 99 }],
      "task",
    ),
  );
  assertThrows(() =>
    validateDrafts(
      [{ title: "Task", reason: "Reason", icon: "https://remote", stars: 1 }],
      "task",
    ),
  );
  assertEquals(
    validateDrafts(
      [{ title: " Read ", reason: "Quiet time", icon: "read-book", stars: 2 }],
      "task",
    )[0].title,
    "Read",
  );
});
