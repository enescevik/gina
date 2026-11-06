// C10 — NOT WIRED to a page yet (backoffice pages belong to C07). Ready-to-mount view of failed email/SMS
// deliveries with a bounded, explicit retry. Reads public.release_channel_failures(limit) and calls
// public.release_requeue_channel(id); both require the release role. No address, code or payload is
// ever returned by the server, so nothing personal can be shown here. "Accepted" is provider acceptance,
// not delivery or reading.
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
function reasonLabel(row: FailureRow): string {
  if (row.status === "failed") return row.last_error === "retry_limit" ? "Deneme sınırı doldu" : "Sağlayıcı kalıcı olarak reddetti";
  if (row.skip_reason === "duplicate_recipient") return "Aynı adrese aynı duyuru zaten gönderildi (mükerrer engellendi)";
  return blockedLabel(row.skip_reason ?? "");
}

export function ChannelFailuresCard({ enabled }: { enabled: boolean }) {
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<FailureRow[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void adminRpc("release_channel_failures", { p_limit: 50 }, 15000).then((data) => {
      const list = (data as { rows?: FailureRow[] } | null)?.rows;
      if (live) { setRows(Array.isArray(list) ? list : []); setError(false); }
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [enabled, tick]);

  async function requeue(id: number) {
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

  return (
    <div data-testid="channel-failures">
      <Card title="Başarısız e-posta / SMS teslimleri (son 30 gün)">
        <p className="mb-3 text-sm text-slate-600">
          Yalnız duyuru iletileri yeniden sıraya alınabilir; doğrulama kodları yeniden gönderilmez.
          Aynı kayıt aynı tekil anahtarla gönderilir, ikinci bir ileti oluşmaz.
        </p>
        {error ? <p role="alert" className="text-sm text-red-800">Liste okunamadı. <button className="support-link" onClick={() => setTick((n) => n + 1)}>Yeniden dene</button></p>
          : !rows ? <p role="status">Okunuyor…</p>
          : rows.length === 0 ? <p>Son 30 günde başarısız teslim yok.</p>
          : (
            <table className="w-full text-sm">
              <thead><tr><th>Zaman</th><th>Kanal</th><th>Duyuru</th><th>Neden</th><th>Deneme</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.created_at)}</td>
                    <td>{channelNames[r.channel as ChannelKey] ?? r.channel}</td>
                    <td>{r.announcement_title ?? (r.kind === "contact_verification" ? "Doğrulama kodu" : "—")}</td>
                    <td>{reasonLabel(r)}</td>
                    <td>{r.attempts}{r.requeue_count ? ` · ${r.requeue_count} kez yeniden` : ""}</td>
                    <td>{r.requeueable ? <button className="support-link" disabled={busy !== null} onClick={() => void requeue(r.id)}>{busy === r.id ? "…" : "Yeniden sıraya al"}</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {notice ? <p role="status" className="mt-3 text-sm">{notice}</p> : null}
      </Card>
    </div>
  );
}
