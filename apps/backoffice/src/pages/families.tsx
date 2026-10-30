import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { fmtDate, fmtNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

export default function FamiliesPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading } = useAdminQuery(
    async () => unwrap(await supabase().rpc("admin_search_families", { p_query: query || undefined, p_limit: 100 })),
    [query],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
  }

  return (
    <Layout title={t.families.title}>
      <p className="mb-4 text-sm text-slate-500">{t.families.help}</p>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input className="input" placeholder={t.families.placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn" type="submit" disabled={loading}>
          {t.common.search}
        </button>
      </form>
      {error ? <Notice tone="error">{errorMessage(error, t.errors)}</Notice> : null}
      <Card>
        {!data ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">{t.families.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.families.name}</th>
                  <th>{t.families.createdAt}</th>
                  <th className="text-right">{t.families.members}</th>
                  <th className="text-right">{t.families.children}</th>
                  <th className="text-right">{t.families.devices}</th>
                  <th>{t.families.plan}</th>
                  <th>{t.families.source}</th>
                  <th>{t.families.expires}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div>{f.name}</div>
                      <div className="font-mono text-xs text-slate-400">{f.id}</div>
                    </td>
                    <td>{fmtDate(f.created_at)}</td>
                    <td className="text-right">{fmtNumber(f.member_count)}</td>
                    <td className="text-right">{fmtNumber(f.child_count)}</td>
                    <td className="text-right">{fmtNumber(f.device_count)}</td>
                    <td>{t.plans[f.plan] ?? f.plan}</td>
                    <td>{t.families.sources[f.plan_source] ?? f.plan_source}</td>
                    <td>{fmtDate(f.plan_expires_at)}</td>
                    <td>
                      <Link className="btn-secondary whitespace-nowrap" href={{ pathname: "/overrides", query: { family: f.id } }}>
                        {t.families.giveComp}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Layout>
  );
}
