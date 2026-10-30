import { Card, Layout, Notice } from "@/components/Layout";
import { fmtNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

interface Dashboard {
  families: number;
  children: number;
  parents: number;
  devices: number;
  global_questions: number;
  active_subscriptions: Record<string, number>;
  active_comps: Record<string, number>;
  families_by_plan: Record<string, number>;
  ai_last_30d: { model: string; count: number; input_tokens: number; output_tokens: number }[];
}

const PLAN_ORDER = ["free", "plus", "pro"];

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold">{fmtNumber(value)}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function PlanTable({ title, values }: { title: string; values: Record<string, number> | undefined }) {
  return (
    <Card title={title}>
      <table className="table">
        <tbody>
          {PLAN_ORDER.map((p) => (
            <tr key={p}>
              <td>{t.plans[p]}</td>
              <td className="text-right font-medium">{fmtNumber(values?.[p] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, error } = useAdminQuery(async () => unwrap(await supabase().rpc("admin_dashboard")) as unknown as Dashboard);

  return (
    <Layout title={t.dashboard.title}>
      {error ? <Notice tone="error">{errorMessage(error, t.errors)}</Notice> : null}
      {!data ? (
        <p className="text-slate-500">{t.common.loading}</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label={t.dashboard.families} value={data.families} />
            <Stat label={t.dashboard.children} value={data.children} />
            <Stat label={t.dashboard.parents} value={data.parents} />
            <Stat label={t.dashboard.devices} value={data.devices} />
            <Stat label={t.dashboard.globalQuestions} value={data.global_questions} />
          </div>
          <div className="grid gap-x-4 md:grid-cols-3">
            <PlanTable title={t.dashboard.activeSubscriptions} values={data.active_subscriptions} />
            <PlanTable title={t.dashboard.activeComps} values={data.active_comps} />
            <PlanTable title={t.dashboard.familiesByPlan} values={data.families_by_plan} />
          </div>
          <Card title={t.dashboard.aiUsage}>
            {data.ai_last_30d.length === 0 ? (
              <p className="text-sm text-slate-500">{t.dashboard.noAiUsage}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.dashboard.model}</th>
                    <th className="text-right">{t.dashboard.count}</th>
                    <th className="text-right">{t.dashboard.inputTokens}</th>
                    <th className="text-right">{t.dashboard.outputTokens}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ai_last_30d.map((r) => (
                    <tr key={r.model}>
                      <td className="font-mono">{r.model}</td>
                      <td className="text-right">{fmtNumber(r.count)}</td>
                      <td className="text-right">{fmtNumber(r.input_tokens)}</td>
                      <td className="text-right">{fmtNumber(r.output_tokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </Layout>
  );
}
