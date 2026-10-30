import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";

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

function GrantForm({ initialFamily, onDone }: { initialFamily: string; onDone: (err?: unknown) => void }) {
  const [familyId, setFamilyId] = useState(initialFamily);
  const [familyQuery, setFamilyQuery] = useState("");
  const [matches, setMatches] = useState<{ id: string; name: string }[]>([]);
  const [plan, setPlan] = useState<PaidPlan>("plus");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState(inputDaysFromNow(90));
  const [busy, setBusy] = useState(false);

  async function findFamily() {
    const { data } = await supabase().rpc("admin_search_families", { p_query: familyQuery.trim(), p_limit: 10 });
    setMatches((data ?? []).map((f) => ({ id: f.id, name: f.name })));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().rpc("admin_grant_override", {
      p_family_id: familyId.trim(),
      p_plan: plan,
      p_reason: reason.trim(),
      p_ends_at: localInputToIso(endsAt),
    });
    setBusy(false);
    if (!error) setReason("");
    onDone(error ?? undefined);
  }

  return (
    <Card title={t.overrides.grant}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1">
          <label className="label">{t.overrides.family}</label>
          <input className="input" value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} placeholder={t.families.placeholder} />
        </div>
        <button className="btn-secondary" type="button" onClick={() => void findFamily()}>
          {t.common.search}
        </button>
      </div>
      {matches.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" className={`btn-secondary ${m.id === familyId ? "border-brand" : ""}`} onClick={() => setFamilyId(m.id)}>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">{t.overrides.familyId}</label>
          <input className="input font-mono" required value={familyId} onChange={(e) => setFamilyId(e.target.value)} />
          {!familyId ? <p className="mt-1 text-xs text-slate-500">{t.overrides.pickFamily}</p> : null}
        </div>
        <div>
          <label className="label">{t.overrides.plan}</label>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as PaidPlan)}>
            <option value="plus">{t.plans.plus}</option>
            <option value="pro">{t.plans.pro}</option>
          </select>
        </div>
        <div>
          <label className="label">{t.overrides.endsAt}</label>
          <input type="datetime-local" className="input" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">{t.overrides.reason}</label>
          <input className="input" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.overrides.reasonPlaceholder} />
        </div>
        <div className="flex items-end">
          <button className="btn w-full" type="submit" disabled={busy}>
            {t.overrides.grant}
          </button>
        </div>
      </form>
    </Card>
  );
}

export default function OverridesPage() {
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

  const done = (err: unknown, okText: string) => {
    setMsg(err ? { text: errorMessage(err, t.errors), tone: "error" } : { text: okText, tone: "ok" });
    list.reload();
    audit.reload();
  };

  async function expire(id: string) {
    const reason = window.prompt(t.overrides.expireReason);
    if (reason == null) return;
    const { error } = await supabase().rpc("admin_expire_override", { p_override_id: id, p_reason: reason });
    done(error, t.common.saved);
  }

  return (
    <Layout title={t.overrides.title}>
      <p className="mb-4 text-sm text-slate-500">{t.overrides.help}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <GrantForm key={initialFamily} initialFamily={initialFamily} onDone={(err) => done(err, t.overrides.created)} />

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
          <div className="overflow-x-auto">
            <table className="table">
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
                          <button className="btn-danger" onClick={() => void expire(o.id)}>
                            {t.overrides.expire}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t.overrides.auditTitle}>
        {!audit.data ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : audit.data.length === 0 ? (
          <p className="text-sm text-slate-500">{t.overrides.empty}</p>
        ) : (
          <table className="table">
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
                  <td className="font-mono text-xs">{a.action}</td>
                  <td>{a.reason ?? t.common.none}</td>
                  <td className="font-mono text-xs text-slate-500">{a.actor_id ?? "service_role"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Layout>
  );
}
