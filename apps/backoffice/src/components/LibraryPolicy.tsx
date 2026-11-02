import { useState } from "react";
import { Card } from "./Layout";
import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/use-async";
type Plan = "free" | "plus" | "pro";
export interface RewardPolicy {
  id: string;
  title: string;
  threshold: number;
  kind: "library" | "ai_questions" | "plan";
  amount: number;
  plan: Plan | null;
  valid_days: number;
  enabled: boolean;
}
export function LibraryPolicy(
  { quotas, rewards, reload, failed }: {
    quotas: { plan: Plan; monthly: number }[];
    rewards: RewardPolicy[];
    reload: () => void;
    failed: (message: string) => void;
  },
) {
  const [draft, setDraft] = useState<RewardPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      unwrap(
        await supabase().rpc("admin_save_contribution_reward", {
          p_id: draft.id,
          p_title: draft.title,
          p_threshold: draft.threshold,
          p_kind: draft.kind,
          p_amount: draft.amount,
          p_plan: draft.kind === "plan" ? draft.plan : null,
          p_days: draft.valid_days,
          p_enabled: draft.enabled,
        }),
      );
      setDraft(null);
      reload();
    } catch (e) {
      failed(
        (e as { message?: string })?.message === "reward_policy_locked"
          ? "Bu kural ile hak verilmiş. Kazanılmış hakları değiştirmek için değil, yeni katkılar için yeni bir kural oluşturun; eski kuralı kapatabilirsiniz."
          : "Ödül kuralı kaydedilemedi. Alanları kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card title="Aylık kütüphane kullanımı">
        <p className="mb-4 text-slate-600">
          Her yeni soru edinimi bir hak kullanır. Aynı sorunun tekrar açılması
          hak harcamaz. Katkıdan kazanılan ek haklar ayrıca korunur.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {quotas.map((q) => (
            <Quota
              key={`${q.plan}:${q.monthly}`}
              quota={q}
              saved={reload}
              failed={failed}
            />
          ))}
        </div>
      </Card>
      <Card title="Katkı ödülleri">
        <p className="mb-4 max-w-3xl text-slate-600">
          Yalnız onaylanan özgün sorular sayılır. Aynı dönüm noktası bir kez
          ödüllendirilir. Açık kurallar birlikte uygulanır; aynı katkıya birden
          fazla hak vermek istemiyorsanız tek kuralı açık tutun.
        </p>
        {rewards.map((r) => (
          <div
            key={r.id}
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-light p-4"
          >
            <div>
              <strong>{r.title}</strong>
              <p className="mt-1 text-sm">
                Her {r.threshold} kabul · {r.amount} {r.kind === "library"
                  ? "kütüphane sorusu"
                  : r.kind === "ai_questions"
                  ? "AI sorusu"
                  : `gün ${r.plan}`} · {r.valid_days} gün geçerli ·{" "}
                {r.enabled ? "Açık" : "Kapalı"}
              </p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setDraft({ ...r })}
            >
              Düzenle
            </button>
          </div>
        ))}
        <button
          className="btn-secondary"
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              title: "",
              threshold: 5,
              kind: "library",
              amount: 20,
              plan: null,
              valid_days: 30,
              enabled: false,
            })}
        >
          Yeni ödül kuralı
        </button>
        {draft
          ? (
            <fieldset
              disabled={busy}
              className="mt-6 grid gap-4 rounded-2xl border border-slate-200 p-5 md:grid-cols-2"
            >
              <legend className="px-2 font-semibold">Ödül kuralı</legend>
              <label className="label md:col-span-2">
                Ad<input
                  className="input"
                  value={draft.title}
                  maxLength={160}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label className="label">
                Kaç soru kabul edildiğinde?<input
                  className="input"
                  type="number"
                  min={1}
                  max={500}
                  value={draft.threshold}
                  onChange={(e) =>
                    setDraft({ ...draft, threshold: +e.target.value })}
                />
              </label>
              <label className="label">
                Kazanılacak hak<select
                  className="input"
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value as RewardPolicy["kind"],
                      plan: e.target.value === "plan" ? "plus" : null,
                    })}
                >
                  <option value="library">Kütüphaneden soru</option>
                  <option value="ai_questions">AI ile soru üretimi</option>
                  <option value="plan">Geçici paket erişimi</option>
                </select>
              </label>
              <label className="label">
                {draft.kind === "plan" ? "Paket süresi (gün)" : "Soru sayısı"}
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={1000}
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft({ ...draft, amount: +e.target.value })}
                />
              </label>
              <label className="label">
                Geçerlilik (gün)<input
                  className="input"
                  type="number"
                  min={1}
                  max={365}
                  value={draft.valid_days}
                  onChange={(e) =>
                    setDraft({ ...draft, valid_days: +e.target.value })}
                />
              </label>
              {draft.kind === "plan"
                ? (
                  <label className="label">
                    Paket<select
                      className="input"
                      value={draft.plan ?? "plus"}
                      onChange={(e) =>
                        setDraft({ ...draft, plan: e.target.value as Plan })}
                    >
                      <option value="plus">Plus</option>
                      <option value="pro">Pro</option>
                    </select>
                    <span className="text-xs font-normal">
                      Süre, geçerlilik gününü aşmaz. Mağaza aboneliği ve ödeme
                      kaydı oluşturmaz.
                    </span>
                  </label>
                )
                : null}
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft({ ...draft, enabled: e.target.checked })}
                />Bu kural açık
              </label>
              <div className="flex gap-3 md:col-span-2">
                <button
                  className="btn"
                  disabled={draft.title.trim().length < 3}
                  onClick={() => void save()}
                >
                  Kaydet
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setDraft(null)}
                >
                  Vazgeç
                </button>
              </div>
            </fieldset>
          )
          : null}
      </Card>
    </>
  );
}
function Quota(
  { quota: q, saved, failed }: {
    quota: { plan: Plan; monthly: number };
    saved: () => void;
    failed: (message: string) => void;
  },
) {
  const [amount, setAmount] = useState(q.monthly);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      unwrap(
        await supabase().rpc("admin_set_library_quota", {
          p_plan: q.plan,
          p_monthly: amount,
        }),
      );
      saved();
    } catch {
      failed("Kütüphane kotası kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <label className="label">
        {q.plan} · soru / ay<input
          className="input"
          type="number"
          min={0}
          max={10000}
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(+e.target.value)}
        />
      </label>
      <button
        className="btn-secondary mt-3"
        disabled={busy || amount === q.monthly}
        onClick={() => void save()}
      >
        Kaydet
      </button>
    </div>
  );
}
