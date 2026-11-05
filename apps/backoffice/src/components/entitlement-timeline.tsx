import { useCallback, useEffect, useRef, useState } from "react";
import { appendTimelinePage, entitlementTimelineSchema, timelineGroup, type EntitlementTimeline as Timeline, type TimelineEvent, type TimelineGroup } from "@gina/core";

import { Notice } from "@/components/Layout";
import { adminRpc, isForbidden } from "@/lib/admin-rpc";
import { b01, planLabel } from "@/lib/admin-workqueue-text";
import { fmtDateTime } from "@/lib/format";

const PAGE = 20;
// Her grup ayrı rozet rengi: iade, iptal ve telafi aynı görünmez.
const tone: Record<TimelineGroup, string> = {
  purchase: "bg-emerald-100 text-emerald-900 border-emerald-200",
  renewal: "bg-teal-100 text-teal-900 border-teal-200",
  cancellation: "bg-amber-100 text-amber-900 border-amber-200",
  refund: "bg-rose-100 text-rose-900 border-rose-200",
  revocation: "bg-red-100 text-red-900 border-red-200",
  lapse: "bg-orange-100 text-orange-900 border-orange-200",
  compensation: "bg-violet-100 text-violet-900 border-violet-200",
  verification: "bg-sky-100 text-sky-900 border-sky-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Sabit aile bağlamında mağaza/geçici hak zaman çizgisi (`admin_family_entitlement_timeline`, keyset). */
export function EntitlementTimeline({ familyId, refresh = 0, onForbidden }: { familyId: string; refresh?: number; onForbidden?: () => void }) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const forbidden = useRef(onForbidden);
  useEffect(() => { forbidden.current = onForbidden; });

  const load = useCallback(async (current: Timeline | null) => {
    const request = ++seq.current;
    setLoading(true); setError(null);
    try {
      const page = entitlementTimelineSchema.parse(await adminRpc("admin_family_entitlement_timeline", { p_family_id: familyId, p_cursor: current?.next_cursor ?? null, p_limit: PAGE }));
      if (request !== seq.current) return;
      if (page.family.id !== familyId) throw new Error("timeline_family_mismatch");
      setTimeline(appendTimelinePage(current, page));
    } catch (e) {
      if (request !== seq.current) return;
      if (isForbidden(e)) { forbidden.current?.(); setError(b01.revoked.title); return; }
      setError(e instanceof Error && e.message === "timeline_family_mismatch" ? b01.timeline.mismatch : b01.timeline.error);
    } finally { if (request === seq.current) setLoading(false); }
  }, [familyId]);

  // Aile değişince eski ailenin olayları hemen temizlenir; başka ailenin sayfası birleştirilmez.
  useEffect(() => { const timer = setTimeout(() => void load(null), 0); return () => clearTimeout(timer); }, [load, refresh]);

  return (
    <section className="billing-section" aria-labelledby="timeline-title" data-testid="entitlement-timeline">
      <h3 id="timeline-title">{b01.timeline.title}</h3>
      <p className="billing-hint">{b01.timeline.help}</p>
      {timeline ? (
        <p className="mb-2 text-sm">
          <strong>{timeline.family.name}</strong> · {b01.timeline.effective}: {planLabel(timeline.family.effective.plan)} ({b01.sources[timeline.family.effective.source]}
          {timeline.family.effective.expires_at ? `, ${fmtDateTime(timeline.family.effective.expires_at)} tarihine kadar` : ""})
        </p>
      ) : null}
      {error ? <Notice tone="error">{error} <button className="btn-secondary ml-2" onClick={() => void load(timeline)}>Yeniden dene</button></Notice> : null}
      {!timeline && loading ? <p role="status" className="text-sm text-slate-500">Zaman çizgisi yükleniyor…</p> : null}
      {timeline && timeline.events.length === 0 ? <p className="text-sm text-slate-500">{b01.timeline.empty}</p> : null}
      {timeline && timeline.events.length ? (
        <ol className="relative ml-2 border-l border-slate-200">
          {timeline.events.map((e) => <EventRow key={e.kind + ":" + e.id} event={e} />)}
        </ol>
      ) : null}
      {timeline?.has_more ? (
        <button className="btn-secondary mt-3" disabled={loading} onClick={() => void load(timeline)}>{loading ? "Yükleniyor…" : b01.timeline.more}</button>
      ) : timeline && timeline.events.length ? <p className="mt-2 text-xs text-slate-500">{b01.timeline.end}</p> : null}
    </section>
  );
}

function EventRow({ event: e }: { event: TimelineEvent }) {
  const group = timelineGroup(e.kind), d = e.data;
  const plan = str(d.plan), platform = str(d.platform), reason = str(d.reason), code = str(d.event_type), err = str(d.error_code);
  return (
    <li className="relative mb-3 ml-4" data-kind={e.kind} data-group={group}>
      <span className="absolute -left-[1.375rem] top-1.5 h-3 w-3 rounded-full border border-white bg-slate-400" aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone[group]}`}>{b01.timeline.groups[group]}</span>
        <strong className="text-sm">{b01.timeline.kinds[e.kind]}</strong>
        <span className="text-xs text-slate-500">{fmtDateTime(e.occurred_at)}</span>
      </div>
      <div className="mt-1 text-xs text-slate-600">
        {[platform === "apple" ? "App Store" : platform === "google" ? "Google Play" : null, plan ? planLabel(plan) : null,
          e.kind === "store_subscription" && str(d.status) ? b01.storeStatus[str(d.status) as string] : null,
          e.kind === "comp_granted" && str(d.ends_at) ? `${fmtDateTime(str(d.ends_at))} tarihine kadar` : null,
        ].filter(Boolean).join(" · ")}
        {e.family_of === "store" && e.kind !== "store_subscription" ? (
          <span className={d.processed ? "ml-2 text-emerald-700" : "ml-2 text-amber-800"}>{d.processed ? b01.timeline.processed : b01.timeline.unprocessed}{err ? ` (${err})` : ""}</span>
        ) : null}
      </div>
      {e.kind === "store_check_requested" ? <div className="text-xs font-medium text-sky-900">{b01.timeline.notRefund}{str(d.status) ? ` · durum: ${str(d.status)}` : ""}</div> : null}
      {reason ? <div className="text-xs text-slate-700">Gerekçe: {reason}</div> : null}
      {code ? <div className="text-[11px] text-slate-400"><code>{code}</code></div> : null}
    </li>
  );
}
