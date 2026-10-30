import type { Tables } from "@gina/core";
import { useState, type FormEvent } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { fmtDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
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

function SettingRow({ row, models, onSaved }: { row: AiSetting; models: AiModel[]; onSaved: (msg: string | null, err?: unknown) => void }) {
  const [draft, setDraft] = useState(row);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row);

  async function save() {
    const { error } = await supabase()
      .from("ai_settings")
      .update({
        model_id: draft.model_id,
        max_input_tokens: draft.max_input_tokens,
        max_output_tokens: draft.max_output_tokens,
        prompt_version: draft.prompt_version.trim(),
        enabled: draft.enabled,
      })
      .eq("plan_code", row.plan_code);
    onSaved(error ? null : t.common.saved, error ?? undefined);
  }

  return (
    <tr>
      <td className="font-medium">{t.plans[row.plan_code]}</td>
      <td>
        <select className="input" value={draft.model_id ?? ""} onChange={(e) => setDraft({ ...draft, model_id: e.target.value || null })}>
          <option value="">{t.ai.noModel}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.active}>
              {m.display_name} ({m.id})
            </option>
          ))}
        </select>
      </td>
      <td>
        <input type="number" min={1} className="input w-28" value={draft.max_input_tokens}
          onChange={(e) => setDraft({ ...draft, max_input_tokens: Number(e.target.value) })} />
      </td>
      <td>
        <input type="number" min={1} className="input w-28" value={draft.max_output_tokens}
          onChange={(e) => setDraft({ ...draft, max_output_tokens: Number(e.target.value) })} />
      </td>
      <td>
        <input className="input w-24" value={draft.prompt_version} onChange={(e) => setDraft({ ...draft, prompt_version: e.target.value })} />
      </td>
      <td className="text-center">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
      </td>
      <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(row.updated_at)}</td>
      <td>
        <button className="btn" disabled={!dirty} onClick={() => void save()}>
          {t.common.save}
        </button>
      </td>
    </tr>
  );
}

function ModelForm({ onSaved }: { onSaved: (msg: string | null, err?: unknown) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase().from("ai_models").insert({ id: id.trim(), display_name: name.trim() || id.trim() });
    if (!error) {
      setId("");
      setName("");
    }
    onSaved(error ? null : t.common.saved, error ?? undefined);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-2">
      <div>
        <label className="label">{t.ai.modelId}</label>
        <input className="input font-mono" required value={id} onChange={(e) => setId(e.target.value)} placeholder="claude-…" />
      </div>
      <div>
        <label className="label">{t.ai.displayName}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="btn" type="submit">
        {t.ai.addModel}
      </button>
    </form>
  );
}

export default function AiPage() {
  const { data, error, reload } = useAdminQuery(loadAll);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const onSaved = (text: string | null, err?: unknown) => {
    setMsg(err ? { text: errorMessage(err, t.errors), tone: "error" } : { text: text ?? "", tone: "ok" });
    reload();
  };

  async function setKill(enabled: boolean) {
    if (!enabled && !window.confirm(t.ai.confirmOff)) return;
    const { error: err } = await supabase().rpc("admin_set_ai_enabled", { p_enabled: enabled });
    onSaved(t.common.saved, err ?? undefined);
  }

  async function toggleModel(m: AiModel) {
    const { error: err } = await supabase().from("ai_models").update({ active: !m.active }).eq("id", m.id);
    onSaved(t.common.saved, err ?? undefined);
  }

  return (
    <Layout title={t.ai.title}>
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
                <button className="btn-danger" onClick={() => void setKill(false)}>
                  {t.ai.turnOff}
                </button>
              ) : (
                <button className="btn" onClick={() => void setKill(true)}>
                  {t.ai.turnOn}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">{t.ai.killSwitchHelp}</p>
          </Card>

          <Card title={t.ai.perPlan}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.ai.plan}</th>
                    <th>{t.ai.model}</th>
                    <th>{t.ai.maxInput}</th>
                    <th>{t.ai.maxOutput}</th>
                    <th>{t.ai.promptVersion}</th>
                    <th>{t.ai.enabled}</th>
                    <th>{t.ai.updatedAt}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.settings.map((row) => (
                    <SettingRow key={`${row.plan_code}-${row.updated_at}`} row={row} models={data.models} onSaved={onSaved} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={t.ai.models}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t.ai.modelId}</th>
                  <th>{t.ai.displayName}</th>
                  <th>{t.ai.provider}</th>
                  <th>{t.ai.priceIn}</th>
                  <th>{t.ai.priceOut}</th>
                  <th>{t.ai.active}</th>
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
                      <button className="btn-secondary" onClick={() => void toggleModel(m)}>
                        {m.active ? t.common.yes : t.common.no}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ModelForm onSaved={onSaved} />
          </Card>
        </>
      )}
    </Layout>
  );
}
