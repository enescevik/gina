import { validateLearningPlanExtraction as parse } from "./learning-plan-extraction.ts";
const item = () => ({
  kind: "homework",
  title: "Kesirler",
  subject: "Matematik",
  topic: "Birim kesir",
  due_on: null,
  time: null,
  steps: ["İki örnek çöz"],
  page: 1,
  note: "Cuma yazıyor; kesin tarih yok.",
});
const rejects = (value: unknown, pages = 1) => {
  let failed = false;
  try {
    parse(value, pages);
  } catch {
    failed = true;
  }
  if (!failed) throw Error("accepted invalid extraction");
};
Deno.test("learning extraction rejects a paragraph title without logging or silently truncating it", () => {
  const privateTitle = "Özel belge başlığı ".repeat(12);
  try {
    parse({ items: [{ ...item(), title: privateTitle }], warnings: [] }, 1);
    throw Error("accepted long title");
  } catch (e) {
    if (
      !(e instanceof Error) || e.message !== "ai_result_invalid" ||
      !("validationCode" in e) || e.validationCode !== "title" ||
      JSON.stringify(e).includes(privateTitle)
    ) throw e;
  }
});
Deno.test("learning extraction: missing dates stay null and source uncertainty survives", () => {
  const r = parse({ items: [item()], warnings: [] }, 1);
  if (
    r.items[0].due_on !== null || r.items[0].time !== null || !r.items[0].note
  ) throw Error();
});
Deno.test("learning extraction: invalid dates and time cannot become assignments", () => {
  for (const due_on of ["2026-02-29", "tomorrow", "11/12", "2026-13-01", 42]) {
    rejects({ items: [{ ...item(), due_on }], warnings: [] });
  }
  rejects({ items: [{ ...item(), time: "25:00" }], warnings: [] });
});
Deno.test("learning extraction: all items and pages are bounded", () => {
  rejects({ items: Array.from({ length: 13 }, item), warnings: [] });
  rejects({ items: [{ ...item(), page: 2 }], warnings: [] });
  rejects({
    items: [{ ...item(), steps: Array(13).fill("Read") }],
    warnings: [],
  });
  rejects({ items: [item()], warnings: [] }, 21);
  const combined = parse(
    { items: [{ ...item(), page: 20 }], warnings: [] },
    20,
  );
  if (combined.items[0].page !== 20) throw Error("combined source page lost");
});
Deno.test("learning extraction: rewards, unknown keys and fabricated source IDs are rejected", () => {
  for (
    const change of [
      { stars: 5 },
      { source_id: "foreign" },
      { page: 0 },
      { kind: "reward" },
      { steps: [" "] },
      { title: " " },
      { topic: null },
    ]
  ) rejects({ items: [{ ...item(), ...change }], warnings: [] });
});
Deno.test("learning extraction: no useful content must explain why", () => {
  rejects({ items: [], warnings: [] });
  const r = parse({ items: [], warnings: ["Belge okunamıyor."] }, 1);
  if (r.items.length) throw Error();
});
Deno.test("learning extraction: trims text without completing dates or steps", () => {
  const r = parse({
    items: [{ ...item(), title: " Kesirler ", steps: [" Oku "] }],
    warnings: [],
  }, 1);
  if (r.items[0].title !== "Kesirler" || r.items[0].steps.join() !== "Oku") {
    throw Error();
  }
});
