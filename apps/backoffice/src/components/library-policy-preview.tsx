import { useState } from "react";
import { useAdminQuery } from "@/lib/use-async";
import { Notice } from "./Layout";
import { adminRpc } from "./review-rpc";

// P05 `library_policy_preview`: kayıtlı ve açık katkı ödül kurallarının, verilen kabul sayısında ne
// vereceğini gösterir. Önizleme hak vermez, kural değiştirmez.
type Preview = {
  accepted_count: number;
  rules: { index: number; title: string | null; threshold: number; kind: string; amount: number; plan: string | null; valid_days: number; milestones: number; granted: number; plan_days: number; next_at: number | null }[];
  totals: { library: number; ai_questions: number; plan_days: number };
  stacking: { rules: number[]; kind: string; first_common_count: number; combined_amount_at_common: number }[];
  next: { count: number; remaining: number; grants: { index: number; kind: string; amount: number }[] } | null;
  rule: string;
};
const kindLabel: Record<string, string> = { library: "kütüphane hakkı", ai_questions: "AI soru hakkı", plan: "paket günü" };

export function LibraryPolicyPreview() {
  const [input, setInput] = useState("10");
  const [count, setCount] = useState(10);
  const preview = useAdminQuery(() => adminRpc<Preview>("library_policy_preview", { p_accepted_count: count, p_rules: null }), [count]);
  const p = preview.data;
  return (
    <section aria-labelledby="policy-preview-title" className="mt-6 rounded-3xl border border-violet-100 bg-white p-5" data-testid="policy-preview">
      <h2 id="policy-preview-title" className="text-lg font-bold">Ödül kuralı önizlemesi</h2>
      <p className="mb-3 max-w-3xl text-sm text-slate-600">
        Kayıtlı ve açık kurallarla, bir ailenin kabul edilen toplam soru sayısında ne kazanacağını gösterir. Önizleme hak vermez ve
        kural değiştirmez; aynı kilometre taşı ikinci kez ödenmez.
      </p>
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(input);
          if (Number.isInteger(n) && n >= 0 && n <= 100000) setCount(n);
        }}
      >
        <label className="label mb-0">
          Kabul edilen soru sayısı
          <input className="input mt-2 w-40" type="number" min={0} max={100000} value={input} onChange={(e) => setInput(e.target.value)} />
        </label>
        <button className="btn-secondary">Önizle</button>
      </form>
      {preview.error ? <Notice tone="error">Önizleme hesaplanamadı. Sayının 0–100000 arasında olduğunu kontrol edin.</Notice> : null}
      {p
        ? (
          <div className="grid gap-3 text-sm">
            <p className="font-semibold" role="status">
              {p.accepted_count} kabul edilen soruda toplam: {p.totals.library} kütüphane hakkı · {p.totals.ai_questions} AI soru hakkı · {p.totals.plan_days} paket günü
            </p>
            {p.next
              ? <p>Sıradaki kilometre taşı: {p.next.count}. soru ({p.next.remaining} kaldı) → {p.next.grants.map((g) => `${g.amount} ${kindLabel[g.kind] ?? g.kind}`).join(", ")}</p>
              : <p>Açık kural yok; katkılar hak vermez.</p>}
            {p.rules.length
              ? (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr><th>Kural</th><th>Eşik</th><th>Verilen</th><th>Ulaşılan</th><th>Toplam</th><th>Sonraki</th></tr>
                    </thead>
                    <tbody>
                      {p.rules.map((r) => (
                        <tr key={r.index}>
                          <td>{r.title ?? `Kural ${r.index + 1}`}</td>
                          <td>Her {r.threshold} soru</td>
                          <td>{r.amount} {kindLabel[r.kind] ?? r.kind}{r.kind === "plan" ? ` (${r.plan}, en çok ${r.valid_days} gün)` : ""}</td>
                          <td>{r.milestones} kez</td>
                          <td>{r.kind === "plan" ? `${r.plan_days} gün` : r.granted}</td>
                          <td>{r.next_at ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              : null}
            {p.stacking.map((s, i) => (
              <p key={i} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                Yığılma: {s.rules.map((x) => x + 1).join(" ve ")}. kurallar aynı türde ({kindLabel[s.kind] ?? s.kind}); {s.first_common_count}. soruda birlikte
                {" "}{s.combined_amount_at_common} verir.
              </p>
            ))}
          </div>
        )
        : null}
    </section>
  );
}
