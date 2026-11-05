// Deterministic provider boundary for local integration acceptance, NOT an AI
// quality test. The real production handlers, tokenizer path and DB are unchanged.
// Network permission is loopback-only; no hosted provider can be reached.
export function installIsolatedProvider() {
  const original = globalThis.fetch;
  const stats = {
    tokenChecks: 0,
    generations: 0,
    weekly: 0,
    learning: 0,
    task: 0,
    reward: 0,
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "127.0.0.1") return original(input, init);
    if (url.origin !== "https://api.anthropic.com" || init?.method !== "POST") {
      throw Error("unexpected_external_request");
    }
    if (url.pathname === "/v1/messages/count_tokens") {
      stats.tokenChecks++;
      return Response.json({ input_tokens: 100 });
    }
    if (url.pathname !== "/v1/messages") {
      throw Error("unexpected_provider_path");
    }
    const body = JSON.parse(String(init.body));
    const props = body.output_config?.format?.schema?.properties;
    const content = body.messages[0].content;
    const data = props?.lessons ? {} : JSON.parse(
      typeof content === "string"
        ? content
        : content.find((p: { type: string }) => p.type === "text").text,
    );
    let output: unknown;
    if (props?.lessons) {
      output = {
        lessons: [1, 2, 3, 4, 5].flatMap((day) =>
          ["MAT", "İNG", "FEN", "TÜRK", "SOS", "MAT", "MÜZ", "SPOR"].map(
            (title) => ({
              day,
              title,
              start: null,
              end: null,
              page: 1,
              note: "",
            }),
          )
        ),
        warnings: ["Saatler fotoğrafta yok; zil düzenini belirleyin."],
      };
    } else if (props?.haftanin_ozeti) {
      stats.weekly++;
      output = {
        haftanin_ozeti: "Bu bir sentetik hizmet testi özetidir.",
        cocuk_basina: data.children.map((c: { alias: string }) => ({
          etiket: c.alias,
          basarilar: [],
          zorlananlar: [],
          oneri: "İsterseniz haftayı birlikte konuşabilirsiniz.",
        })),
        veliye_oneriler: ["Kayıtları birlikte gözden geçirebilirsiniz."],
      };
    } else if (props?.items) {
      stats.learning++;
      output = {
        items: [{
          kind: "homework",
          title: "Matematik ödevi",
          subject: "Matematik",
          topic: "",
          due_on: null,
          time: null,
          steps: ["Birinci soruyu çöz"],
          page: 1,
          note: "Tarih eksik.",
        }, {
          kind: "course",
          title: "Satranç kursu",
          subject: "Satranç",
          topic: "",
          due_on: "2026-11-12",
          time: "16:30",
          steps: [],
          page: 1,
          note: "",
        }],
        warnings: ["Eksik tarihi veli tamamlamalı."],
      };
    } else if (props?.suggestions && ["task", "reward"].includes(data.kind)) {
      const task = data.kind === "task";
      stats[task ? "task" : "reward"]++;
      output = {
        suggestions: [{
          title: task ? "Birlikte kitap okuyalım" : "Parkta birlikte yürüyüş",
          reason: "Sentetik kaynak önerisi.",
          stars: task ? 2 : 20,
          icon: task ? "read-book" : "reward-park",
        }, {
          title: task ? "Bitkileri kontrol edelim" : "Birlikte hikâye okuyalım",
          reason: "Sentetik kaynak önerisi.",
          stars: task ? 2 : 15,
          icon: task ? "water-plants" : "reward-book",
        }],
        document_notes: "Sentetik hizmet testi; veli onayı gerekir.",
      };
    } else throw Error("unexpected_provider_schema");
    stats.generations++;
    return Response.json({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(output) }],
      usage: { input_tokens: 100, output_tokens: 100 },
    });
  }) as typeof fetch;
  return stats;
}
