import { useState } from "react";
import { t } from "@/lib/i18n";
import { useAdminQuery } from "@/lib/use-async";
import { Card, Notice } from "./Layout";
import { adminRpc } from "./review-rpc";

// S06 işletim yüzü (salt okunur): politika matrisi, model kapatma etki önizlemesi, sağlayıcı değişim etkisi.
// Hiçbir düğme ayar değiştirmez; değişiklik mevcut formlardan ve sunucu koruyucularından geçer.

type Provider = { id: string; display_name: string; adapter: string; key_secret_name: string; data_region: string; cross_border: boolean; cost_class: string; status: string; notes: string | null };
type Model = { id: string; display_name: string; provider: string; active: boolean; adapter: string | null; context_tokens: number | null; supports_vision: boolean; supports_pdf: boolean; supports_json_schema: boolean; contract_version: string | null; support: { supported: boolean; reasons: string[]; unsupported_features: { feature: string; input_kind: string }[] } };
type Feature = { feature: string; input_kind: string; action: string; requires_vision: boolean; requires_pdf: boolean; requires_json_schema: boolean; min_context_tokens: number; plans: string[]; entry_point: string | null };
type PlanPolicy = { action: string; enabled: boolean; monthly_limit: number; per_minute: number; max_concurrent: number; max_media_items: number; max_media_bytes: number };
type PlanRow = { plan_code: string; enabled: boolean; model_id: string | null; max_input_tokens: number; max_output_tokens: number; prompt_version: string; prova_ai_generate_monthly: number | null; setup_ai_monthly: number | null; policies: PlanPolicy[] };
export type PolicyMatrix = { global_enabled: boolean; providers: Provider[]; models: Model[]; features: Feature[]; plans: PlanRow[] };
type DisablePreview = { model_id: string; provider: string; active: boolean; affected_plans: string[]; affected_features: { feature: string; inputs: string[]; plans: string[] }[]; alternatives: string[]; jobs_last_30d: Record<string, number> };
type Impact = {
  from: string; to: string; blocked: boolean; block_reasons: string[];
  affected_features: { feature: string; inputs: string[]; plans: string[] }[];
  feature_gaps: { feature: string; input_kind: string }[];
  new_processor: boolean; consent_update_required: boolean; cross_border_transfer: boolean;
  region_change: { from: string; to: string } | null;
  cost_class: { from: string; to: string; direction: "up" | "down" | "same" };
  key_secret_name: string; candidate_models: string[];
};

export const featureLabel: Record<string, string> = {
  weekly_summary: "Haftalık özet",
  daily_tips: "7 günlük ipucu",
  photo_calendar: "Fotoğraftan takvim",
  document_analysis: "Belge analizi",
  question_generation: "Soru üretimi",
  open_ended_grading: "Açık uçlu puanlama",
  study_plan: "Çalışma planı",
  pre_review: "Ön inceleme (yönetici)",
  setup_suggestions: "Kurulum önerisi",
};
const inputLabel: Record<string, string> = { text: "metin", image: "görsel", pdf: "PDF" };
const actionLabel: Record<string, string> = {
  weekly: "Haftalık özet", import: "Belgeden program", learning_import: "Öğrenme planı belgesi", generate: "Soru üretimi",
  grade: "Değerlendirme", plan: "Çalışma planı", setup: "Kurulum önerisi", preflight: "Ön inceleme",
};
const reasonLabel: Record<string, string> = {
  adapter_missing: "adapter tanımlı değil",
  contract_missing: "sözleşme testi sürümü yok",
  capabilities_missing: "yetenek beyanı yok",
  provider_unknown: "sağlayıcı kaydı yok",
  provider_unconfigured: "sağlayıcı yapılandırılmadı (anahtar yok)",
  provider_unsupported: "sağlayıcı desteklenmiyor",
  adapter_mismatch: "adapter sağlayıcıyla uyuşmuyor",
  same_provider: "aynı sağlayıcı seçildi",
  no_supported_model: "hedefte desteklenen etkin model yok",
};
const plans = (ps: string[]) => (ps.length ? ps.map((p) => t.plans[p] ?? p).join(", ") : "paket dışı");
const mb = (b: number) => (b ? `${Math.round(b / 1048576)} MB` : "—");

export function useAiPolicyMatrix() {
  return useAdminQuery(() => adminRpc<PolicyMatrix>("admin_ai_policy_matrix"));
}

