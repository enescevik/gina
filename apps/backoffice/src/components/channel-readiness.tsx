import { useEffect, useState } from "react";
import { Card } from "./Layout";
import { adminRpc } from "@/lib/admin-rpc";
import { fmtDateTime } from "@/lib/format";
import {
  type ChannelKey,
  channelNames,
  missingLabel,
  type Readiness,
  readReadiness,
} from "@/lib/channel-ops";

// Reads public.channel_readiness() (release role). Never claims "sent";
// a ready channel only means the provider can be asked to accept messages.
export function useChannelReadiness(enabled: boolean, tick = 0) {
  const [state, setState] = useState<
    { data: Readiness | null; error: boolean; key: string }
  >({ data: null, error: false, key: "" });
  const key = `${enabled}:${tick}`;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void adminRpc("channel_readiness", {}, 15000).then((data) => {
      if (live) setState({ data: readReadiness(data), error: false, key });
    }).catch(() => {
      if (live) setState({ data: null, error: true, key });
    });
    return () => {
      live = false;
    };
  }, [enabled, key]);
  return { ...state, loading: enabled && state.key !== key };
}

export function ChannelReadinessCard(
  { readiness, error, loading, onRetry }: {
    readiness: Readiness | null;
    error: boolean;
    loading: boolean;
    onRetry: () => void;
  },
) {
  const order: ChannelKey[] = ["in_app", "push", "email", "sms"];
  return (
    <div data-testid="channel-readiness">
      <Card title="Kanal hazırlığı">
        <p className="mb-3 text-sm text-slate-600">
          Hazır kanal, mesajın gönderim hizmetine verilebileceğini gösterir.
          Sağlayıcı kabulü teslim veya okundu anlamına gelmez.
        </p>
        {loading
          ? <p role="status">Kanal durumu okunuyor…</p>
          : error || !readiness
          ? (
            <p role="alert" className="text-sm text-red-800">
              Kanal durumu okunamadı.{" "}
              <button className="support-link" onClick={onRetry}>
                Yeniden dene
              </button>
            </p>
          )
          : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {order.map((k) => {
                const c = readiness[k];
                const ready = !!c?.ready;
                return (
                  <li
                    key={k}
                    data-channel={k}
                    data-ready={ready ? "true" : "false"}
                    className={"rounded-2xl border p-4 " +
                      (ready
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50")}
                  >
                    <p className="font-bold">{channelNames[k]}</p>
                    <p className="mt-1 text-sm font-bold">
                      {ready ? "Hazır" : "Hazır değil"}
                    </p>
                    {c && c.missing.length
                      ? (
                        <ul className="mt-2 list-disc pl-5 text-sm">
                          {[...new Set(c.missing.map(missingLabel))].map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      )
                      : null}
                    {c?.reported_at
                      ? (
                        <p className="mt-2 text-xs text-slate-600">
                          Son durum bildirimi: {fmtDateTime(c.reported_at)}
                        </p>
                      )
                      : null}
                  </li>
                );
              })}
            </ul>
          )}
        {readiness?.marketing && !readiness.marketing.allowed
          ? (
            <p className="mt-3 text-sm text-slate-600">
              Pazarlama iletileri kapalı: hukuk incelemesi tamamlanmadı.
            </p>
          )
          : null}
      </Card>
    </div>
  );
}
