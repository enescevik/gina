import { isStructuredType, questionContentErrors, type StructuredInteractionType } from "@gina/core";
import { useEffect, useState } from "react";

import { adminRpc } from "@/lib/admin-rpc";
import { t } from "@/lib/i18n";

/**
 * QT: yapılandırılmış soru önizlemesi (yönetim). Öğrenci payload'ı ve özel cevap anahtarı ayrı kutularda gösterilir.
 * Anahtar yalnız `get_question_answer_keys` RPC'siyle okunur (sunucu yönetici/veli denetler; tabloya doğrudan erişim yok).
 * Biçim bilinmiyorsa veya bozuksa sayfa çökmez: ham JSON gösterilir ve core `questionContentErrors` kodları listelenir.
 */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const text = (v: unknown) => (typeof v === "string" ? v : "");
const s = t.questions.structured;

export function typeLabel(kind: string, interactionType: string | null | undefined): string {
  const type = interactionType ?? kind;
  return t.questions.types[type] ?? t.questions.kinds[kind] ?? t.questions.typeUnknown;
}
/** Listede kısa özet: "3 ifade", "2 boşluk" … */
export function structuredSummary(interactionType: string | null | undefined, payload: unknown): string {
  if (!isStructuredType(interactionType) || !isObj(payload)) return "";
  const n = {
    true_false: list(payload.statements).length,
    fill_blank: list(payload.segments).filter((x) => x.type === "blank").length,
    matching: list(payload.left).length,
    numeric: 1,
    ordering: list(payload.items).length,
    classification: list(payload.items).length,
  }[interactionType];
  return interactionType === "numeric" ? s.summary.numeric ?? "" : `${n} ${s.summary[interactionType] ?? ""}`;
}

export type AnswerKeyRow = { question_id: string; interaction_type: string; schema_version: number; key: unknown; policy: string; policy_version: number; points: number };
export function parseKeyRows(data: unknown): AnswerKeyRow[] {
  return Array.isArray(data) ? data.filter((r): r is AnswerKeyRow => isObj(r) && typeof r.question_id === "string") : [];
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{children}</span>
);

