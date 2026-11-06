// C10 bileşeni, D3'te /notifications sayfasına bağlandı. Başarısız e-posta/SMS teslimlerini süzgeç ve keyset
// sayfalama ile gösterir (public.release_channel_failure_page) ve açık, sınırlı yeniden sıraya almayı
// (public.release_requeue_channel, en çok 3) çağırır. İkisi de yayın rolü ister. Sunucu adres, kod veya içerik
// döndürmez; burada kişisel bilgi gösterilemez. "Kabul" sağlayıcı kabulüdür; teslim veya okunma değildir.
import { useEffect, useState } from "react";
import { Card } from "./Layout";
import { adminRpc, rpcMessage } from "@/lib/admin-rpc";
import { fmtDateTime } from "@/lib/format";
import { blockedLabel, channelNames, type ChannelKey } from "@/lib/channel-ops";

type FailureRow = {
  id: number;
  channel: "email" | "sms";
  kind: string;
  status: string;
  skip_reason: string | null;
  last_error: string | null;
  attempts: number;
  requeue_count: number;
  created_at: string;
  announcement_title: string | null;
  requeueable: boolean;
};
type Cursor = { before: string; before_id: number };
type Page = { key: string; rows: FailureRow[]; next: Cursor | null; total: number; max_requeues: number };
const requeueText: Record<string, string> = {
  queued: "Yeniden sıraya alındı; alıcı, tercih ve duyuru güncelliği gönderimden önce yeniden denetlenir.",
  already_queued: "Zaten sırada; ikinci kez eklenmedi.",
  already_accepted: "Sağlayıcı bu iletiyi zaten kabul etmiş; yeniden gönderilmez.",
};
const requeueError: Record<string, string> = {
  channel_not_ready: "Kanal hazır değil; önce sağlayıcı ayarını tamamlayın.",
  channel_requeue_limit: "Bu ileti en çok 3 kez yeniden sıraya alınabilir.",
  announcement_not_current: "Duyuru geri çekilmiş ya da süresi dolmuş.",
  channel_not_requeueable: "Bu kayıt yeniden gönderilemez.",
  forbidden: "Bu işlem yayın rolü gerektirir.",
};
const channelFilters = [["", "Bütün kanallar"], ["email", "E-posta"], ["sms", "SMS"]] as const;
const reasonFilters = [
  ["", "Bütün nedenler"],
  ["requeueable", "Yeniden sıraya alınabilir"],
  ["failed", "Başarısız"],
  ["provider_unconfigured", "Hizmet ayarı eksikti"],
  ["duplicate_recipient", "Mükerrer engellendi"],
] as const;
const PAGE_SIZE = 25;
function reasonLabel(row: FailureRow): string {
  if (row.status === "failed") return row.last_error === "retry_limit" ? "Deneme sınırı doldu" : "Sağlayıcı kalıcı olarak reddetti";
  if (row.skip_reason === "duplicate_recipient") return "Aynı adrese aynı duyuru zaten gönderildi (mükerrer engellendi)";
  return blockedLabel(row.skip_reason ?? "");
}

