import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupWorkqueue, waitingLabel, workqueueSchema, type AdminQueueRole, type Workqueue as Queue, type WorkqueueItem } from "@gina/core";

import { Notice } from "@/components/Layout";
import { adminRpc, isForbidden } from "@/lib/admin-rpc";
import { adminOnlyHref, b01, itemText, reasonText, waitingText } from "@/lib/admin-workqueue-text";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, fmtNumber } from "@/lib/format";

/**
 * Rol bazlı iş kuyruğu (`admin_workqueue`). Sunucu yalnız çağıranın canlı rollerine ait kalemleri döndürür;
 * `groupWorkqueue` başka role ait kalem gelirse reddeder. `role` verilirse sunucuya `p_role` olarak gider.
 */
export function Workqueue({ role, onForbidden }: { role?: AdminQueueRole; onForbidden?: () => void }) {
  const { session } = useAuth();
  const [state, setState] = useState<{ data: Queue | null; error: boolean }>({ data: null, error: false });
  const [filter, setFilter] = useState<AdminQueueRole | "all">("all");
  const seq = useRef(0);
  const forbidden = useRef(onForbidden);
  useEffect(() => { forbidden.current = onForbidden; });
  const load = useCallback(async () => {
    const request = ++seq.current;
    try {
      const data = workqueueSchema.parse(await adminRpc("admin_workqueue", role ? { p_role: role } : {}, 15000));
      groupWorkqueue(data); // rol sızıntısı kontrolü
      if (request === seq.current) setState({ data, error: false });
    } catch (error) {
      if (request !== seq.current) return;
      if (isForbidden(error)) { setState({ data: null, error: false }); forbidden.current?.(); return; }
      setState((old) => ({ data: old.data, error: true }));
    }
  }, [role]);
  useEffect(() => {
    if (!session) return;
    const first = setTimeout(() => void load(), 0);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(visible, 60000);
    window.addEventListener("focus", visible);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener("focus", visible); };
  }, [session, load]);

  const groups = useMemo(() => (state.data ? groupWorkqueue(state.data) : []), [state.data]);
  const visible = groups.filter((g) => filter === "all" || g.role === filter);
  const first = useMemo(
    () => visible.flatMap((g) => g.items).filter((i) => i.count > 0)
      .sort((a, b) => (b.oldest_waiting_seconds ?? 0) - (a.oldest_waiting_seconds ?? 0)).slice(0, 3),
    [visible],
  );

  return (
    <section className="admin-card" aria-labelledby="workqueue-title" data-testid="workqueue">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="workqueue-title" className="text-lg font-bold text-slate-800">{b01.workqueue.title}</h2>
        {state.data ? <span className="text-xs text-slate-500">{b01.workqueue.asOf}: {fmtDateTime(state.data.as_of)}</span> : null}
      </div>
      <p className="mb-3 text-sm text-slate-600">{b01.workqueue.help}</p>
      {state.error ? (
        <Notice tone="error">{b01.workqueue.loadError} <button className="btn-secondary ml-2" onClick={() => void load()}>Yeniden dene</button></Notice>
      ) : null}
      {!state.data ? (!state.error ? <p className="text-slate-500" role="status">İş kuyruğu yükleniyor…</p> : null) : (
        <>
          {!role && groups.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Role göre süz">
              {(["all", ...groups.map((g) => g.role)] as const).map((r) => (
                <button key={r} type="button" aria-pressed={filter === r}
                  className={`btn-secondary !min-h-10 !px-3 !py-1 text-sm ${filter === r ? "border-brand bg-brand-light font-semibold" : ""}`}
                  onClick={() => setFilter(r)}>
                  {r === "all" ? b01.workqueue.all : b01.roles[r]}
                  {r === "all" ? null : <span className="ml-1 text-slate-500">({fmtNumber(groups.find((g) => g.role === r)?.pending ?? 0)})</span>}
                </button>
              ))}
            </div>
          ) : null}
          {first.length === 0 ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{b01.workqueue.allClear}</p>
          ) : (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{b01.workqueue.first}</h3>
              <ol className="grid gap-2 md:grid-cols-3">
                {first.map((item) => <FirstItem key={item.role + item.key} item={item} />)}
              </ol>
            </div>
          )}
          {visible.map((g) => {
            const active = g.items.filter((i) => i.count > 0), empty = g.items.filter((i) => i.count === 0);
            return (
              <div key={g.role} className="mb-3">
                <h3 className="mb-1 text-sm font-semibold text-slate-700">{b01.roles[g.role]} · {fmtNumber(g.pending)}</h3>
                {active.length ? (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {active.map((item) => <QueueRow key={item.key} item={item} />)}
                  </ul>
                ) : null}
                {empty.length ? (
                  <p className="mt-1 text-xs text-slate-500">{b01.workqueue.emptyQueues}: {empty.map((i) => itemText(i).label).join(" · ")}</p>
                ) : null}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function FirstItem({ item }: { item: WorkqueueItem }) {
  const text = itemText(item);
  const { isAdmin } = useAuth();
  return (
    <li className="relative rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm focus-within:ring-2 focus-within:ring-purple-600">
      {/* C12: bütün kart tıklanabilir (19 px metin bağlantısı yerine kart boyu hedef). */}
      {isAdmin || !adminOnlyHref(text.href)
        ? <Link href={text.href} className="font-semibold text-slate-900 underline-offset-2 after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline focus:outline-none">{text.label}</Link>
        : <span className="font-semibold text-slate-900">{text.label}</span>}
      <div className="mt-1 text-amber-900"><strong>{fmtNumber(item.count)}</strong> · {b01.workqueue.oldest}: {waitingText(waitingLabel(item.oldest_waiting_seconds))}</div>
      <div className="text-xs text-slate-600">{reasonText(item)}</div>
    </li>
  );
}

function QueueRow({ item }: { item: WorkqueueItem }) {
  const text = itemText(item);
  const { isAdmin } = useAuth();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm" data-queue={item.key}>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-slate-900">{text.label}</span>
        <span className="block text-xs text-slate-500">{reasonText(item)}</span>
      </span>
      <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white" aria-label={`${fmtNumber(item.count)} kayıt`}>{fmtNumber(item.count)}</span>
      <span className="w-28 text-xs text-slate-600">{b01.workqueue.oldest}: {waitingText(waitingLabel(item.oldest_waiting_seconds))}</span>
      {isAdmin || !adminOnlyHref(text.href)
        ? <Link href={text.href} aria-label={`${b01.workqueue.open}: ${text.label}`} className="btn-secondary !min-h-11 !px-4 !py-1 text-sm">{b01.workqueue.open}</Link>
        : <span className="text-xs text-slate-500" data-testid="admin-only-link">Yönetici ekranı</span>}
    </li>
  );
}
