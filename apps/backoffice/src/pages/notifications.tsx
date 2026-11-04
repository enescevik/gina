import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PushRecoveryCommand,
  pushRecoveryCommandSchema,
  readPushRecoveryReceipt,
} from "@gina/core";
import { Card, Layout, Notice } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { createLibraryQueue } from "@/lib/library-review";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
interface Row {
  id: number;
  kind: string;
  status: string;
  attempts: number;
  created_at: string;
  next_attempt_at: string;
  revision: number;
  retryable: boolean;
  receipts: Record<string, number>;
  recoveries: { revision: number; reason: string; created_at: string }[];
}
interface Data {
  summary: Record<string, number>;
  rows: Row[];
}
const labels: Record<string, string> = {
  attention: "İşlem gerekenler",
  all: "Tümü",
  pending: "Sırada",
  sending: "Gönderiliyor",
  sent: "Sağlayıcı kabul etti",
  failed: "Başarısız",
  skipped_unconfigured: "Hizmet ayarı eksik",
  no_targets: "Uygun cihaz yok",
};
const kinds: Record<string, string> = {
  task_awaiting_approval: "Görev onayı",
  task_approved: "Görev onaylandı",
  task_returned: "Görev geri gönderildi",
  exam_assigned: "Yeni Prova",
  exam_finished: "Prova tamamlandı",
  cohort_results: "Birlikte Prova sonucu",
  weekly_summary: "Haftalık özet",
};
export default function Notifications() {
  const { session } = useAuth();
  return (
    <Layout title="Bildirim teslimi" release>
      {session
        ? <Workspace key={session.user.id} user={session.user.id} />
        : null}
    </Layout>
  );
}
function Workspace({ user }: { user: string }) {
  const { roles, rolesReady, roleError } = useAuth();
  const allowed = rolesReady && !roleError && roles.includes("release");
  const queue = useMemo(
    () =>
      createLibraryQueue(
        user,
        "push-recovery",
        (v) => pushRecoveryCommandSchema.parse(v),
      ),
    [user],
  );
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false),
    [pending, setPending] = useState<PushRecoveryCommand | null>(null),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("attention"),
    [before, setBefore] = useState<number | undefined>(),
    [tick, setTick] = useState(0),
    [data, setData] = useState<Data | null>(null),
    [doneFor, setDoneFor] = useState(""),
    [loadError, setLoadError] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState("");
  const gate = useRef(false), active = useRef(allowed);
  useEffect(() => {
    active.current = allowed;
  }, [allowed]);
  useEffect(() => {
    let live = true;
    void queue.restore().then((v) => {
      if (live) setPending(v);
    }).catch(() => {
      if (live) setStorageError(true);
    }).finally(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [queue]);
  const queryKey = JSON.stringify([allowed, filter, before, tick]);
  const loading = doneFor !== queryKey;
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    void Promise.resolve(supabase().rpc("release_push_operations", {
      p_status: filter,
      p_before: before,
      p_limit: 20,
    }).abortSignal(AbortSignal.timeout(15000))).then((r) => {
      if (!live) return;
      if (r.error) {
        setLoadError(true);
        setData(null);
      } else {
        setData(r.data as unknown as Data);
        setLoadError(false);
      }
      setDoneFor(queryKey);
    }).catch(() => {
      if (live) {
        setLoadError(true);
        setData(null);
        setDoneFor(queryKey);
      }
    });
    return () => {
      live = false;
    };
  }, [allowed, filter, before, tick, queryKey]);
  const locked = !ready || !allowed || busy || storageError || !!pending;
  async function send(c: PushRecoveryCommand) {
    if (gate.current || !active.current || !ready || storageError) return;
    gate.current = true;
    setBusy(true);
    setMessage("");
    setSuccess("");
    try {
      await queue.prepare(c);
      setPending(c);
      const r = await supabase().rpc("release_retry_push", {
        p_request: c.request,
        p_outbox_id: c.id,
        p_revision: c.revision,
        p_reason: c.reason,
        p_confirmed: c.confirmed,
      }).abortSignal(AbortSignal.timeout(25000));
      if (r.error) {
        if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(r.error.code ?? "")) {
          await queue.acknowledge(c.request);
          setPending(null);
        }
        throw r.error;
      }
      readPushRecoveryReceipt(r.data, c);
      await queue.acknowledge(c.request);
      setPending(null);
      setSelected(null);
      setReason("");
      setConfirmed(false);
      setSuccess(
        "İstek kaydedildi. Yalnız başarısız kalan cihazlar yeniden kontrol edilecek.",
      );
      setTick((v) => v + 1);
    } catch (e) {
      const code = (e as Error).message;
      setMessage(
        code === "push_recovery_changed"
          ? "Kayıt başka bir işlemle değişti. Güncel kaydı yeniden seçin."
          : code === "push_recovery_unavailable"
          ? "Bu kayıt artık yeniden gönderime uygun değil. Süreyi, kalan cihazları ve mevcut durumu kontrol edin."
          : code === "push_recovery_limited"
          ? "Saatlik işlem sınırına ulaşıldı. Daha sonra yeniden deneyin."
          : code === "forbidden"
          ? "Güncel yayın operasyonu yetkisi gerekiyor."
          : "İşlem doğrulanamadı. Bekleyen istek varsa aynı isteğin sonucunu kontrol edin.",
      );
      setTick((v) => v + 1);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-6 max-w-3xl">
        <p className="text-lg font-bold">
          Her cihaza ayrı takip, kontrollü yeniden deneme
        </p>
        <p className="mt-2 text-slate-600">
          Son 30 gündeki gönderimleri izleyin. Çocuk adı, mesaj içeriği ve cihaz
          anahtarları burada gösterilmez. Sağlayıcının kabul etmesi, bildirimin
          cihazda görüldüğü anlamına gelmez.
        </p>
      </div>
      {message ? <Notice tone="error">{message}</Notice> : null}
      {success ? <Notice tone="ok">{success}</Notice> : null}
      {storageError
        ? (
          <Notice tone="error">
            İstek cihazda saklanamadığı için işlem kapalı. Kayıtları
            görüntüleyebilirsiniz.
          </Notice>
        )
        : null}
      {pending
        ? (
          <Card title="Önceki sıraya alma isteği saklandı">
            <p>
              Kayıt #{pending.id}. Kontrol etmek ikinci bir gönderim talebi
              oluşturmaz.
            </p>
            <button
              className="btn mt-3"
              disabled={busy || !allowed}
              onClick={() => void send(pending)}
            >
              İsteğin sonucunu kontrol et
            </button>
          </Card>
        )
        : null}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {["pending", "sending", "failed", "skipped_unconfigured"].map((k) => (
          <div
            key={k}
            className="rounded-3xl border border-purple-100 bg-white p-5"
          >
            <p className="text-2xl font-extrabold text-purple-700">
              {data?.summary[k] ?? "—"}
            </p>
            <p className="mt-1 text-sm text-slate-600">{labels[k]}</p>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="label flex-1">
          Göster<select
            className="input"
            value={filter}
            disabled={locked || !!selected}
            onChange={(e) => {
              setFilter(e.target.value);
              setBefore(undefined);
              setSelected(null);
              setReason("");
              setConfirmed(false);
            }}
          >
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            setTick((v) => v + 1);
          }}
        >
          Durumu yenile
        </button>
      </div>
      {selected && !pending
        ? (
          <Card
            title={`Kayıt #${selected.id} · ${
              kinds[selected.kind] ?? "Bildirim"
            }`}
          >
            <p>
              Başarılı cihaz makbuzları korunur. Yalnız başarısız kalan cihazlar
              tekrar kontrol edilir; güncel izin ve oturum koşulları yine
              geçerlidir. Bu işlem toplu geçmiş gönderimi yapmaz.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Yalnız son 24 saat; kayıt başına en fazla iki operatör kurtarması.
              Sağlayıcı kabul yanıtı kaybolmuşsa ikinci bildirim olasılığı
              vardır.
            </p>
            <label className="label mt-4">
              Yapılan kontrol ve gerekçe<textarea
                className="input min-h-24"
                maxLength={1000}
                value={reason}
                disabled={locked}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Hangi hizmet ayarını veya hatayı düzelttiniz? Kişisel bilgi ya da anahtar yazmayın."
              />
            </label>
            <label className="my-4 flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={locked}
                onChange={(e) => setConfirmed(e.target.checked)}
              />Hizmet ayarını kontrol ettim; yalnız başarısız kalan
              gönderimleri yeniden sıraya almak istiyorum.
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="btn"
                disabled={locked || !confirmed || reason.trim().length < 10}
                onClick={() =>
                  void send({
                    request: crypto.randomUUID(),
                    id: selected.id,
                    revision: selected.revision,
                    reason: reason.trim(),
                    confirmed: true,
                  })}
              >
                Tekrar sıraya al
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setReason("");
                  setConfirmed(false);
                }}
              >
                Vazgeç
              </button>
            </div>
          </Card>
        )
        : null}
      {loading
        ? <p role="status">Gönderimler yükleniyor…</p>
        : loadError
        ? <Notice tone="error">Gönderimler okunamadı. Durumu yenileyin.</Notice>
        : !data?.rows.length
        ? (
          <Card title="Bu görünümde kayıt yok">
            <p>
              Bu filtrede gösterilecek bildirim bulunmuyor. Diğer durumları
              üstteki seçimden inceleyebilirsiniz.
            </p>
          </Card>
        )
        : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {data.rows.map((row) => (
              <Card key={row.id} title={kinds[row.kind] ?? "Bildirim"}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800">
                    {labels[row.status] ?? row.status}
                  </span>
                  <span className="text-sm text-slate-500">
                    #{row.id} · {fmtDateTime(row.created_at)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Sağlayıcı kabulü</dt>
                    <dd className="font-bold">
                      {row.receipts.sent ?? 0} cihaz
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Bu turdaki deneme</dt>
                    <dd className="font-bold">{row.attempts} / 5</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Geçici hata</dt>
                    <dd className="font-bold">
                      {row.receipts.retry ?? 0} cihaz
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Operatör kurtarması</dt>
                    <dd className="font-bold">{row.revision} / 2</dd>
                  </div>
                </dl>
                {row.status === "pending"
                  ? (
                    <p className="mt-3 text-sm">
                      En erken deneme: {fmtDateTime(row.next_attempt_at)}
                    </p>
                  )
                  : null}
                {row.recoveries.length
                  ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-bold">
                        Kontrol geçmişi
                      </summary>
                      {row.recoveries.map((r) => (
                        <p
                          key={r.revision}
                          className="mt-3 whitespace-pre-wrap text-sm"
                        >
                          {fmtDateTime(r.created_at)} · {r.reason}
                        </p>
                      ))}
                    </details>
                  )
                  : null}
                {row.retryable
                  ? (
                    <button
                      className="btn-secondary mt-4 w-full"
                      disabled={locked || !!selected}
                      onClick={() => {
                        setSelected(row);
                        setReason("");
                        setConfirmed(false);
                        setMessage("");
                        setSuccess("");
                        window.scrollTo({ top: 0, behavior: "auto" });
                      }}
                    >
                      Kontrol et ve sıraya al
                    </button>
                  )
                  : (
                    <p className="mt-4 text-sm text-slate-500">
                      {row.status === "pending" || row.status === "sending"
                        ? "Gönderim sürerken yeni talep oluşturulmaz."
                        : "Bu kayıtta yeniden gönderime uygun cihaz veya kalan kurtarma hakkı yok."}
                    </p>
                  )}
              </Card>
            ))}
          </div>
        )}
      <div className="mt-5 flex gap-3">
        {before
          ? (
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={() => setBefore(undefined)}
            >
              En yeni kayıtlar
            </button>
          )
          : null}
        {data?.rows.length === 20
          ? (
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={() => setBefore(data.rows.at(-1)!.id)}
            >
              Daha eski kayıtlar
            </button>
          )
          : null}
      </div>
    </>
  );
}