export function ChannelFailuresCard({ enabled }: { enabled: boolean }) {
  const [channel, setChannel] = useState("");
  const [reason, setReason] = useState("");
  // Sayfa yığını: ilk eleman null (ilk sayfa); "Önceki sayfa" bir öncekine döner.
  const [cursors, setCursors] = useState<(Cursor | null)[]>([null]);
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Page | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cursor = cursors[cursors.length - 1] ?? null;
  const key = JSON.stringify([channel, reason, cursor, tick]);
  // Süzgeç/sayfa değişince eski satırlar gösterilmez; yeni yanıt gelene kadar "Okunuyor".
  const page = loaded?.key === key ? loaded : null;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void adminRpc("release_channel_failure_page", {
      p_channel: channel || null,
      p_reason: reason || null,
      p_before: cursor?.before ?? null,
      p_before_id: cursor?.before_id ?? null,
      p_limit: PAGE_SIZE,
    }, 15000).then((data) => {
      const d = data as Partial<Page> | null;
      if (!live) return;
      setLoaded({
        key,
        rows: Array.isArray(d?.rows) ? d.rows : [],
        next: d?.next ?? null,
        total: typeof d?.total === "number" ? d.total : 0,
        max_requeues: typeof d?.max_requeues === "number" ? d.max_requeues : 3,
      });
      setError(false);
    }).catch(() => {
      if (live) setError(true);
    });
    return () => {
      live = false;
    };
  }, [enabled, channel, reason, cursor, key]);

  function filter(set: (v: string) => void, v: string) {
    set(v);
    setCursors([null]);
    setNotice(null);
  }

  async function requeue(id: number) {
    if (busy !== null) return;
    setBusy(id);
    setNotice(null);
    try {
      const data = await adminRpc("release_requeue_channel", { p_id: id }, 15000) as { status?: string } | null;
      setNotice(requeueText[data?.status ?? ""] ?? "İşlem tamamlandı.");
      setTick((n) => n + 1);
    } catch (e) {
      setNotice(requeueError[rpcMessage(e)] ?? "İşlem tamamlanamadı; yeniden deneyin.");
    } finally {
      setBusy(null);
    }
  }

  const from = (cursors.length - 1) * PAGE_SIZE + 1;
  return (
    <div data-testid="channel-failures">
      <Card title="Başarısız e-posta / SMS teslimleri (son 30 gün)">
        <p className="mb-3 text-sm text-slate-600">
          Yalnız duyuru iletileri yeniden sıraya alınabilir; doğrulama kodları yeniden gönderilmez. Aynı kayıt aynı
          tekil anahtarla gönderilir, ikinci bir ileti oluşmaz. Bir kayıt en çok {page?.max_requeues ?? 3} kez
          yeniden sıraya alınır.
        </p>
        <div className="d3-filters">
          <label className="label">
            Kanal
            <select className="input" value={channel} onChange={(e) => filter(setChannel, e.target.value)} data-testid="failure-channel">
              {channelFilters.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <label className="label">
            Neden
            <select className="input" value={reason} onChange={(e) => filter(setReason, e.target.value)} data-testid="failure-reason">
              {reasonFilters.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        </div>
        {error
          ? (
            <p role="alert" className="text-sm text-red-800">
              Liste okunamadı. <button className="support-link" onClick={() => setTick((n) => n + 1)}>Yeniden dene</button>
            </p>
          )
          : !page
          ? <p role="status">Okunuyor…</p>
          : page.rows.length === 0
          ? <p>{channel || reason ? "Bu süzgeçle kayıt yok." : "Son 30 günde başarısız teslim yok."}</p>
          : (
            <>
              <p className="mb-2 text-sm" data-testid="failure-range">
                {from}–{from + page.rows.length - 1} / {page.total} kayıt
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr><th>Zaman</th><th>Kanal</th><th>Duyuru</th><th>Neden</th><th>Deneme</th><th /></tr>
                  </thead>
                  <tbody>
                    {page.rows.map((r) => (
                      <tr key={r.id} data-testid="failure-row">
                        <td>{fmtDateTime(r.created_at)}</td>
                        <td>{channelNames[r.channel as ChannelKey] ?? r.channel}</td>
                        <td>{r.announcement_title ?? (r.kind === "contact_verification" ? "Doğrulama kodu" : "—")}</td>
                        <td>{reasonLabel(r)}</td>
                        <td>{r.attempts} deneme · {r.requeue_count}/{page.max_requeues} yeniden sıraya alma</td>
                        <td>
                          {r.requeueable
                            ? (
                              <button className="support-link" disabled={busy !== null} onClick={() => void requeue(r.id)}>
                                {busy === r.id ? "…" : "Yeniden sıraya al"}
                              </button>
                            )
                            : r.requeue_count >= page.max_requeues
                            ? <span className="text-slate-500">Sınır doldu</span>
                            : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="btn-secondary" disabled={cursors.length < 2} onClick={() => setCursors((c) => c.slice(0, -1))}>
                  Önceki sayfa
                </button>
                <button
                  className="btn-secondary"
                  disabled={!page.next}
                  onClick={() => {
                    const next = page.next;
                    if (next) setCursors((c) => [...c, next]);
                  }}
                >
                  Sonraki sayfa
                </button>
              </div>
            </>
          )}
        {notice ? <p role="status" className="mt-3 text-sm">{notice}</p> : null}
      </Card>
    </div>
  );
}
