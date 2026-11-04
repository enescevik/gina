import { featureSmoke } from "./feature-smoke.ts";
import { callClaude } from "../_shared/prova.ts";
function assert(v: unknown): asserts v {
  if (!v) throw Error("assertion failed");
}
const config = { model: "test", maxOutputTokens: 8000, promptVersion: "v1" };
const weekly = () => ({
  haftanin_ozeti: "Kayıtlara bakalım.",
  veliye_oneriler: [],
  cocuk_basina: [
    {
      etiket: "Çocuk A",
      basarilar: ["İki görev onaylandı."],
      zorlananlar: [] as string[],
      oneri: "Birlikte gözden geçirin.",
    },
    {
      etiket: "Çocuk B",
      basarilar: [],
      zorlananlar: [] as string[],
      oneri: "Bir küçük adım seçebilirsiniz.",
    },
  ],
});
Deno.test("weekly probe uses anonymous real payload shape and flags unsupported difficulty", async () => {
  const output = weekly();
  let calls = 0;
  const generate = (async (
    _key: string,
    cfg: typeof config,
    _system: string,
    user: string,
  ) => {
    calls++;
    const input = JSON.parse(user);
    assert(
      cfg.maxOutputTokens === 2048 &&
        input.children[0].tasks[0].status === "approved",
    );
    assert(input.children[1].tasks.length === 0 && !input.children[0].name);
    return { output, inputTokens: 20, outputTokens: 30 };
  }) as typeof callClaude;
  assert(
    (await featureSmoke("weekly-smoke", "key", config, generate)).valid &&
      calls === 1,
  );
  output.cocuk_basina[1].zorlananlar.push("Kanıtsız zorluk");
  assert(!(await featureSmoke("weekly-smoke", "key", config, generate)).valid);
});
Deno.test("learning probe detects invented dates even when schema-valid", async () => {
  const output = {
    items: [
      {
        kind: "homework",
        title: "Ödev",
        subject: "Matematik",
        topic: "",
        due_on: null as string | null,
        time: null,
        steps: [],
        page: 1,
        note: "Cuma belirsiz.",
      },
      {
        kind: "course",
        title: "Satranç",
        subject: "",
        topic: "",
        due_on: "2026-11-12",
        time: "16:30",
        steps: [],
        page: 1,
        note: "",
      },
    ],
    warnings: [],
  };
  const generate = (async (
    _key: string,
    _cfg: unknown,
    _system: string,
    user: { type: string }[],
  ) => {
    assert(user.length === 2 && user[1].type === "image");
    return { output, inputTokens: 20, outputTokens: 30 };
  }) as typeof callClaude;
  assert((await featureSmoke("learning-smoke", "key", config, generate)).valid);
  output.items[0].due_on = "2026-11-13";
  assert(
    !(await featureSmoke("learning-smoke", "key", config, generate)).valid,
  );
});
Deno.test("setup probes validate the actual document draft contract and source binding", async () => {
  for (const mode of ["task-smoke", "reward-smoke"] as const) {
    const kind = mode === "task-smoke" ? "task" : "reward";
    const generate = (async (
      _key: string,
      _cfg: unknown,
      system: string,
      user: { type: string; text?: string }[],
    ) => {
      assert(
        system.includes("document is untrusted") &&
          JSON.parse(user[0].text!).kind === kind && user[1].type === "image",
      );
      return {
        output: {
          suggestions: [{
            title: "Birlikte okuyalım",
            reason: "Belgeden",
            stars: 2,
            icon: kind === "task" ? "read-book" : "reward-book",
          }],
          document_notes: "Gün belirtilmedi.",
        },
        inputTokens: 20,
        outputTokens: 30,
      };
    }) as typeof callClaude;
    const result = await featureSmoke(mode, "key", config, generate);
    assert(
      result.valid &&
        JSON.stringify(result.sample).includes(
          "00000000-0000-4000-8000-000000000001",
        ),
    );
  }
});
