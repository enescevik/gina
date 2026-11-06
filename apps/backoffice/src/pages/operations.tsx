import { useState } from "react";
import { Card, Layout, Notice } from "@/components/Layout";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { AiFailureQueue, type QueueJob } from "@/components/ai-failure-queue";

type Policy = {
  action: string;
  plan_code: string;
  enabled: boolean;
  monthly_limit: number;
  per_minute: number;
  max_concurrent: number;
};
type Job = QueueJob;
interface Operations {
  policies: Policy[];
  health: {
    provider: string;
    failures: number;
    open_until: string | null;
    paused: boolean;
  }[];
}
const LIMIT_LABELS = { monthly_limit: "Aylık", per_minute: "Dakikada", max_concurrent: "Aynı anda" } as const;
const names: Record<string, string> = {
  generate: "Soru üretimi",
  import: "Belgeden ders programı",
  grade: "Deneme değerlendirmesi",
  plan: "Çalışma planı",
  weekly: "Haftalık aile özeti",
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
  // Arıza kuyruğu sunucuda filtrelenir/sayfalanır (S06); bu sayaç yeniden yüklemeyi tetikler.
  const [refreshKey, setRefreshKey] = useState(0);
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
      setRefreshKey((n) => n + 1);
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
        <button className="btn-secondary" onClick={() => { reload(); setRefreshKey((n) => n + 1); }}>
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
      <AiFailureQueue
        refreshKey={refreshKey}
        onInspect={(j) => {
          setSelected(j);
          setReason("");
          setConfirmed(false);
        }}
      />
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
        <label className="flex min-h-12 items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5"
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
            // C12: ekran okuyucu ham kod yerine sütun adını ve işlemi duyar.
            aria-label={`${names[p.action] ?? p.action} · ${t.plans[p.plan_code] ?? p.plan_code} · ${LIMIT_LABELS[k]}`}
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
