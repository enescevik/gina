import { useUnsavedChanges } from "@/components/unsaved-changes";
import { SourcePolicy } from "@/components/source-policy";
import { AiPolicyMatrixCard, ModelDisablePreviewButton, ProviderChangeImpactCard, featureLabel, useAiPolicyMatrix } from "@/components/ai-policy";
import { adminRpc } from "@/components/review-rpc";
import type { Tables } from "@gina/core";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { fmtDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, isStaleError, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

type AiSetting = Tables<"ai_settings">;
type AiModel = Tables<"ai_models">;

const PLAN_ORDER = ["free", "plus", "pro"];

async function loadAll() {
  const db = supabase();
  const [settings, models, flag] = await Promise.all([
    db.from("ai_settings").select("*"),
    db.from("ai_models").select("*").order("id"),
    db.from("app_settings").select("value").eq("key", "ai.enabled").maybeSingle(),
  ]);
  const rows = unwrap(settings).sort((a, b) => PLAN_ORDER.indexOf(a.plan_code) - PLAN_ORDER.indexOf(b.plan_code));
  // Anahtar yoksa AI açık sayılır (Edge Function'lar da böyle davranır).
  const enabled = unwrap(flag)?.value !== false;
  return { settings: rows, models: unwrap(models), enabled };
}

function SettingEditor({ row, models, onSaved, onState }: { row: AiSetting; models: AiModel[]; onSaved: (msg: string | null, err?: unknown) => void; onState: (id: string, dirty: boolean, busy: boolean) => void }) {
  const [draft, setDraft] = useState(row);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row);
  useEffect(() => { onState(row.plan_code, dirty, busy); return () => onState(row.plan_code, false, false); }, [row.plan_code, dirty, busy, onState]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current || !dirty) return;
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase().from("ai_settings").update({
        model_id: draft.model_id, max_input_tokens: draft.max_input_tokens,
        max_output_tokens: draft.max_output_tokens, prompt_version: draft.prompt_version.trim(), enabled: draft.enabled,
      }).eq("plan_code", row.plan_code).eq("updated_at", row.updated_at).select("plan_code").single();
      if (error) throw error;
      onSaved(t.common.saved);
    } catch (error) { onSaved(null, error); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={e => void save(e)} className="min-w-0 rounded-3xl border border-violet-100 bg-white p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-bold">{t.plans[row.plan_code]}</h3>
      <span className="text-sm">{dirty ? "Kaydedilmemiş değişiklik" : `Son kayıt: ${fmtDateTime(row.updated_at)}`}</span>
    </div>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2"><label htmlFor={`model-${row.plan_code}`}>{t.ai.model}</label>
        <select id={`model-${row.plan_code}`} required={draft.enabled} aria-describedby={`model-hint-${row.plan_code}`} className="input mt-2 w-full" value={draft.model_id ?? ""} onChange={e => setDraft({ ...draft, model_id: e.target.value || null })}>
          <option value="">{t.ai.noModel}</option>
          {models.map(m => <option key={m.id} value={m.id} disabled={!m.active}>{m.display_name}</option>)}
        </select>
        <span id={`model-hint-${row.plan_code}`} className="mt-1 block break-all text-sm text-slate-500">{draft.model_id || t.ai.noModel}</span>
      </div>
      <label>{t.ai.maxInput}<input type="number" required min={1} step={1} className="input mt-2 w-full" value={draft.max_input_tokens} onChange={e => setDraft({ ...draft, max_input_tokens: Number(e.target.value) })} /></label>
      <label>{t.ai.maxOutput}<input type="number" required min={1} step={1} className="input mt-2 w-full" value={draft.max_output_tokens} onChange={e => setDraft({ ...draft, max_output_tokens: Number(e.target.value) })} /></label>
      <label>{t.ai.promptVersion}<input required className="input mt-2 w-full" value={draft.prompt_version} onChange={e => setDraft({ ...draft, prompt_version: e.target.value })} /></label>
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />{t.ai.enabled}</label>
      {dirty && <p className="rounded-2xl bg-violet-50 p-3 text-sm sm:col-span-2">{t.plans[row.plan_code]} paketinin sonraki AI işlemleri bu ayarları kullanacak. Önceden üretilen içerikler değişmez.</p>}
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button className="btn" disabled={!dirty || busy}>{busy ? "Kaydediliyor…" : `${t.plans[row.plan_code]} ayarlarını kaydet`}</button>
        {dirty && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setDraft(row)}>Değişiklikleri geri al</button>}
      </div>
    </fieldset>
  </form>;
}

function ModelForm({ onSaved, onState }: { onSaved: (msg: string | null, err?: unknown) => void; onState: (id: string, dirty: boolean, busy: boolean) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { onState("new-model", !!id || !!name, busy); return () => onState("new-model", false, false); }, [id, name, busy, onState]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase().from("ai_models").insert({ id: id.trim(), display_name: name.trim() || id.trim(), active: false });
      if (error) throw error;
      setId(""); setName(""); onSaved(t.common.saved);
    } catch (error) { onSaved(null, error); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="new-model-id" className="label">{t.ai.modelId}</label>
        <input id="new-model-id" disabled={busy} className="input font-mono" required value={id} onChange={(e) => setId(e.target.value)} placeholder="claude-…" />
      </div>
      <div>
        <label htmlFor="new-model-name" className="label">{t.ai.displayName}</label>
        <input id="new-model-name" disabled={busy} className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Kaydediliyor…" : t.ai.addModel}
      </button>
      <p className="basis-full text-sm">Yeni model önce pasif kaydedilir. Sağlayıcı kimliğini ve gereken görüntü/belge desteğini doğruladıktan sonra etkinleştirin.</p>
    </form>
  );
}

