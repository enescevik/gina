// Deterministic provider boundary for local integration acceptance, NOT an AI
// quality test. The real production handlers, tokenizer path and DB are unchanged.
// Network permission is loopback-only; no hosted provider can be reached.
// C08: deterministik hata enjeksiyonu (yalnız yerel kabul). Sıradaki ücretli /v1/messages isteği bu hatayı alır.
export type ProviderFault = "429" | "503" | "timeout" | "lost" | "badjson";
const faults: ProviderFault[] = [];
export function pushProviderFault(fault: ProviderFault) {
  if (!["429", "503", "timeout", "lost", "badjson"].includes(fault)) throw Error("unknown_fault");
  faults.push(fault);
}
export function installIsolatedProvider() {
  const original = globalThis.fetch;
  const stats = {
    tokenChecks: 0,
    generations: 0,
    weekly: 0,
    learning: 0,
    task: 0,
    reward: 0,
    prova: 0,
    grade: 0,
    /** C08: sağlayıcıya giden her ücretli mesaj isteği (hata enjekte edilenler dahil). */
    messages: 0,
    faults: 0,
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
    stats.messages++;
    const fault = faults.shift();
    if (fault) {
      stats.faults++;
      if (fault === "429" || fault === "503") return new Response("{}", { status: Number(fault) });
      if (fault === "timeout") throw new DOMException("synthetic timeout", "TimeoutError");
      if (fault === "lost") throw new TypeError("synthetic connection reset");
      return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: "{not json" }], usage: { input_tokens: 1, output_tokens: 1 } });
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
    } else if (props?.questions && props?.shared_sources) {
      // C04: deterministic Prova generation (synthetic wording, no curriculum copy).
      // Two linked questions share one passage when at least two are requested.
      stats.prova++;
      const plan: { konu: string; soru_sayisi: number }[] = data.konular;
      const mixed = String(data.tur).startsWith("karışık");
      const only = mixed ? null : String(data.tur);
      const total = plan.reduce((n, r) => n + r.soru_sayisi, 0);
      let n = 0;
      const questions = plan.flatMap((row) =>
        Array.from({ length: row.soru_sayisi }, () => {
          n++;
          const kind = only ?? (n % 2 ? "open_ended" : "multiple_choice");
          const mc = kind === "multiple_choice";
          return {
            topic: row.konu,
            kind,
            difficulty: "orta",
            stem: `Sentetik AI sorusu ${n}: ${row.konu} için kısa bir örnek açıkla.`,
            choices: mc
              ? ["A", "B", "C", "D"].map((key) => ({ key, text: `Seçenek ${key}` }))
              : [],
            correct_key: mc ? "B" : "",
            distractor_notes: mc
              ? [{ key: "A", why: "Sentetik çeldirici gerekçesi." }]
              : [],
            expected_answer: mc ? "B" : `Sentetik beklenen cevap ${n}`,
            solution: `Sentetik çözüm yolu ${n}.`,
            explanation: "Sentetik anlatım.",
            source_urls: [],
            block_id: "",
            outcome_ids: [],
            question_type: "",
            cognitive_demand: "",
            intended_difficulty: "",
            rubric: mc ? { criteria: [], alternative_answers: [] } : {
              criteria: [{ text: "Kavramı doğru adlandırır", points: 50 }, {
                text: "Örnek verir",
                points: 50,
              }],
              alternative_answers: [`Alternatif cevap ${n}`],
            },
            shared_source_id: total >= 2 && n <= 2 ? "S1" : "",
          };
        })
      );
      output = {
        shared_sources: total >= 2
          ? [{ id: "S1", kind: "text", content: "Sentetik ortak metin: bir bahçede ölçüm yapılır." }]
          : [],
        questions,
      };
    } else if (props?.degerlendirmeler) {
      // C08: açık uçlu öneri — puanlama gerekli maddelere sabit 70; AI puanı yalnız öneridir.
      stats.grade++;
      const items = (data.maddeler ?? []) as { ref: string; konu: string; puanlama_gerekli: boolean }[];
      output = {
        degerlendirmeler: items.filter((m) => m.puanlama_gerekli).map((m) => ({
          ref: m.ref,
          puan: 70,
          kisa_geri_bildirim: "Sentetik öneri.",
          eksikler: [],
          iyilestirme_onerileri: [],
        })),
        ozet: {
          guclu_konular: [],
          zayif_konular: [],
          genel_oneri: "Sentetik hizmet testi.",
          konu_analizi: [{ konu: items[0].konu, kanitlar: [items[0].ref], gozlem: "Sentetik gözlem.", sonraki_adim: "Sentetik adım." }],
          calisma_adimlari: [],
          veli_destegi: [],
          sinirlar: ["Sentetik"],
        },
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