function PayloadView({ type, p }: { type: StructuredInteractionType; p: Obj }) {
  switch (type) {
    case "true_false":
      return (
        <ol className="list-decimal space-y-1 pl-5">
          {list(p.statements).map((x) => (
            <li key={text(x.id)}>
              <Chip>{text(x.id)}</Chip>
              {text(x.text)}
            </li>
          ))}
        </ol>
      );
    case "fill_blank":
      return (
        <div className="space-y-2">
          <p className="leading-8">
            {list(p.segments).map((g, i) =>
              g.type === "blank" ? (
                <span key={i} className="mx-1 inline-block min-w-16 rounded border-b-2 border-brand bg-brand-light px-2 text-center font-mono text-xs">
                  {text(g.id)}
                </span>
              ) : (
                <span key={i}>{text(g.text)}</span>
              ),
            )}
          </p>
          <p className="text-xs text-slate-500">
            {s.input[text(p.input)] ?? text(p.input)}
            {p.input === "bank" && p.bank_reuse ? ` · ${s.bankReuse}` : ""}
          </p>
          {p.input === "bank" ? (
            <p>
              <span className="mr-2 text-xs text-slate-500">{s.bank}:</span>
              {list(p.bank).map((w) => (
                <span key={text(w.id)} className="mr-2 inline-block rounded-full border border-slate-300 px-2 py-0.5">
                  <Chip>{text(w.id)}</Chip>
                  {text(w.text)}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      );
    case "matching":
      return (
        <div>
          <p className="mb-1 text-xs text-slate-500">{s.policy[text(p.policy)] ?? text(p.policy)}</p>
          <div className="grid grid-cols-2 gap-3">
            {(["left", "right"] as const).map((side) => (
              <div key={side}>
                <p className="label">{s[side]}</p>
                <ul className="space-y-1">
                  {list(p[side]).map((x) => (
                    <li key={text(x.id)} className="rounded border border-slate-200 px-2 py-1">
                      <Chip>{text(x.id)}</Chip>
                      {text(x.text)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    case "numeric":
      return (
        <p>
          {p.unit_required ? `${s.unitRequired}: ` : s.noUnit}
          {list(p.units).map((u) => (
            <Chip key={text(u.id)}>{text(u.text)}</Chip>
          ))}
          {p.work_area ? <span className="ml-2 text-xs text-slate-500">· {s.workArea}</span> : null}
        </p>
      );
    case "ordering":
      return (
        <div>
          <p className="mb-1 text-xs text-slate-500">
            {s.mode[text(p.mode)] ?? text(p.mode)} · {s.shuffledNote}
          </p>
          <ul className="flex flex-wrap gap-2">
            {list(p.items).map((x) => (
              <li key={text(x.id)} className="rounded border border-slate-200 px-2 py-1">
                <Chip>{text(x.id)}</Chip>
                {text(x.text)}
              </li>
            ))}
          </ul>
        </div>
      );
    case "classification":
      return (
        <div className="space-y-2">
          <p>
            <span className="label mr-2 inline">{s.categories}:</span>
            {list(p.categories).map((c) => (
              <span key={text(c.id)} className="mr-2 inline-block rounded bg-brand-light px-2 py-0.5">
                <Chip>{text(c.id)}</Chip>
                {text(c.text)}
                {typeof c.capacity === "number" ? ` (${s.capacity} ${c.capacity})` : ""}
              </span>
            ))}
          </p>
          <p>
            <span className="label mr-2 inline">{s.items}:</span>
            {list(p.items).map((x) => (
              <span key={text(x.id)} className="mr-2 inline-block rounded border border-slate-200 px-2 py-0.5">
                <Chip>{text(x.id)}</Chip>
                {text(x.text)}
              </span>
            ))}
          </p>
        </div>
      );
  }
}

function KeyView({ type, p, k }: { type: StructuredInteractionType; p: Obj; k: Obj }) {
  const label = (arr: unknown, id: unknown) => text(list(arr).find((x) => x.id === id)?.text) || text(id);
  const rows: [string, string][] = [];
  if (type === "true_false" && isObj(k.answers)) {
    for (const [id, v] of Object.entries(k.answers)) rows.push([label(p.statements, id), v === true ? s.true : v === false ? s.false : String(v)]);
  } else if (type === "fill_blank" && isObj(k.blanks)) {
    for (const [id, v] of Object.entries(k.blanks)) {
      const b = isObj(v) ? v : {};
      const answers = Array.isArray(b.tokens) ? b.tokens.map((x) => label(p.bank, x)) : Array.isArray(b.accepted) ? b.accepted.map(String) : [];
      rows.push([`${s.blank} ${id}`, answers.join(" | ")]);
    }
    if (k.case_insensitive) rows.push([s.caseInsensitive, "✓"]);
  } else if (type === "matching" && isObj(k.pairs)) {
    for (const [l, r] of Object.entries(k.pairs)) rows.push([label(p.left, l), label(p.right, r)]);
  } else if (type === "numeric") {
    rows.push([s.value, `${text(k.value)}${k.unit ? ` ${label(p.units, k.unit)}` : ""}`]);
    rows.push([s.tolerance, `${Number(k.abs_tolerance ?? 0)} / ${Number(k.rel_tolerance ?? 0)}`]);
    if (isObj(k.unit_factors)) rows.push([s.factors, Object.entries(k.unit_factors).map(([u, f]) => `${label(p.units, u)} = ${String(f)}`).join(", ")]);
    if (Number(k.unit_weight ?? 0) > 0) rows.push([s.unitWeight, String(k.unit_weight)]);
    if (k.process_required) rows.push([s.processRequired, "✓"]);
  } else if (type === "ordering" && Array.isArray(k.orders)) {
    k.orders.forEach((o, i) => rows.push([`${s.orders} ${i + 1}`, Array.isArray(o) ? o.map((x) => label(p.items, x)).join(" → ") : String(o)]));
  } else if (type === "classification" && isObj(k.membership)) {
    for (const [i, c] of Object.entries(k.membership)) rows.push([label(p.items, i), label(p.categories, c)]);
  }
  if (isObj(k.weights)) rows.push([s.weights, Object.entries(k.weights).map(([id, w]) => `${id}: ${String(w)}`).join(", ")]);
  if (!rows.length) return <pre className="overflow-x-auto text-xs">{JSON.stringify(k, null, 2)}</pre>;
  return (
    <table className="table">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i}>
            <td className="w-1/2">{a}</td>
            <td className="font-semibold">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StructuredQuestionPreview({
  questionId,
  interactionType,
  schemaVersion,
  payload,
}: {
  questionId: string;
  interactionType: string | null;
  schemaVersion: number | null;
  payload: unknown;
}) {
  const [key, setKey] = useState<{ state: "loading" | "ready" | "missing" | "error"; row?: AnswerKeyRow }>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    adminRpc("get_question_answer_keys", { p_question_ids: [questionId] }).then(
      (data) => {
        if (cancelled) return;
        const row = parseKeyRows(data).find((r) => r.question_id === questionId);
        setKey(row ? { state: "ready", row } : { state: "missing" });
      },
      () => !cancelled && setKey({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const known = isStructuredType(interactionType) && isObj(payload);
  const errors = key.row && interactionType ? questionContentErrors(interactionType, payload, key.row.key, schemaVersion ?? 1) : null;
  return (
    <div className="grid gap-3 md:col-span-2 md:grid-cols-2" data-testid="structured-preview">
      <section className="rounded-2xl border border-slate-200 p-3" aria-label={s.studentView}>
        <h3 className="label">
          {s.studentView} · {typeLabel("structured", interactionType)} · v{schemaVersion ?? "?"}
        </h3>
        {known ? <PayloadView type={interactionType} p={payload} /> : <pre className="overflow-x-auto text-xs">{JSON.stringify(payload, null, 2)}</pre>}
      </section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3" aria-label={s.privateKey}>
        <h3 className="label">{s.privateKey}</h3>
        {key.state === "loading" ? <p className="text-sm text-slate-500">{s.keyLoading}</p> : null}
        {key.state === "missing" ? <p className="text-sm text-red-700">{s.keyMissing}</p> : null}
        {key.state === "error" ? <p className="text-sm text-red-700">{s.keyError}</p> : null}
        {key.row ? (
          <>
            {known && isObj(key.row.key) ? (
              <KeyView type={interactionType} p={payload} k={key.row.key} />
            ) : (
              <pre className="overflow-x-auto text-xs">{JSON.stringify(key.row.key, null, 2)}</pre>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {s.points}: {key.row.points} · {s.policyVersion}: {key.row.policy}@{key.row.policy_version}
            </p>
          </>
        ) : null}
        {errors ? (
          errors.length ? (
            <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800" role="alert">
              {s.invalid}: {errors.join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-800">✓ {s.valid}</p>
          )
        ) : null}
      </section>
    </div>
  );
}