export default function AiPage() {
  const { data, error, reload } = useAdminQuery(loadAll);
  const matrix = useAiPolicyMatrix();
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [edits, setEdits] = useState<Record<string, { dirty: boolean; busy: boolean }>>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const onState = useCallback((id: string, dirty: boolean, busy: boolean) => setEdits(current => ({ ...current, [id]: { dirty, busy } })), []);
  const guard = useUnsavedChanges(Object.values(edits).some(e => e.dirty), busy || Object.values(edits).some(e => e.busy));

  const onSaved = (text: string | null, err?: unknown) => {
    setMsg(err ? { text: errorMessage(err, t.errors), tone: "error" } : { text: text ?? "", tone: "ok" });
    // Eski sürüm çakışmasında (0 satır güncellendi) güncel kayıt yeniden yüklenir; yazılan değer sessizce üstüne yazmaz.
    if (!err || isStaleError(err)) { reload(); matrix.reload(); }
  };

  async function mutate(action: () => PromiseLike<{ error: unknown }>) {
    if (lock.current || Object.values(edits).some(e => e.busy)) return;
    lock.current = true; setBusy(true);
    try { const result = await action(); if (result.error) throw result.error; onSaved(t.common.saved); }
    catch (error) { onSaved(null, error); }
    finally { lock.current = false; setBusy(false); }
  }
  async function setKill(enabled: boolean) {
    if (!enabled && !window.confirm(t.ai.confirmOff)) return;
    await mutate(() => supabase().rpc("admin_set_ai_enabled", { p_enabled: enabled }));
  }
  async function toggleModel(m: AiModel) {
    let affected = data?.settings.filter(s => s.model_id === m.id && s.enabled).map(s => t.plans[s.plan_code]) ?? [];
    let features = "";
    if (m.active) {
      // Sunucu önizlemesi (S06): kapatmanın etkilediği paket ve özellikler; okunamazsa yerel paket listesine düşer.
      try {
        const preview = await adminRpc<{ affected_plans: string[]; affected_features: { feature: string }[]; alternatives: string[] }>("admin_model_disable_preview", { p_model_id: m.id });
        affected = preview.affected_plans.map(p => t.plans[p] ?? p);
        features = ` Etkilenen özellikler: ${preview.affected_features.map(f => featureLabel[f.feature] ?? f.feature).join(", ") || "Yok"}. Alternatif: ${preview.alternatives.join(", ") || "yok"}.`;
      } catch { features = " (Sunucu etki önizlemesi okunamadı.)"; }
    }
    if (m.active && !window.confirm(`${m.display_name} pasifleştirilsin mi? Etkilenen paketler: ${affected.join(", ") || "Yok"}.${features} Bu modelin kullanıldığı yeni işlemler çalışmayabilir.`)) return;
    await mutate(() => supabase().from("ai_models").update({ active: !m.active }).eq("id", m.id));
  }

  return (
    <Layout title={t.ai.title}>
      {guard.dialog}
      {error ? <Notice tone="error">{errorMessage(error, t.errors)}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {!data ? (
        <p className="text-slate-500">{t.common.loading}</p>
      ) : (
        <>
          <Card title={t.ai.killSwitch}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded px-2 py-1 text-sm font-medium ${data.enabled ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {data.enabled ? t.ai.on : t.ai.off}
              </span>
              {data.enabled ? (
                <button className="btn-danger" disabled={busy} onClick={() => void setKill(false)}>
                  {t.ai.turnOff}
                </button>
              ) : (
                <button className="btn" disabled={busy} onClick={() => void setKill(true)}>
                  {t.ai.turnOn}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">{t.ai.killSwitchHelp}</p>
          </Card>

          <SourcePolicy onState={onState} />
          <Card title={t.ai.perPlan}>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {data.settings.map(row => <SettingEditor key={`${row.plan_code}-${row.updated_at}`} row={row} models={data.models} onSaved={onSaved} onState={onState} />)}
            </div>
          </Card>

          <Card title={t.ai.models}>
            <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.ai.modelId}</th>
                  <th>{t.ai.displayName}</th>
                  <th>{t.ai.provider}</th>
                  <th>{t.ai.priceIn}</th>
                  <th>{t.ai.priceOut}</th>
                  <th>{t.ai.active}</th>
                  <th>Etki</th>
                </tr>
              </thead>
              <tbody>
                {data.models.map((m) => (
                  <tr key={m.id}>
                    <td className="font-mono">{m.id}</td>
                    <td>{m.display_name}</td>
                    <td>{m.provider}</td>
                    <td>{m.input_usd_per_mtok ?? t.common.none}</td>
                    <td>{m.output_usd_per_mtok ?? t.common.none}</td>
                    <td>
                      <button className="btn-secondary" disabled={busy} onClick={() => void toggleModel(m)}>
                        {m.active ? t.common.yes : t.common.no}
                      </button>
                    </td>
                    <td className="min-w-[220px]"><ModelDisablePreviewButton modelId={m.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <ModelForm onSaved={onSaved} onState={onState} />
          </Card>
          <AiPolicyMatrixCard matrix={matrix.data} error={matrix.error} />
          {matrix.data ? <ProviderChangeImpactCard providers={matrix.data.providers} /> : null}
        </>
      )}
    </Layout>
  );
}
