import { expect, it } from "vitest";
import { type BookletQuestion, buildBookletHtml } from "./prova-booklet";
const q: BookletQuestion = {
  id: "q1",
  topic: "Çevre",
  kind: "open_ended",
  difficulty: "orta",
  stem: "Legacy complete text",
  choices: null,
  correct_key: null,
  expected_answer: "ANSWER_SECRET",
  solution: "SOLUTION_SECRET",
  context: {
    group_id: "g1",
    title: "Okul bahçesi",
    body: "SHARED_SOURCE",
    prompt: "Bahçenin çevresi kaç metredir?",
  },
  images: [{ dataUri: "data:image/png;base64,YQ==", alt: "Garden" }],
};
const labels = {
  answerKey: "Cevap anahtarı",
  name: "Ad",
  date: "Tarih",
  topics: "Konular",
  questionCount: "2 soru",
  solution: "Çözüm",
  expected: "Beklenen",
  difficulty: (d: string) => d,
};
const render = (questions: BookletQuestion[]) =>
  buildBookletHtml({ title: "Test", labels, questions });
it("prints shared text and image once for consecutive members, with separate questions", () => {
  const html = render([q, {
    ...q,
    id: "q2",
    context: { ...q.context!, prompt: "Alanı bul." },
  }]);
  const student = html.split('<section class="key">')[0]!;
  expect(student.match(/SHARED_SOURCE/g)).toHaveLength(1);
  expect(student.match(/data:image\/png/g)).toHaveLength(1);
  expect(student).toContain("Alanı bul.");
  expect(student).not.toContain("Legacy complete text");
  expect(student).not.toContain("ANSWER_SECRET");
  expect(student).not.toContain("SOLUTION_SECRET");
  expect(html).toContain("ANSWER_SECRET");
});
it("repeats common context if another group interrupts the sequence", () => {
  expect(render([q, { ...q, context: undefined }, q]).match(/SHARED_SOURCE/g))
    .toHaveLength(2);
});
it("escapes shared text and never accepts remote or active image URLs", () => {
  const html = render([{
    ...q,
    context: {
      ...q.context!,
      body: "<script>alert(1)</script>",
      title: "<img src=x>",
    },
  }]);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(() =>
    render([{ ...q, images: [{ dataUri: "https://private/file", alt: "x" }] }])
  ).toThrow("invalid_booklet_image");
});
