import { useState } from "react";
import { Card, Layout, Notice } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { fmtDateTime } from "@/lib/format";

type Policy = {
  action: string;
  plan_code: string;
  enabled: boolean;
  monthly_limit: number;
  per_minute: number;
  max_concurrent: number;
};
type Job = {
  id: string;
  family_id: string;
  action: string;
  status: string;
  retryable: boolean;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};
interface Operations {
  policies: Policy[];
  health: {
    provider: string;
    failures: number;
    open_until: string | null;
    paused: boolean;
  }[];
  jobs: Job[];
}
const names: Record<string, string> = {
  generate: "Soru üretimi",
  import: "Belgeden ders programı",
  grade: "Deneme değerlendirmesi",
  plan: "Çalışma planı",
  working: "İşleniyor",
  done: "Hazır",
  failed: "Başarısız",
  uncertain: "Sonuç doğrulanamadı",
};
export default function OperationsPage() {
  const { data, error, reload } = useAdminQuery(async () =>
    unwrap(await supabase().rpc("admin_ai_operations")) as unknown as Operations
  );
  const [selected, setSelected] = useState<Job | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function allowRetry() {
    if (!selected || busy || !confirmed || reason.trim().length < 10) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase().rpc(
        selected.action === "generate"
          ? "admin_retry_prova_generation"
          : "admin_retry_ai_operation",
        { p_id: selected.id, p_reason: reason.trim() },
      );
      if (error) throw error;
      setSelected(null);
      setReason("");
      setConfirmed(false);
      reload();
    } catch {
      setMessage(
        "İşlem tamamlanamadı. Güncel durumu yenileyip yeniden kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout title="AI işlem merkezi">
      <p className="mb-6 max-w-3xl text-slate-600">
        Üretim durumunu ve işlem sınırlarını izleyin. Aile belgeleri ve
        çocukların cevapları bu ekranda gösterilmez.
      </p>
      {error || message
        ? (
          <Notice tone="error">
            {message || "İşlem bilgileri alınamadı."}
          </Notice>
        )
        : null}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button className="btn-secondary" onClick={reload}>
          Durumu yenile
        </button>
        {data?.health.map((h) => (
          <span
            key={h.provider}
            className="rounded-full bg-brand-light px-4 py-2 text-sm"
          >
            {h.provider}:{" "}
            {h.paused ? "Geçici olarak duraklatıldı" : "Çağrı kabul ediyor"} ·
            {" "}
            {h.failures} ardışık hata
          </span>
        ))}
      </div>
      <Card title="Paketlere göre işlem sınırları">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>İşlem</th>
                <th>Paket</th>
                <th>Durum</th>
                <th>Aylık</th>
                <th>Dakikada</th>
                <th>Aynı anda</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.policies.map((p) => (
                <PolicyRow
                  key={JSON.stringify(p)}
                  policy={p}
                  saved={reload}
                  failed={() => setMessage("İşlem sınırları kaydedilemedi.")}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected
        ? (
          <Card title="Yeni bir denemeye izin ver">
            <p className="mb-4 max-w-3xl">
              Önce sağlayıcıdaki kaydı kontrol edin. Önceki isteğin ücreti
              oluşmuş olabilir. Bu işlem yeni bir AI isteğine izin verir; hemen
              bir çağrı başlatmaz.
            </p>
            <label className="label" htmlFor="retry-reason">
              Kontrol sonucu ve gerekçe
            </label>
            <textarea
              id="retry-reason"
              className="input mb-3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <label className="mb-4 flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />Sağlayıcıyı kontrol ettim; yeniden ücret oluşabileceğini bilerek
              izin veriyorum.
            </label>
            <div className="flex gap-3">
              <button
                className="btn"
                disabled={busy || !confirmed || reason.trim().length < 10}
                onClick={() => void allowRetry()}
              >
                Yeniden denemeye izin ver
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Vazgeç
              </button>
            </div>
          </Card>
        )
        : null}
      <Card title="Son 100 işlem">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>İşlem</th>
                <th>Durum</th>
                <th>Zaman</th>
                <th>Kayıt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.jobs.map((j) => (
                <tr key={j.id}>
                  <td>{names[j.action]}</td>
                  <td>
                    {names[j.status]}
                    {j.error_code
                      ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {j.error_code}
                        </div>
                      )
                      : null}
                  </td>
                  <td>{fmtDateTime(j.created_at)}</td>
                  <td className="text-xs text-slate-500">{j.id}</td>
                  <td>
                    {j.retryable
                      ? (
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setSelected(j);
                            setReason("");
                            setConfirmed(false);
                          }}
                        >
                          İncele
                        </button>
                      )
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.jobs.length
          ? <p className="py-6 text-slate-500">Henüz AI işlemi yok.</p>
          : null}
      </Card>
    </Layout>
  );
}

function PolicyRow(
  { policy: p, saved, failed }: {
    policy: Policy;
    saved: () => void;
    failed: () => void;
  },
) {
  const [draft, setDraft] = useState(p);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      unwrap(
        await supabase().rpc("admin_set_ai_operation_policy", {
          p_action: draft.action,
          p_plan: draft.plan_code as "free" | "plus" | "pro",
          p_enabled: draft.enabled,
          p_monthly: draft.monthly_limit,
          p_per_minute: draft.per_minute,
          p_concurrent: draft.max_concurrent,
        }),
      );
      saved();
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr>
      <td>{names[p.action]}</td>
      <td>{p.plan_code}</td>
      <td>
        <label>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            disabled={busy}
          />{" "}
          Açık
        </label>
      </td>
      {(["monthly_limit", "per_minute", "max_concurrent"] as const).map((k) => (
        <td key={k}>
          <input
            className="input w-24"
            aria-label={`${p.action} ${p.plan_code} ${k}`}
            type="number"
            min={k === "monthly_limit" ? 0 : 1}
            max={k === "monthly_limit" ? 10000 : k === "per_minute" ? 60 : 10}
            value={draft[k]}
            onChange={(e) =>
              setDraft({ ...draft, [k]: Number(e.target.value) })}
            disabled={busy}
          />
        </td>
      ))}
      <td>
        <button
          className="btn-secondary"
          disabled={busy || JSON.stringify(draft) === JSON.stringify(p)}
          onClick={() => void save()}
        >
          Kaydet
        </button>
      </td>
    </tr>
  );
}
