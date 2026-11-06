import { useEffect, useRef, useState } from 'react';
import type { Tables } from '@gina/core';
import { Card } from './Layout';
import { adminRpc } from './review-rpc';
import { useAdminQuery } from '@/lib/use-async';
import { errorMessage } from '@/lib/supabase';

type Step = { model_id: string; display_name: string; position: number; active: boolean };
type Chain = { id: string; name: string; enabled: boolean; on_rate_limit: boolean; on_server_error: boolean; on_timeout: boolean; attempt_seconds: number; total_seconds: number; updated_at: string; steps: Step[] };
type Assignment = { usage_key: string; label: string; chain_id: string | null; updated_at: string | null };
type Inventory = { enabled: boolean; chains: Chain[]; assignments: Assignment[]; attempts: { id: string; usage_key: string; model_id: string; provider: string; position: number; status: string; error_code: string | null; created_at: string }[] };
const load = () => adminRpc<Inventory>('admin_ai_chains');
const blank: Chain = { id: '', name: '', enabled: true, on_rate_limit: true, on_server_error: true, on_timeout: false, attempt_seconds: 45, total_seconds: 120, updated_at: '', steps: [] };
export function AiChains({ models, onState }: { models: Tables<'ai_models'>[]; onState: (id: string, dirty: boolean, busy: boolean) => void }) {
  const query = useAdminQuery(load);
  const [draft, setDraft] = useState<Chain | null>(null);
  const [baseline, setBaseline] = useState<Chain | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEffect(() => { onState('ai-chains', dirty, busy); return () => onState('ai-chains', false, false); }, [dirty, busy, onState]);
  async function mutate(fn: () => Promise<unknown>, close = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await fn(); if (close) { setDraft(null); setBaseline(null); } query.reload(); setMessage('Kaydedildi. Sonraki işlemler yeni ayarları kullanacak.'); }
    catch (e) { setMessage(errorMessage(e, { inactive_chain_model: "Pasif model yeni adım olarak eklenemez.", chain_has_no_active_model: "En az bir aktif ve desteklenen model gerekli.", invalid_chain: "Zincir adını ve adımları kontrol edin." })); }
    finally { lock.current = false; setBusy(false); }
  }
  function edit(c: Chain) { setDraft(c); setBaseline(c); }
  const data = query.data;
  return <Card title="İş türüne göre AI zincirleri">
    <p className="mb-3 text-sm text-slate-600">Sırayla deneyerek ilk başarılı yanıtta durur. Paket kotası ve AI kapatma ayarları korunur. Pasif veya girdiye uygun olmayan adımlar atlanır; yeni seçimlerde gösterilmez.</p>
    {!!query.error && <p role="alert">Zincirler okunamadı. {errorMessage(query.error, {})}</p>}
    {message && <p role="status" className="mb-3 rounded-xl bg-violet-50 p-3">{message}</p>}
    {data && <>
      <p className="mb-4 font-medium">Çalışma durumu: {data.enabled ? 'Zincirler etkin' : 'Zincirler henüz etkin değil; mevcut paket modeli kullanılıyor'}</p>
      <div className="grid gap-3 md:grid-cols-2">{data.assignments.map(a => <label key={a.usage_key} className="rounded-xl border p-3">{a.label}
        <select className="input mt-2 w-full" disabled={busy || dirty} value={a.chain_id ?? ''} onChange={e => { const id = e.target.value; if (id) void mutate(() => adminRpc('admin_assign_ai_chain', { p_usage_key: a.usage_key, p_chain_id: id, p_expected_updated_at: a.updated_at })); }}>
          <option value="" disabled>Zincir seçin</option>
          {data.chains.filter(c => c.enabled && c.steps.some(s => models.some(m => m.id === s.model_id && m.active)) || c.id === a.chain_id).map(c => <option key={c.id} value={c.id} disabled={!c.enabled || !c.steps.some(s => models.some(m => m.id === s.model_id && m.active))}>{c.name}{!c.enabled ? ' · kapalı' : ''}</option>)}
        </select>
      </label>)}</div>
      <div className="my-4 space-y-3">{data.chains.map(c => <div key={c.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap justify-between gap-2"><strong>{c.name}{!c.enabled && ' · Kapalı'}</strong><button className="btn-secondary" disabled={busy || dirty} onClick={() => edit(c)}>Düzenle</button></div>
        <ol className="mt-2 space-y-1">{c.steps.map(s => { const active = models.find(m => m.id === s.model_id)?.active === true; return <li key={s.model_id} className={active ? '' : 'text-amber-800'}>{s.position}. {s.display_name} {!active && <strong>· Pasif — atlanır</strong>}</li>; })}</ol>
        {!c.steps.some(s => models.some(m => m.id === s.model_id && m.active)) && <p role="alert" className="mt-2 text-red-700">Aktif adım yok. Bu zincire bağlı işler çalışamaz.</p>}
        <p className="mt-2 text-sm text-slate-500">Kota: {c.on_rate_limit ? 'sonraki model' : 'dur'} · Sunucu hatası: {c.on_server_error ? 'sonraki model' : 'dur'} · Süre aşımı: {c.on_timeout ? 'sonraki model' : 'dur'}</p>
      </div>)}</div>
      <div className="flex gap-3"><button className="btn-secondary" disabled={busy || dirty} onClick={() => edit({ ...blank, steps: [] })}>Yeni zincir</button><button className="btn-secondary" disabled={busy || dirty} onClick={query.reload}>Zincirleri ve denemeleri yenile</button></div>
      {draft && <form className="mt-4 rounded-2xl border border-violet-200 p-4" onSubmit={e => { e.preventDefault(); void mutate(() => adminRpc('admin_save_ai_chain', { p_id: draft.id || null, p_name: draft.name, p_models: draft.steps.map(s => s.model_id), p_enabled: draft.enabled, p_on_rate_limit: draft.on_rate_limit, p_on_server_error: draft.on_server_error, p_on_timeout: draft.on_timeout, p_attempt_seconds: draft.attempt_seconds, p_total_seconds: draft.total_seconds, p_expected_updated_at: draft.updated_at || null }), true); }}>
        <fieldset disabled={busy} className="space-y-3">
          <label className="block">Zincir adı<input required maxLength={100} className="input mt-1 w-full" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <ol className="space-y-2">{draft.steps.map((s, i) => <li key={s.model_id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
            <span className="mr-auto">{i + 1}. {s.display_name} {!models.find(m => m.id === s.model_id)?.active && <strong className="text-amber-800">· Pasif — atlanır</strong>}</span>
            <button type="button" className="btn-secondary" disabled={i === 0} aria-label={`${s.display_name} yukarı`} onClick={() => { const steps = [...draft.steps]; [steps[i - 1], steps[i]] = [steps[i]!, steps[i - 1]!]; setDraft({ ...draft, steps }); }}>↑</button>
            <button type="button" className="btn-secondary" disabled={i === draft.steps.length - 1} aria-label={`${s.display_name} aşağı`} onClick={() => { const steps = [...draft.steps]; [steps[i + 1], steps[i]] = [steps[i]!, steps[i + 1]!]; setDraft({ ...draft, steps }); }}>↓</button>
            <button type="button" className="btn-secondary" onClick={() => setDraft({ ...draft, steps: draft.steps.filter(x => x.model_id !== s.model_id) })}>Kaldır</button>
          </li>)}</ol>
          <label className="block">Adım ekle (en fazla 5)<select className="input mt-1 w-full" value="" disabled={draft.steps.length >= 5 || busy} onChange={e => { const m = models.find(x => x.id === e.target.value); if (m) setDraft({ ...draft, steps: [...draft.steps, { model_id: m.id, display_name: m.display_name, position: draft.steps.length + 1, active: true }] }); }}>
            <option value="">Aktif model seçin</option>{models.filter(m => m.active && m.adapter && m.contract_version && !draft.steps.some(s => s.model_id === m.id)).map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select></label>
          {(['enabled', 'on_rate_limit', 'on_server_error', 'on_timeout'] as const).map((key, i) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.checked })} />{['Zincir etkin', 'Sağlayıcı kotası / 429 → sonraki model', 'Sunucu hatası / 5xx → sonraki model', 'Zaman aşımı / bağlantı hatası → sonraki model'][i]}</label>)}
          <p className="text-sm text-amber-800">5xx, bağlantı kaybı veya zaman aşımında önceki sağlayıcı ücret kesmiş olabilir. Başarılı, reddedilmiş veya bozuk çıktılar tekrar ürettirilmez.</p>
          <div className="flex flex-wrap gap-3"><label>Adım süresi (sn)<input type="number" min={10} max={90} required className="input block" value={draft.attempt_seconds} onChange={e => setDraft({ ...draft, attempt_seconds: Number(e.target.value) })} /></label><label>Toplam süre (sn)<input type="number" min={Math.max(30, draft.attempt_seconds)} max={130} required className="input block" value={draft.total_seconds} onChange={e => setDraft({ ...draft, total_seconds: Number(e.target.value) })} /></label></div>
          <button className="btn" disabled={busy || !draft.steps.length || !dirty}>Zinciri kaydet</button>{' '}<button type="button" className="btn-secondary" onClick={() => { setDraft(null); setBaseline(null); }}>Vazgeç</button>
        </fieldset>
      </form>}
      <details className="mt-5"><summary className="cursor-pointer font-semibold">Son 50 zincir adımı</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Zaman', 'İş türü', 'Adım / model', 'Sonuç'].map(x => <th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{data.attempts.map(a => <tr key={a.id}><td className="p-2">{new Date(a.created_at).toLocaleString('tr-TR')}</td><td className="p-2">{data.assignments.find(x => x.usage_key === a.usage_key)?.label ?? a.usage_key}</td><td className="p-2">{a.position}. {a.model_id}</td><td className="p-2">{({ running: 'Çalışıyor', succeeded: 'Başarılı', failed: 'Hata', skipped: 'Atlandı' } as Record<string, string>)[a.status]} {a.error_code}</td></tr>)}</tbody></table>{!data.attempts.length && <p>Henüz zincir çalıştırılmadı.</p>}</div></details>
    </>}
  </Card>;
}
