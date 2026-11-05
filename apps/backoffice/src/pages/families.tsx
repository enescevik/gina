import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { fmtDate, fmtNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

const PAGE = 100;

export default function FamiliesPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  // Bir fazla kayıt istenir: "daha fazla var" bilgisi sunucudan gelir, ilk sayfa bütün kayıt gibi sunulmaz.
  const { data, error, loading, reload } = useAdminQuery(
    async () => {
      const rows = unwrap(await supabase().rpc("admin_search_families", { p_query: query || undefined, p_limit: limit + 1 }));
      return { rows: rows.slice(0, limit), more: rows.length > limit };
    },
    [query, limit],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
    setLimit(PAGE);
  }
  const action = (id: string) => (
    <Link className="btn-secondary inline-flex items-center whitespace-nowrap" href={{ pathname: "/billing", query: { family: id } }}>
      Paket ve ödeme
    </Link>
  );

  return (
    <Layout title={t.families.title}>
      <p className="mb-4 text-sm text-slate-500">{t.families.help}</p>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <label className="sr-only" htmlFor="family-query">{t.families.placeholder}</label>
        <input id="family-query" className="input" placeholder={t.families.placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn" type="submit" disabled={loading}>
          {t.common.search}
        </button>
      </form>
      {error ? (
        <Notice tone="error">
          {errorMessage(error, t.errors)}{" "}
          <button className="btn-secondary ml-2" disabled={loading} onClick={reload}>Yeniden dene</button>
        </Notice>
      ) : null}
      <Card>
        {!data ? (
          loading ? <p className="text-slate-500">{t.common.loading}</p> : null
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-slate-500">{t.families.empty}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600" role="status">
              {data.more
                ? `İlk ${fmtNumber(data.rows.length)} aile gösteriliyor; daha fazlası var. Aramayla daraltın veya daha fazla yükleyin.`
                : `${fmtNumber(data.rows.length)} aile${query ? " bu aramayla eşleşti" : ""}.`}
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.families.name}</th>
                    <th>{t.families.plan}</th>
                    <th>{t.families.expires}</th>
                    <th className="text-right">{t.families.children}</th>
                    <th className="hidden text-right xl:table-cell">{t.families.members}</th>
                    <th className="hidden text-right xl:table-cell">{t.families.devices}</th>
                    <th className="hidden xl:table-cell">{t.families.createdAt}</th>
                    <th className="hidden xl:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div className="font-semibold">{f.name}</div>
                        <details className="mt-1 text-xs text-slate-500">
                          <summary className="cursor-pointer">Kimlik ve ayrıntı</summary>
                          <code className="break-all">{f.id}</code>
                          <div className="mt-1 xl:hidden">{t.families.members}: {fmtNumber(f.member_count)} · {t.families.devices}: {fmtNumber(f.device_count)} · {t.families.createdAt}: {fmtDate(f.created_at)}</div>
                        </details>
                        <div className="mt-2 xl:hidden">{action(f.id)}</div>
                      </td>
                      <td>
                        <div>{t.plans[f.plan] ?? f.plan}</div>
                        <div className="text-xs text-slate-500">{t.families.sources[f.plan_source] ?? f.plan_source}</div>
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(f.plan_expires_at)}</td>
                      <td className="text-right">{fmtNumber(f.child_count)}</td>
                      <td className="hidden text-right xl:table-cell">{fmtNumber(f.member_count)}</td>
                      <td className="hidden text-right xl:table-cell">{fmtNumber(f.device_count)}</td>
                      <td className="hidden whitespace-nowrap xl:table-cell">{fmtDate(f.created_at)}</td>
                      <td className="hidden xl:table-cell">{action(f.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.more ? (
              <button className="btn-secondary mt-4" disabled={loading} onClick={() => setLimit(limit + PAGE)}>
                {loading ? t.common.loading : `Sonraki ${PAGE} aileyi de göster`}
              </button>
            ) : null}
          </>
        )}
      </Card>
    </Layout>
  );
}
