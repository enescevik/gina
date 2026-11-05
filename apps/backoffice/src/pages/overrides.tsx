import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { overrideCommandSchema, type OverrideCommand, type OverridePayload } from "@gina/core";
import { useAuth } from "@/lib/auth";
import { overrideQueue, sendOverride } from "@/lib/override-command";

import { Card, Layout, Notice } from "@/components/Layout";
import { fmtDateTime, inputDaysFromNow, localInputToIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

type PaidPlan = "plus" | "pro";

function statusOf(o: { revoked_at: string | null; starts_at: string; ends_at: string }) {
  const now = Date.now();
  if (o.revoked_at) return { label: t.overrides.statusRevoked, cls: "bg-slate-100 text-slate-600", expirable: false };
  if (new Date(o.ends_at).getTime() <= now) return { label: t.overrides.statusExpired, cls: "bg-slate-100 text-slate-600", expirable: false };
  if (new Date(o.starts_at).getTime() > now) return { label: t.overrides.statusScheduled, cls: "bg-amber-100 text-amber-800", expirable: true };
  return { label: t.overrides.statusActive, cls: "bg-emerald-100 text-emerald-800", expirable: true };
}

type FamilyMatch = { id: string; name: string; plan: string; plan_source: string; plan_expires_at: string | null; child_count: number };
const DURATIONS = [[30, "30 gün"], [90, "90 gün"], [180, "6 ay"], [365, "1 yıl"]] as const;
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function GrantForm({ initialFamily, locked, onSave }: { initialFamily: string; locked: boolean; onSave: (payload: OverridePayload) => Promise<boolean> }) {
  const [familyId, setFamilyId] = useState(initialFamily);
  const [familyQuery, setFamilyQuery] = useState("");
  const [matches, setMatches] = useState<FamilyMatch[]>([]);
  // Sunucudan doğrulanmış aileler; yalnız bunlardan biri seçiliyken hak verilebilir (yanlış aile onaydan önce görünür).
  const [verified, setVerified] = useState<Record<string, FamilyMatch>>({});
  const [plan, setPlan] = useState<PaidPlan>("plus");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState(inputDaysFromNow(90));
  const [searchError, setSearchError] = useState("");
  const [checking, setChecking] = useState(false);
  const lookupSeq = useRef(0);

  // `byId`: elle yazılan kimliğin sessiz doğrulaması; arama sonuç listesini değiştirmez.
  const lookup = useCallback(async (query: string, byId = false) => {
    const seq = ++lookupSeq.current;
    setSearchError("");
    setChecking(true);
    try {
      const { data, error } = await supabase().rpc("admin_search_families", { p_query: query.trim(), p_limit: 10 }).abortSignal(AbortSignal.timeout(15000));
      if (error) throw error;
      if (seq !== lookupSeq.current) return;
      const rows: FamilyMatch[] = (data ?? []).map((f) => ({ id: f.id, name: f.name, plan: f.plan, plan_source: f.plan_source, plan_expires_at: f.plan_expires_at, child_count: f.child_count }));
      if (!byId) setMatches(rows);
      setVerified((v) => ({ ...v, ...Object.fromEntries(rows.map((r) => [r.id, r])) }));
      if (!rows.length && !byId) setSearchError("Bu aramayla eşleşen aile bulunamadı.");
    } catch {
      if (seq === lookupSeq.current) setSearchError("Aileler yüklenemedi. Aramayı yeniden deneyin.");
    } finally {
      if (seq === lookupSeq.current) setChecking(false);
    }
  }, []);
  // Kimlik elle veya bağlantıyla geldiğinde aile adı ve paketi sunucudan doğrulanır.
  useEffect(() => {
    const id = familyId.trim();
    if (!uuidLike.test(id) || verified[id]) return;
    const timer = setTimeout(() => void lookup(id, true), 250);
    return () => clearTimeout(timer);
  }, [familyId, verified, lookup]);
  const selected = verified[familyId.trim()] ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked || !selected) return;
    try {
      const saved = await onSave({action:"grant",family_id:selected.id,plan,reason:reason.trim(),starts_at:new Date().toISOString(),ends_at:localInputToIso(endsAt)});
      if (saved) setReason("");
    } catch { setSearchError("Bitiş tarihini kontrol edin."); }
  }
  const sourceLabel = (s: string) => t.families.sources[s] ?? s;

  return (
    <Card title={t.overrides.grant}>
      <p className="mb-4 text-slate-600">Aileye süreli Plus veya Pro erişimi verin. Bu işlem mağaza aboneliği oluşturmaz ve ücret tahsil etmez.</p>
      {searchError ? <Notice>{searchError}</Notice> : null}
      <fieldset disabled={locked} className="min-w-0 border-0 p-0">
      <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (familyQuery.trim()) void lookup(familyQuery); }}>
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="family-search">{t.overrides.family}</label>
          <input id="family-search" className="input" value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} placeholder={t.families.placeholder} />
        </div>
        <button className="btn-secondary" type="submit" disabled={checking}>
          {checking ? "Aranıyor…" : t.common.search}
        </button>
      </form>
      {matches.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Eşleşen aileler">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" aria-pressed={m.id === familyId} className={`btn-secondary ${m.id === familyId ? "border-brand bg-brand-light" : ""}`} onClick={() => setFamilyId(m.id)}>
                {m.name} · {t.plans[m.plan] ?? m.plan}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="family-id">{t.overrides.familyId}</label>
          <input id="family-id" className="input font-mono" required value={familyId} onChange={(e) => setFamilyId(e.target.value)} aria-describedby="family-summary" />
          {!familyId ? <p className="mt-1 text-xs text-slate-500">{t.overrides.pickFamily}</p> : null}
        </div>
        <div className="md:col-span-2 xl:col-span-4" id="family-summary" aria-live="polite">
          {selected ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="text-base font-bold">Seçilen aile: {selected.name}</p>
              <p className="mt-1">Şu an: {t.plans[selected.plan] ?? selected.plan} · {sourceLabel(selected.plan_source)}{selected.plan_expires_at ? ` · ${fmtDateTime(selected.plan_expires_at)} tarihine kadar` : ""} · {selected.child_count} çocuk</p>
              <p className="mt-1">Bu işlemden sonra: <strong>{t.plans[plan]}</strong> geçici hakkı · {fmtDateTime(localInputToIso(endsAt))} tarihine kadar. Etkin paket, ailenin geçerli haklarının en yükseğine göre belirlenir.</p>
              {selected.plan_source === "store" ? <p className="mt-1">Ailenin mağaza aboneliği var: geçici hak mağaza kaydını değiştirmez, iade veya iptal yapmaz.</p> : null}
            </div>
          ) : familyId.trim() ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {checking ? "Aile bilgisi doğrulanıyor…" : uuidLike.test(familyId.trim()) ? "Bu kimlikle aile bulunamadı. Aramadan bir aile seçin." : "Aile kimliği biçimi geçersiz. Aramadan bir aile seçin."}
            </p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="override-plan">{t.overrides.plan}</label>
          <select id="override-plan" className="input" value={plan} onChange={(e) => setPlan(e.target.value as PaidPlan)}>
            <option value="plus">{t.plans.plus}</option>
            <option value="pro">{t.plans.pro}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="override-end">{t.overrides.endsAt}</label>
          <input id="override-end" type="datetime-local" className="input" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Hazır süreler">
            {DURATIONS.map(([days, label]) => (
              <button key={days} type="button" className="btn-secondary !min-h-11 !px-3 !py-2" onClick={() => setEndsAt(inputDaysFromNow(days))}>{label}</button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <label className="label" htmlFor="override-reason">{t.overrides.reason}</label>
          <input id="override-reason" className="input" required minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.overrides.reasonPlaceholder} />
        </div>
        <div className="flex items-end">
          <button className="btn w-full" type="submit" disabled={locked || !selected}>
            {t.overrides.grant}
          </button>
        </div>
      </form>
      </fieldset>
    </Card>
  );
}

export default function OverridesPage() {
  const { session } = useAuth();
  const user = session?.user.id ?? "";
  return <OverridesEditor key={user} user={user} />;
}
function OverridesEditor({ user }: { user:string }) {
  const router = useRouter();
  const initialFamily = typeof router.query.family === "string" ? router.query.family : "";
  const [showInactive, setShowInactive] = useState(true);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const list = useAdminQuery(
    async () => unwrap(await supabase().rpc("admin_list_overrides", { p_include_inactive: showInactive })),
    [showInactive],
  );
  const audit = useAdminQuery(async () =>
    unwrap(
      await supabase()
        .from("audit_log")
        .select("id, action, actor_id, target_id, family_id, reason, created_at")
        .eq("target_table", "entitlement_overrides")
        .order("created_at", { ascending: false })
        .limit(30),
    ),
  );

  const queue = useMemo(() => overrideQueue(user), [user]);
  const [pending,setPending] = useState<OverrideCommand|null>(null);
  const [restoring,setRestoring] = useState(true);
  const [storageError,setStorageError] = useState(false);
  const [busy,setBusy] = useState(false);
  const [revoking,setRevoking] = useState<{id:string;family:string;plan:string}|null>(null);
  const [revokeReason,setRevokeReason] = useState("");
  const gate=useRef(false);
  useEffect(()=>{
    if (!user) return;
    let live=true;
    void queue.restore().then(c=>{if(live)setPending(c);}).catch(()=>{if(live)setStorageError(true);}).finally(()=>{if(live)setRestoring(false);});
    return ()=>{live=false;};
  },[queue,user]);
  const locked = busy || restoring || storageError || !!pending;
  async function save(payload?:OverridePayload):Promise<boolean> {
    if(gate.current || restoring || storageError || !user) return false;
    gate.current=true;setBusy(true);setMsg(null);
    let command=pending;
    try {
      if(!command) {
        command=overrideCommandSchema.parse({request:crypto.randomUUID(),payload});
        await queue.prepare(command);
        setPending(command);
      }
      await sendOverride(command);
      await queue.acknowledge(command.request);
      setPending(null);setRevoking(null);setRevokeReason("");
      setMsg({tone:"ok",text:command.payload.action==="grant" ? "Paket hakkı kaydedildi." : "Geçici paket hakkı sonlandırıldı. Mağaza aboneliği değiştirilmedi."});
      list.reload();audit.reload();return true;
    } catch(error) {
      const e=error as {code?:string;message?:string};
      // Only a definitive SQL rejection can discard a persisted command.
      // Timeouts, transport failures and malformed receipts remain retryable.
      if(command && /^(P0001|42501|22\w{3}|23\w{3})$/.test(e.code??"")) {
        try {await queue.acknowledge(command.request);setPending(null);}
        catch {setStorageError(true);}
        setMsg({tone:"error",text:e.message==="request_conflict" ? "Bu işlem kimliği başka bir kayıtla eşleşiyor. Güncel kayıtları kontrol edin." : e.message==="override_not_found_or_revoked" ? "Bu hak başka bir yönetici tarafından sonlandırılmış veya kaldırılmış. Liste yenilendi." : errorMessage(error,t.errors)});
        list.reload();audit.reload();
      } else if(e.message?.startsWith("library_")) {
        setStorageError(true);setMsg({tone:"error",text:"İşlem cihazda güvenli biçimde saklanamadı. Sayfayı yenileyip bekleyen kaydı kontrol edin."});
      } else {
        setMsg({tone:"error",text:command ? "Kayıt sonucu henüz doğrulanamadı. Aşağıdaki aynı işlemi yeniden kontrol edin; ikinci bir hak oluşturulmaz." : "Aile, gerekçe ve bitiş tarihini kontrol edin."});
      }
      return false;
    } finally {gate.current=false;setBusy(false);}
  }

  return (
    <Layout title={t.overrides.title}>
      <p className="mb-4 text-sm text-slate-500">{t.overrides.help}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {restoring ? <Notice>Bekleyen işlemler kontrol ediliyor…</Notice> : null}
      {storageError ? <Notice tone="error">Güvenli kayıt alanına erişilemiyor. İşlem yapmadan önce sayfayı yenileyin. <button className="btn-secondary" onClick={()=>router.reload()}>Sayfayı yenile</button></Notice> : null}
      {pending ? <Card title="Sonucu doğrulanacak işlem">
        <p className="mb-2">{pending.payload.action==="grant" ? `${t.plans[pending.payload.plan]} paket hakkı · Bitiş: ${fmtDateTime(pending.payload.ends_at)}` : "Geçici paket hakkını sonlandırma"}</p>
        <p className="mb-2 break-all text-sm text-slate-500">{pending.payload.action==="grant" ? `Aile: ${pending.payload.family_id}` : `Hak: ${pending.payload.override_id}`}</p>
        <p className="mb-4">Gerekçe: {pending.payload.reason}</p>
        <p className="mb-4 text-slate-600">Bağlantı kesilmiş olsa da kaydınız korunur. Bu işlem doğrulanmadan yeni hak verilmez.</p>
        <button className="btn" disabled={busy || storageError} onClick={()=>void save()}>{busy ? "Kontrol ediliyor…" : "Aynı işlemi kontrol et"}</button>
      </Card> : null}
      {!revoking ? <GrantForm key={initialFamily} initialFamily={initialFamily} locked={locked} onSave={save} /> : null}
      {revoking ? <Card title="Geçici hakkı sonlandır">
        <p className="mb-3">{revoking.family} ailesinin {revoking.plan} hakkı sonlandırılacak. Bu işlem para iadesi yapmaz ve mağaza aboneliğini iptal etmez.</p>
        <form onSubmit={e=>{e.preventDefault();void save({action:"expire",override_id:revoking.id,reason:revokeReason.trim()});}}>
          <label className="label" htmlFor="expire-reason">Sonlandırma gerekçesi</label>
          <input id="expire-reason" className="input" autoFocus required minLength={3} maxLength={1000} disabled={locked} value={revokeReason} onChange={e=>setRevokeReason(e.target.value)} />
          <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className="btn-danger" disabled={locked}>Geçici hakkı sonlandır</button><button type="button" className="btn-secondary" disabled={locked} onClick={()=>{setRevoking(null);setRevokeReason("");}}>Vazgeç</button></div>
        </form>
      </Card> : null}

      <Card>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t.overrides.showInactive}
        </label>
        {list.error ? <Notice tone="error">{errorMessage(list.error, t.errors)}</Notice> : null}
        {!list.data ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : list.data.length === 0 ? (
          <p className="text-sm text-slate-500">{t.overrides.empty}</p>
        ) : (
          <>
          <div className="space-y-3 xl:hidden">
            {list.data.map(o=>{const status=statusOf(o);return <article key={o.id} className="rounded-2xl border border-violet-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">{o.family_name} · {t.plans[o.plan]}</h3><span className={`rounded-full px-3 py-1 text-sm ${status.cls}`}>{status.label}</span></div>
              <p className="my-3 text-slate-600">{o.reason}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Başlangıç</dt><dd>{fmtDateTime(o.starts_at)}</dd></div><div><dt className="text-slate-500">Bitiş</dt><dd>{fmtDateTime(o.ends_at)}</dd></div></dl>
              {status.expirable ? <button className="btn-danger mt-4" disabled={locked} onClick={()=>{setMsg(null);setRevoking({id:o.id,family:o.family_name,plan:t.plans[o.plan]??o.plan});setRevokeReason("");}}>Sonlandır</button> : null}
            </article>;})}
          </div>
          <div className="hidden overflow-x-auto xl:block">
            <div className="overflow-x-auto"><table className="table">
              <thead>
                <tr>
                  <th>{t.overrides.family}</th>
                  <th>{t.overrides.plan}</th>
                  <th>{t.overrides.reason}</th>
                  <th>{t.overrides.startsAt}</th>
                  <th>{t.overrides.endsAt}</th>
                  <th>{t.overrides.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((o) => {
                  const s = statusOf(o);
                  return (
                    <tr key={o.id}>
                      <td>
                        <div>{o.family_name}</div>
                        <div className="font-mono text-xs text-slate-400">{o.family_id}</div>
                      </td>
                      <td>{t.plans[o.plan]}</td>
                      <td>{o.reason}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(o.starts_at)}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(o.ends_at)}</td>
                      <td>
                        <span className={`rounded px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
                      </td>
                      <td>
                        {s.expirable ? (
                          <button className="btn-danger" disabled={locked} onClick={() => {setMsg(null);setRevoking({id:o.id,family:o.family_name,plan:t.plans[o.plan] ?? o.plan});setRevokeReason("");}}>
                            {t.overrides.expire}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
          </>
        )}
      </Card>

      <Card title={t.overrides.auditTitle}>
        {audit.error ? <Notice tone="error">İşlem geçmişi yüklenemedi.</Notice> : null}
        {!audit.data ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : audit.data.length === 0 ? (
          <p className="text-sm text-slate-500">{t.overrides.empty}</p>
        ) : (
          <div className="overflow-x-auto"><table className="table">
            <thead>
              <tr>
                <th>{t.overrides.when}</th>
                <th>{t.overrides.action}</th>
                <th>{t.overrides.reason}</th>
                <th>{t.overrides.actor}</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                  <td className="font-mono text-xs">{a.action === "entitlement_overrides.insert" ? "Hak verildi" : a.action === "entitlement_overrides.expire" ? "Hak sonlandırıldı" : a.action === "entitlement_overrides.update" ? "Hak güncellendi" : a.action}</td>
                  <td>{a.reason ?? t.common.none}</td>
                  <td className="font-mono text-xs text-slate-500">{a.actor_id ?? "service_role"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
    </Layout>
  );
}