export function AiPolicyMatrixCard({ matrix, error }: { matrix: PolicyMatrix | null; error: unknown }) {
  return (
    <Card title="Politika matrisi (salt okunur)">
      <p className="mb-3 max-w-3xl text-sm text-slate-600">
        Paket × işlem sınırları, token ve model ayarları, özelliklerin istediği yetenekler ve model desteği tek yerde. Değerler farklı
        tablolardan okunur; değiştirmek için ilgili formu kullanın.
      </p>
      {error ? <Notice tone="error">Politika matrisi okunamadı.</Notice> : null}
      {!matrix ? (!error ? <p className="text-slate-500">{t.common.loading}</p> : null) : (
        <div className="grid gap-6" data-testid="ai-policy-matrix">
          <p className="text-sm font-semibold">Genel AI anahtarı: {matrix.global_enabled ? t.ai.on : t.ai.off}</p>
          <div className="overflow-x-auto">
            <table className="table" aria-label="Paket ve işlem sınırları">
              <thead>
                <tr><th>Paket</th><th>İşlem</th><th>Durum</th><th>Aylık</th><th>Dakikada</th><th>Aynı anda</th><th>Medya</th><th>Model · token</th></tr>
              </thead>
              <tbody>
                {matrix.plans.flatMap((p) =>
                  (p.policies.length ? p.policies : [null]).map((o, i) => (
                    <tr key={p.plan_code + (o?.action ?? "none")}>
                      {i === 0 ? <td rowSpan={Math.max(p.policies.length, 1)} className="font-bold">{t.plans[p.plan_code] ?? p.plan_code}{p.enabled ? "" : " · AI kapalı"}</td> : null}
                      <td>{o ? actionLabel[o.action] ?? o.action : "—"}</td>
                      <td>{o ? (o.enabled ? "Açık" : "Kapalı") : "—"}</td>
                      <td>{o?.monthly_limit ?? "—"}</td>
                      <td>{o?.per_minute ?? "—"}</td>
                      <td>{o?.max_concurrent ?? "—"}</td>
                      <td>{o && o.max_media_items ? `${o.max_media_items} dosya · ${mb(o.max_media_bytes)}` : "—"}</td>
                      {i === 0
                        ? (
                          <td rowSpan={Math.max(p.policies.length, 1)} className="text-xs">
                            <span className="font-mono">{p.model_id ?? t.ai.noModel}</span>
                            <br />girdi {p.max_input_tokens} · çıktı {p.max_output_tokens} · {p.prompt_version}
                            <br />soru üretimi/ay {p.prova_ai_generate_monthly ?? "—"} · kurulum/ay {p.setup_ai_monthly ?? "—"}
                          </td>
                        )
                        : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="table" aria-label="Özellik ve yetenek gereksinimleri">
              <thead>
                <tr><th>Özellik</th><th>Girdi</th><th>Gereken yetenek</th><th>Paket</th><th>Uç nokta</th></tr>
              </thead>
              <tbody>
                {matrix.features.map((f) => (
                  <tr key={f.feature + f.input_kind}>
                    <td>{featureLabel[f.feature] ?? f.feature}</td>
                    <td>{inputLabel[f.input_kind] ?? f.input_kind}</td>
                    <td>
                      {[f.requires_vision && "görsel", f.requires_pdf && "PDF", f.requires_json_schema && "JSON şema"].filter(Boolean).join(" · ") || "—"}
                      {` · bağlam ≥ ${(f.min_context_tokens / 1000).toLocaleString("tr-TR")}k`}
                    </td>
                    <td>{plans(f.plans)}</td>
                    <td className="font-mono text-xs">{f.entry_point ?? "ayrı uç nokta yok"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="table" aria-label="Model desteği">
              <thead>
                <tr><th>Model</th><th>Sağlayıcı</th><th>Etkin</th><th>Destek</th></tr>
              </thead>
              <tbody>
                {matrix.models.map((m) => (
                  <tr key={m.id}>
                    <td><span className="font-mono">{m.id}</span><div className="text-xs">{m.display_name}</div></td>
                    <td>{m.provider}</td>
                    <td>{m.active ? t.common.yes : t.common.no}</td>
                    <td>
                      {m.support.supported
                        ? <span className="text-emerald-800">Destekleniyor{m.support.unsupported_features.length ? ` · ${m.support.unsupported_features.length} özellik/girdi karşılanmıyor` : ""}</span>
                        : <span className="text-red-800">Desteklenmiyor: {m.support.reasons.map((r) => reasonLabel[r] ?? r).join(", ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Model kapatmadan önce sunucudan etki önizlemesi; kapatma kararını değiştirmez. */
export function ModelDisablePreviewButton({ modelId }: { modelId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ data: DisablePreview | null; error: boolean }>({ data: null, error: false });
  async function load() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setState({ data: null, error: false });
    try {
      setState({ data: await adminRpc<DisablePreview>("admin_model_disable_preview", { p_model_id: modelId }), error: false });
    } catch {
      setState({ data: null, error: true });
    }
  }
  const d = state.data;
  return (
    <div className="grid gap-2">
      <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => void load()}>Kapatma etkisi</button>
      {open
        ? state.error
          ? <p className="text-xs text-red-800">Etki önizlemesi okunamadı.</p>
          : !d
          ? <p className="text-xs text-slate-500">{t.common.loading}</p>
          : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950" data-testid="model-disable-preview">
              <p className="font-bold">Etkilenen paketler: {d.affected_plans.length ? plans(d.affected_plans) : "yok"}</p>
              {d.affected_features.length
                ? <ul className="list-disc pl-4">{d.affected_features.map((f) => <li key={f.feature}>{featureLabel[f.feature] ?? f.feature} ({f.inputs.map((i) => inputLabel[i] ?? i).join(", ")}) · {plans(f.plans)}</li>)}</ul>
                : <p>Etkilenen özellik yok.</p>}
              <p>Aynı sağlayıcıda desteklenen alternatif: {d.alternatives.length ? d.alternatives.join(", ") : "yok"}</p>
              <p>Son 30 gün iş hacmi: {Object.entries(d.jobs_last_30d).map(([a, n]) => `${actionLabel[a] ?? a} ${n}`).join(" · ") || "yok"}</p>
            </div>
          )
        : null}
    </div>
  );
}

export function ProviderChangeImpactCard({ providers }: { providers: Provider[] }) {
  const [from, setFrom] = useState(providers[0]?.id ?? "");
  const [to, setTo] = useState(providers[1]?.id ?? providers[0]?.id ?? "");
  const [state, setState] = useState<{ data: Impact | null; error: boolean; busy: boolean }>({ data: null, error: false, busy: false });
  async function run() {
    setState({ data: null, error: false, busy: true });
    try {
      setState({ data: await adminRpc<Impact>("admin_provider_change_impact", { p_from: from, p_to: to }), error: false, busy: false });
    } catch {
      setState({ data: null, error: true, busy: false });
    }
  }
  const d = state.data;
  return (
    <Card title="Sağlayıcı değişim etkisi">
      <p className="mb-3 max-w-3xl text-sm text-slate-600">
        Bir sağlayıcıdan diğerine geçmenin gizlilik, izin, maliyet ve özellik etkisini gösterir. Hiçbir ayar değişmez; anahtarlar burada
        yalnız adıyla görünür.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="label mb-0">Mevcut sağlayıcı
          <select className="input mt-2" value={from} onChange={(e) => setFrom(e.target.value)}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </label>
        <label className="label mb-0">Hedef sağlayıcı
          <select className="input mt-2" value={to} onChange={(e) => setTo(e.target.value)}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.display_name} · {p.status === "active" ? "etkin" : p.status === "unconfigured" ? "yapılandırılmadı" : "desteklenmiyor"}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary" disabled={state.busy || !from || !to} onClick={() => void run()}>Etkiyi hesapla</button>
      </div>
      {state.error ? <Notice tone="error">Etki hesaplanamadı.</Notice> : null}
      {d
        ? (
          <div className="grid gap-2 text-sm" data-testid="provider-change-impact">
            <p className={`rounded-xl px-3 py-2 font-bold ${d.blocked ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
              {d.blocked ? `Geçiş şu an mümkün değil: ${d.block_reasons.map((r) => reasonLabel[r] ?? r).join(", ")}` : "Geçiş teknik olarak mümkün; aşağıdaki etkileri onaylayın."}
            </p>
            <p>Etkilenen özellikler: {d.affected_features.length ? d.affected_features.map((f) => `${featureLabel[f.feature] ?? f.feature} (${plans(f.plans)})`).join(", ") : "yok"}</p>
            <p>Hedefte karşılanamayan özellik/girdi: {d.feature_gaps.length ? d.feature_gaps.map((g) => `${featureLabel[g.feature] ?? g.feature} · ${inputLabel[g.input_kind] ?? g.input_kind}`).join(", ") : "yok"}</p>
            <p>
              Yeni veri işleyen: {d.new_processor ? "evet" : "hayır"} · Aile izin metni güncellemesi: {d.consent_update_required ? "gerekli" : "gerekmez"} ·
              Yurt dışı aktarım: {d.cross_border_transfer ? "var" : "yok"}
              {d.region_change ? ` · Bölge: ${d.region_change.from} → ${d.region_change.to}` : ""}
            </p>
            <p>
              Maliyet sınıfı: {d.cost_class.from} → {d.cost_class.to} ({d.cost_class.direction === "up" ? "artar" : d.cost_class.direction === "down" ? "azalır" : "aynı"}) ·
              Gerekli anahtar adı: <code>{d.key_secret_name}</code> · Aday model: {d.candidate_models.length ? d.candidate_models.join(", ") : "yok"}
            </p>
          </div>
        )
        : null}
    </Card>
  );
}
