import { useEffect, useMemo, useRef, useState } from "react";
import { presetUntil, type OverridePreview as Preview } from "@gina/core";

import { Notice } from "@/components/Layout";
import { isDefinitiveRejection, isForbidden, rpcMessage } from "@/lib/admin-rpc";
import { b01, limitValue, planLabel } from "@/lib/admin-workqueue-text";
import { fmtDate, fmtDateTime, fmtNumber, inputDaysFromNow, localInputToIso } from "@/lib/format";
import { applyOverride, overrideApplyQueue, previewOverride, type PendingApply } from "@/lib/override-apply";

type Plan = "plus" | "pro";
type Duration = 7 | 30 | 90 | "custom" | null;
const DAYS = [7, 30, 90] as const;

/**
 * Sabit aile bağlamında geçici hak: önce `admin_override_preview` (yazmaz), sonra `admin_override_apply`.
 * Uygulama anahtarı bir kez üretilir ve cihazda saklanır; çift tıklama ve yeniden deneme aynı anahtarı kullanır.
 */
export function OverrideGrant({ familyId, user, locked, onApplied, onForbidden }: {
  familyId: string; user: string; locked: boolean; onApplied: () => void; onForbidden: () => void;
}) {
  const [plan, setPlan] = useState<Plan>("plus");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<Duration>(null);
  const [custom, setCustom] = useState(inputDaysFromNow(30));
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState<{ key: string; value: Preview } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const queue = useMemo(() => overrideApplyQueue(user), [user]);
  const [pending, setPending] = useState<PendingApply | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false), seq = useRef(0);
  const forbidden = useRef(onForbidden);
  useEffect(() => { forbidden.current = onForbidden; });

  useEffect(() => {
    let live = true;
    void queue.restore().then((p) => { if (live) setPending(p); }).catch(() => { if (live) setStorageError(true); }).finally(() => { if (live) setRestoring(false); });
    return () => { live = false; };
  }, [queue]);

  const until = useMemo(() => {
    if (duration === "custom") { try { return localInputToIso(custom); } catch { return null; } }
    if (duration && preview) return presetUntil(preview.value, duration);
    return null;
  }, [duration, custom, preview]);
  const inputKey = JSON.stringify([familyId, plan, until, reason.trim()]);

  // Girdi değişince önizleme yenilenir; eski cevap (sıra numarası) yeni girdinin yerine geçmez.
  useEffect(() => {
    const request = ++seq.current;
    const timer = setTimeout(() => {
      previewOverride(familyId, plan, until, reason.trim()).then(
        (value) => { if (request === seq.current) { setPreview({ key: inputKey, value }); setPreviewError(null); } },
        (e: unknown) => {
          if (request !== seq.current) return;
          if (isForbidden(e)) { forbidden.current(); return; }
          setPreviewError(e instanceof Error && e.message === "override_wrong_family" ? b01.override.wrongFamily
            : rpcMessage(e) === "family_not_found" ? b01.override.family_not_found : "Önizleme alınamadı. Bağlantıyı kontrol edip yeniden deneyin.");
        },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [familyId, plan, until, reason, inputKey, tick]);

  const p = preview?.value ?? null;
  const fresh = !!preview && preview.key === inputKey;
  const otherPending = pending && pending.payload.family_id !== familyId;
  const blocked = locked || busy || restoring || storageError || !!pending;
  const canApply = !blocked && fresh && !!p && p.can_apply && !!until && (!p.replace_required || replace);

  async function apply(retry?: PendingApply) {
    if (gate.current) return; // aynı anda ikinci tıklama sunucuya gitmez
    gate.current = true; setBusy(true); setMsg(null);
    let command = retry ?? null;
    try {
      if (!command) {
        if (!p || !until || !fresh) return;
        command = { request: crypto.randomUUID(), payload: { family_id: familyId, plan, until, reason: reason.trim() }, replace: p.replace_required && replace, family_name: p.family.name };
        await queue.prepare(command);
        setPending(command);
      }
      const result = await applyOverride(command);
      await queue.acknowledge(command.request);
      setPending(null); setReplace(false);
      if (!retry) setReason("");
      setMsg({ tone: "ok", text: `${command.family_name}: ${b01.override.applied(result.replayed)}${result.replaced?.length ? ` Sonlandırılan çakışan hak: ${result.replaced.length}.` : ""}` });
      setTick((n) => n + 1); onApplied();
    } catch (e) {
      if (command && isDefinitiveRejection(e)) {
        try { await queue.acknowledge(command.request); setPending(null); } catch { setStorageError(true); }
        if (isForbidden(e)) { forbidden.current(); return; }
        const code = rpcMessage(e);
        const text = code === "request_conflict" ? b01.override.request_conflict : code === "override_conflict" ? b01.override.override_conflict
          : code === "family_not_found" ? b01.override.family_not_found : (b01.blockers as Record<string, string>)[code] ?? "İşlem reddedildi. Önizlemeyi kontrol edin.";
        setMsg({ tone: "error", text }); setReplace(false); setTick((n) => n + 1);
      } else if (e instanceof Error && e.message.startsWith("library_")) {
        setStorageError(true); setMsg({ tone: "error", text: b01.override.storageError });
      } else {
        setMsg({ tone: "error", text: command ? b01.override.unverified : "Önizlemeyi kontrol edin." });
      }
    } finally { gate.current = false; setBusy(false); }
  }

  return (
    <div data-testid="override-grant">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {storageError ? <Notice tone="error">{b01.override.storageError}</Notice> : null}
      {pending ? (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm" role="alert" data-testid="override-pending">
          <p className="font-bold">{otherPending ? b01.override.otherFamilyPending : b01.override.pending}</p>
          <p className="mt-1">{pending.family_name} · {planLabel(pending.payload.plan)} · {fmtDateTime(pending.payload.until)} tarihine kadar · Gerekçe: {pending.payload.reason}</p>
          <p className="mt-1 text-slate-600">{b01.override.pendingHelp}</p>
          <button className="btn mt-3" disabled={busy || locked || storageError} onClick={() => void apply(pending)}>{busy ? b01.override.applying : b01.override.retry}</button>
        </div>
      ) : null}

      {p ? (
        <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-violet-50 p-4" data-testid="preview-family" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">{b01.override.familyHeading}</p>
          <p className="text-2xl font-bold text-slate-900">{p.family.name}</p>
          <p className="mt-1 text-sm text-slate-700">
            {fmtNumber(p.family.member_count)} {b01.override.members} · {fmtNumber(p.family.child_count)} {b01.override.children} · {b01.override.created}: {fmtDate(p.family.created_at)} · {p.family.timezone}
          </p>
          <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">Aile kimliği</summary><code className="break-all">{p.family.id}</code></details>
        </div>
      ) : previewError ? null : <p role="status" className="mb-4 text-slate-500">{b01.override.previewing}</p>}
      {previewError ? <Notice tone="error">{previewError} <button className="btn-secondary ml-2" onClick={() => setTick((n) => n + 1)}>Yeniden dene</button></Notice> : null}

      <fieldset disabled={blocked} className="grid min-w-0 gap-3 border-0 p-0 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="grant-plan">{b01.override.plan}</label>
          <select id="grant-plan" className="input" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            <option value="plus">{planLabel("plus")}</option>
            <option value="pro">{planLabel("pro")}</option>
          </select>
        </div>
        <div>
          <span className="label" id="grant-duration">{b01.override.duration}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="grant-duration">
            {DAYS.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={duration === d}
                className={`btn-secondary !min-h-11 !px-3 !py-2 ${duration === d ? "border-brand bg-brand-light font-semibold" : ""}`}
                onClick={() => setDuration(d)} disabled={!p}>
                {d} gün{p ? <span className="ml-1 text-xs text-slate-500">({fmtDate(presetUntil(p, d))})</span> : null}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={duration === "custom"}
              className={`btn-secondary !min-h-11 !px-3 !py-2 ${duration === "custom" ? "border-brand bg-brand-light font-semibold" : ""}`}
              onClick={() => setDuration("custom")}>{b01.override.custom}</button>
          </div>
          {duration === "custom" ? (
            <input aria-label={b01.override.custom} type="datetime-local" className="input mt-2" value={custom} onChange={(e) => setCustom(e.target.value)} />
          ) : null}
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="grant-reason">{b01.override.reason}</label>
          <input id="grant-reason" className="input" minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={b01.override.reasonPlaceholder} />
        </div>
      </fieldset>

      {p ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3" data-testid="preview-effect">
          {([["before", b01.override.before, p.before], ["after", b01.override.after, p.after], ["reverts", b01.override.revertsTo, p.reverts_to]] as const).map(([k, label, e]) => (
            <div key={k} className={`rounded-xl border p-3 text-sm ${k === "after" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-lg font-semibold">{planLabel(e.plan)}</div>
              <div className="text-xs text-slate-600">{b01.sources[e.source]}{e.expires_at ? ` · ${fmtDateTime(e.expires_at)} tarihine kadar` : ""}</div>
            </div>
          ))}
        </div>
      ) : null}
      {p && !fresh ? <p className="mt-2 text-sm text-amber-800" role="status">{b01.override.stale}</p> : null}

      {p && p.changes.some((c) => c.direction !== "same") ? (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold">{b01.override.changes}</h3>
          <ul className="grid gap-1 text-sm md:grid-cols-2">
            {p.changes.filter((c) => c.direction !== "same").map((c) => (
              <li key={c.limit} className={c.direction === "opens" ? "text-emerald-800" : "text-red-800"}>
                {c.direction === "opens" ? "↑" : "↓"} {b01.limits[c.limit]}: {limitValue(c.limit, c.before)} → {limitValue(c.limit, c.after)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {p && p.conflicts.length ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="preview-conflicts">
          <h3 className="mb-1 font-semibold">{b01.override.conflicts}</h3>
          <ul className="space-y-1">
            {p.conflicts.map((c) => (
              <li key={c.override_id}>{planLabel(c.plan)} · {fmtDateTime(c.starts_at)} — {fmtDateTime(c.ends_at)} · <strong>{b01.relations[c.relation] ?? c.relation}</strong> · {c.reason}</li>
            ))}
          </ul>
          {p.replace_required ? (
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" checked={replace} disabled={blocked} onChange={(e) => setReplace(e.target.checked)} />
              <span><strong>{b01.override.replace}</strong><br /><span className="text-xs text-slate-600">{b01.override.replaceHelp}</span></span>
            </label>
          ) : null}
        </div>
      ) : null}

      {p && p.blockers.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900" data-testid="preview-blockers">
          {p.blockers.map((b) => <li key={b}>{b01.blockers[b]}</li>)}
        </ul>
      ) : null}

      <button className="btn mt-4" type="button" disabled={!canApply} onClick={() => void apply()} data-testid="override-apply">
        {busy ? b01.override.applying : b01.override.apply}
      </button>
    </div>
  );
}
