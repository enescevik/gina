import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { appendFamilyPage, FAMILY_EXPIRING_DAYS, familiesSearchSchema, familySearchArgs, normalizeFamilyQuery, type FamilySearchRow, type FamilySort } from "@gina/core";

import { Card, Layout, Notice } from "@/components/Layout";
import { adminRpc, isForbidden } from "@/lib/admin-rpc";
import { b01, planLabel } from "@/lib/admin-workqueue-text";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/supabase";

const PAGE = 50;
// D12 (D11-K1): süzgeç ve sıralama sunucuda; cursor o anki (sorgu, süzgeç, sıralama) üçlüsüne aittir.
type View = { query: string | null; expiring: boolean; sort: FamilySort };
type List = View & { asOf: string; rows: FamilySearchRow[]; cursor: string | null; hasMore: boolean };
const DAY_MS = 86_400_000;
const argsOf = (v: View, cursor: string | null) =>
  familySearchArgs(v.query, cursor, PAGE, { expiringWithinDays: v.expiring ? FAMILY_EXPIRING_DAYS : null, sort: v.sort });

export default function FamiliesPage() {
  const { session, isAdmin } = useAuth();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [expiring, setExpiring] = useState(false);
  const [sort, setSort] = useState<FamilySort>("newest");
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pageError, setPageError] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [inputError, setInputError] = useState("");
  const seq = useRef(0);

  // İlk sayfa: önceki istek bekliyorsa sonucu yok sayılır (sıra numarası).
  const loadFirst = useCallback(async (view: View) => {
    const request = ++seq.current;
    setLoading(true); setError(null); setPageError(false);
    try {
      const page = familiesSearchSchema.parse(await adminRpc("admin_families_search", argsOf(view, null)));
      if (request !== seq.current) return;
      const merged = appendFamilyPage([], page, null, null);
      setList({ ...view, asOf: page.as_of, rows: merged.rows, cursor: merged.cursor, hasMore: merged.hasMore });
    } catch (e) {
      if (request !== seq.current) return;
      if (isForbidden(e)) setRevoked(true);
      setError(e);
    } finally { if (request === seq.current) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!session || !isAdmin) return;
    const timer = setTimeout(() => void loadFirst({ query, expiring, sort }), 0);
    return () => clearTimeout(timer);
  }, [session, isAdmin, query, expiring, sort, loadFirst]);

  // Gerçek keyset: sunucunun verdiği cursor ile sonraki sayfa; gelen sayfa listeye eklenir, ilk sayfa yeniden istenmez.
  async function loadMore() {
    const current = list;
    if (!current?.cursor || loading) return;
    const request = ++seq.current, expected = current.cursor;
    setLoading(true); setPageError(false);
    try {
      const page = familiesSearchSchema.parse(await adminRpc("admin_families_search", argsOf(current, expected)));
      if (request !== seq.current) return;
      const merged = appendFamilyPage(current.rows, page, expected, current.cursor);
      setList({ ...current, rows: merged.rows, cursor: merged.cursor, hasMore: merged.hasMore });
    } catch (e) {
      if (request !== seq.current) return;
      if (isForbidden(e)) { setRevoked(true); setError(e); } else setPageError(true);
    } finally { if (request === seq.current) setLoading(false); }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    try { setInputError(""); setQuery(normalizeFamilyQuery(input)); }
    catch { setInputError(b01.families.tooLong); }
  }

  const actions = (id: string) => (
    <div className="flex flex-wrap gap-2">
      <Link className="btn-secondary inline-flex items-center whitespace-nowrap" href={{ pathname: "/billing", query: { family: id } }}>{b01.families.billing}</Link>
      <Link className="btn-secondary inline-flex items-center whitespace-nowrap" href={{ pathname: "/overrides", query: { family: id } }}>{b01.families.grant}</Link>
    </div>
  );

  return (
    <Layout title={b01.families.title}>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">{b01.families.help}</p>
      {revoked ? <Notice tone="error"><strong>{b01.revoked.title}.</strong> {b01.revoked.body}</Notice> : (
        <>
          <form onSubmit={onSubmit} className="mb-4 flex gap-2" role="search">
            <label className="sr-only" htmlFor="family-query">{b01.families.placeholder}</label>
            <input id="family-query" className="input" maxLength={160} placeholder={b01.families.placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn" type="submit" disabled={loading}>{t.common.search}</button>
          </form>
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" role="group" aria-label={b01.families.viewLabel}>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={expiring} disabled={loading} onChange={(e) => setExpiring(e.target.checked)} data-testid="families-expiring" />
              {b01.families.expiringFilter(FAMILY_EXPIRING_DAYS)}
            </label>
            <label className="inline-flex items-center gap-2">
              <span className="text-slate-600">{b01.families.sortLabel}</span>
              <select className="input w-auto py-1" value={sort} disabled={loading} onChange={(e) => setSort(e.target.value as FamilySort)} data-testid="families-sort">
                <option value="newest">{b01.families.sortNewest}</option>
                <option value="expiring">{b01.families.sortExpiring}</option>
              </select>
            </label>
          </div>
          {inputError ? <Notice tone="error">{inputError}</Notice> : null}
          {error ? (
            <Notice tone="error">
              {errorMessage(error, t.errors)}{" "}
              <button className="btn-secondary ml-2" disabled={loading} onClick={() => void loadFirst({ query, expiring, sort })}>Yeniden dene</button>
            </Notice>
          ) : null}
          <Card>
            {!list ? (
              loading ? <p className="text-slate-500" role="status">{t.common.loading}</p> : null
            ) : list.rows.length === 0 ? (
              <p className="text-sm text-slate-500">{list.expiring && !list.query ? b01.families.expiringEmpty(FAMILY_EXPIRING_DAYS) : b01.families.empty}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-600" role="status" data-testid="families-status">
                  {list.hasMore ? b01.families.shownMore(fmtNumber(list.rows.length)) : list.expiring ? b01.families.expiringShownAll(fmtNumber(list.rows.length), FAMILY_EXPIRING_DAYS) : b01.families.shownAll(fmtNumber(list.rows.length), !!list.query)}
                </p>
                <ul className="divide-y divide-slate-100" aria-label="Aileler">
                  {list.rows.map((f) => (
                    <li key={f.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)] md:items-start xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto]" data-family-row>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{f.name}</div>
                        {list.query && f.matched_on.length ? (
                          <div className="mt-1 flex flex-wrap gap-1" aria-label={b01.families.matched}>
                            {f.matched_on.map((m) => (
                              <span key={m} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">{b01.families.matched}: {b01.families.matchedOn[m] ?? m}</span>
                            ))}
                          </div>
                        ) : null}
                        <details className="mt-1 text-xs text-slate-500">
                          <summary className="cursor-pointer">{b01.families.details}</summary>
                          <code className="break-all">{f.id}</code>
                          <div className="mt-1">{b01.families.timezone}: {f.timezone} · {t.families.createdAt}: {fmtDate(f.created_at)}</div>
                        </details>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{planLabel(f.plan)}</div>
                        <div className="text-xs text-slate-500">
                          {b01.sources[f.plan_source] ?? f.plan_source}
                          {f.plan_expires_at ? ` · ${fmtDate(f.plan_expires_at)} tarihine kadar` : ""}
                        </div>
                        {f.plan_expires_at && list.expiring ? (
                          <div className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900" data-testid="families-days-left">
                            {b01.families.daysLeft(Math.max(0, Math.ceil((new Date(f.plan_expires_at).getTime() - Date.parse(list.asOf)) / DAY_MS)))}
                          </div>
                        ) : null}
                        {f.store_status ? <div className="text-xs text-slate-500">Mağaza: {b01.storeStatus[f.store_status]}</div> : null}
                        {f.active_override_count ? <div className="text-xs text-slate-500">{b01.families.activeOverrides}: {fmtNumber(f.active_override_count)}</div> : null}
                      </div>
                      <div className="text-xs text-slate-600">
                        <div>{t.families.children}: {fmtNumber(f.child_count)}{f.archived_child_count ? ` (+${fmtNumber(f.archived_child_count)} ${b01.families.archived})` : ""}</div>
                        <div>{t.families.members}: {fmtNumber(f.member_count)} · {t.families.devices}: {fmtNumber(f.device_count)}</div>
                        <div>{b01.families.lastActivity}: {fmtDateTime(f.last_activity_at)}</div>
                      </div>
                      <div className="md:col-span-3 xl:col-span-1">{actions(f.id)}</div>
                    </li>
                  ))}
                </ul>
                {pageError ? <Notice tone="error">{b01.families.pageError}</Notice> : null}
                {list.hasMore ? (
                  <button className="btn-secondary mt-4" disabled={loading} onClick={() => void loadMore()}>
                    {loading ? t.common.loading : b01.families.more}
                  </button>
                ) : null}
              </>
            )}
          </Card>
        </>
      )}
    </Layout>
  );
}
