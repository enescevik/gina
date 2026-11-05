import { useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { useAdminQuery } from "@/lib/use-async";
import { Card, Notice } from "./Layout";
import { adminRpc } from "./review-rpc";

// S06 `admin_ai_failed_operations`: arıza/belirsiz kuyruğu sunucu tarafında filtrelenir ve sayfalanır
// (ai_operation_jobs ∪ prova_generation_jobs). `retryable` yalnız operatör kararı için bilgidir.

export type QueueJob = {
  id: string;
  family_id: string;
  action: string;
  status: "working" | "done" | "failed" | "uncertain";
  error_code: string | null;
  created_at: string;
  updated_at: string;
  retryable: boolean;
};
type Page = { total: number; limit: number; offset: number; rows: QueueJob[] };

const names: Record<string, string> = {
  generate: "Soru üretimi",
  import: "Belgeden ders programı",
  learning_import: "Öğrenme planı belgesi",
  grade: "Deneme değerlendirmesi",
  plan: "Çalışma planı",
  weekly: "Haftalık aile özeti",
  setup: "Kurulum önerisi",
  working: "İşleniyor",
  done: "Hazır",
  failed: "Başarısız",
  uncertain: "Sonuç doğrulanamadı",
};
const views = {
  attention: ["failed", "uncertain"],
  failed: ["failed"],
  uncertain: ["uncertain"],
  working: ["working"],
  done: ["done"],
  all: ["working", "done", "failed", "uncertain"],
} as const;
const PAGE = 25;

export function AiFailureQueue({ onInspect, refreshKey }: { onInspect: (job: QueueJob) => void; refreshKey: number }) {
  const [view, setView] = useState<keyof typeof views>("attention");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  // Tarihler yerel gün başı olarak gönderilir; "bitiş" günü dâhildir (sunucuda `< to`).
  const toIso = (d: string, endOfDay = false) => {
    if (!d) return null;
    const date = new Date(d + "T00:00:00");
    if (endOfDay) date.setDate(date.getDate() + 1);
    return date.toISOString();
  };
  const page = useAdminQuery(
    () =>
      adminRpc<Page>("admin_ai_failed_operations", {
        p_statuses: views[view],
        p_action: action || null,
        p_from: toIso(from),
        p_to: toIso(to, true),
        p_limit: PAGE,
        p_offset: offset,
      }),
    [view, action, from, to, offset, refreshKey],
  );
  const d = page.data;
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
  };
  return (
    <Card title="Arıza kuyruğu">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="label mb-0">
          Göster
          <select className="input mt-2" value={view} onChange={(e) => reset(setView)(e.target.value as keyof typeof views)}>
            <option value="attention">İşlem gerekenler (başarısız + doğrulanamadı)</option>
            <option value="failed">Başarısız</option>
            <option value="uncertain">Sonuç doğrulanamadı</option>
            <option value="working">İşleniyor</option>
            <option value="done">Hazır</option>
            <option value="all">Tümü</option>
          </select>
        </label>
        <label className="label mb-0">
          İşlem türü
          <select className="input mt-2" value={action} onChange={(e) => reset(setAction)(e.target.value)}>
            <option value="">Tümü</option>
            {["generate", "import", "learning_import", "grade", "plan", "weekly", "setup"].map((a) => <option key={a} value={a}>{names[a]}</option>)}
          </select>
        </label>
        <label className="label mb-0">
          Başlangıç günü
          <input className="input mt-2" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        </label>
        <label className="label mb-0">
          Bitiş günü (dâhil)
          <input className="input mt-2" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </label>
      </div>
      {page.error ? <Notice tone="error">Arıza kuyruğu okunamadı. Filtreleri ve yetkinizi kontrol edin.</Notice> : null}
      {d
        ? (
          <p role="status" className="mb-2 text-sm text-slate-600" data-testid="failure-queue-status">
            {d.total ? `${d.offset + 1}–${d.offset + d.rows.length} / ${d.total} kayıt (sunucuda filtrelendi, yeniden eskiye)` : "Bu filtreyle kayıt yok."}
          </p>
        )
        : null}
      <div className="overflow-x-auto">
        <table className="table" aria-label="Arıza kuyruğu">
          <thead>
            <tr><th>İşlem</th><th>Durum</th><th>Zaman</th><th>Kayıt</th><th /></tr>
          </thead>
          <tbody>
            {(d?.rows ?? []).map((j) => (
              <tr key={j.id}>
                <td>{names[j.action] ?? j.action}</td>
                <td>
                  {names[j.status]}
                  {j.error_code ? <div className="mt-1 text-xs text-slate-500">{j.error_code}</div> : null}
                </td>
                <td>{fmtDateTime(j.created_at)}</td>
                <td className="text-xs text-slate-500">{j.id}</td>
                <td>{j.retryable ? <button className="btn-secondary" onClick={() => onInspect(j)}>İncele</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d && d.total > PAGE
        ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" disabled={offset === 0 || page.loading} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Önceki {PAGE}</button>
            <button type="button" className="btn-secondary" disabled={offset + PAGE >= d.total || page.loading} onClick={() => setOffset(offset + PAGE)}>Sonraki {PAGE}</button>
            <span className="text-sm text-slate-600">Sayfa {Math.floor(offset / PAGE) + 1} / {Math.ceil(d.total / PAGE)}</span>
          </div>
        )
        : null}
    </Card>
  );
}
