import { assertEquals } from "jsr:@std/assert";
import { messageFor } from "./messages.ts";
const id = "00000000-0000-4000-8000-000000000001";
Deno.test("cohort result push carries only generic text and group identity", () => {
  const msg = messageFor({
    kind: "cohort_results",
    payload: {
      group_id: id,
      child_name: "Secret child",
      points: 90,
      reason: "Private appeal",
      publication_version: 2,
    },
  }, "tr");
  assertEquals(msg.body, "Birlikte Prova sonuçları güncellendi");
  assertEquals(msg.data, { kind: "cohort_results", group_id: id });
});
Deno.test("cohort result text supports English", () => {
  assertEquals(
    messageFor({ kind: "cohort_results", payload: {} }, "en").body,
    "Group practice results have been updated",
  );
});
Deno.test("identity-shaped fields cannot carry private strings or URLs", () => {
  assertEquals(
    messageFor({
      kind: "exam_finished",
      payload: {
        attempt_id: "Secret name",
        exam_id: "https://outside.invalid/track",
        group_id: 42,
        completion_id: id,
      },
    }, "tr").data,
    { kind: "exam_finished", completion_id: id },
  );
});
Deno.test("legacy exam identity and text remain available", () => {
  assertEquals(
    messageFor({ kind: "exam_finished", payload: { attempt_id: id } }, "en")
      .data,
    { kind: "exam_finished", attempt_id: id },
  );
  assertEquals(
    messageFor({ kind: "exam_finished", payload: {} }, "tr").body,
    "Bir deneme tamamlandı",
  );
});
Deno.test("parent notices keep school details off the lock screen", () => {
  const msg = messageFor({ kind: "parent_announcement", payload: { inbox_id: id, school: "Private School", body: "Detailed closure reason", child_id: id } }, "tr");
  assertEquals(msg.body, "Yeni bir GINA duyurusu var");
  assertEquals(msg.data, { kind: "parent_announcement", inbox_id: id });
});
Deno.test("calendar reminders have an English generic notification", () => {
  assertEquals(messageFor({ kind: "education_reminder", payload: {} }, "en").body, "You can review the school calendar");
});
