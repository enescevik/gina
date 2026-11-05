import { useEffect, useState } from "react";
import { Card, Notice } from "./Layout";
import { supabase } from "@/lib/supabase";
import { useAdminQuery } from "@/lib/use-async";
export function SourcePolicy({ onState }: { onState?: (id: string, dirty: boolean, busy: boolean) => void }) {
  const q = useAdminQuery(async () => {
    const r = await supabase().from("app_settings").select("value").eq(
      "key",
      "sources.max_files",
    ).maybeSingle();
    if (r.error) throw r.error;
    return Number(r.data?.value ?? 5);
  });
  const [draft, setDraft] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const dirty = draft !== null && draft !== q.data;
  useEffect(() => {
    onState?.("source-policy", dirty, busy);
    return () => onState?.("source-policy", false, false);
  }, [dirty, busy, onState]);
  async function save() {
    if (busy || draft === null) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await supabase().rpc("admin_source_file_limit", {
        p_max_files: draft,
      });
      if (r.error) throw r.error;
      setMessage("Kaynak sınırı kaydedildi.");
      await q.reload();
      setDraft(null);
    } catch {
      setMessage("Kaydedilemedi. Mevcut sınır korunuyor; tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Dosya, galeri ve kamera kaynakları">
      <p className="mb-3">
        Bir analize eklenecek kaynak sayısı. Varsayılan 5; sunucu en fazla 10
        dosya, toplam 20 sayfa ve 20 MB kabul eder. Her PDF en fazla 5 sayfa
        olabilir.
      </p>
      {q.error
        ? <Notice tone="error">Kaynak sınırı yüklenemedi.</Notice>
        : null}
      <label className="block">
        En fazla kaynak sayısı<select
          className="input mt-2"
          value={draft ?? Number(q.data ?? 5)}
          disabled={busy || !q.data}
          onChange={(e) => setDraft(Number(e.target.value))}
        >
          {Array.from(
            { length: 10 },
            (_, i) => <option key={i + 1} value={i + 1}>{i + 1} kaynak</option>,
          )}
        </select>
      </label>
      <p className="my-3">
        Birlikte analiz tek işlem hakkı kullanır. Prova’nın soru başına kotası
        değişmez. Gerçek AI tüketimi ve paket token sınırı ayrıca uygulanır.
      </p>
      {message ? <p role="status" className="my-3">{message}</p> : null}
      <button
        className="btn"
        disabled={busy || !dirty}
        onClick={() => void save()}
      >
        {busy ? "Kaydediliyor…" : "Sınırı kaydet"}
      </button>
    </Card>
  );
}
