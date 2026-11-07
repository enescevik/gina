import {
  isPhase2aType,
  isPhase2bType,
  isStructuredType,
  questionContentErrors,
  type Phase2aInteractionType,
  type Phase2bInteractionType,
  type StructuredInteractionType,
} from "@gina/core";
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
/** Önizlemesi olan türler: 1A/1B + Faz 2A + Faz 2B. Diğerleri (ör. bulmaca) ham JSON ile gösterilir. */
type PreviewType = StructuredInteractionType | Phase2aInteractionType | Phase2bInteractionType;
const isPreviewType = (v: unknown): v is PreviewType => typeof v === "string" && (isStructuredType(v) || isPhase2aType(v) || isPhase2bType(v));

export function typeLabel(kind: string, interactionType: string | null | undefined): string {
  const type = interactionType ?? kind;
  return t.questions.types[type] ?? t.questions.kinds[kind] ?? t.questions.typeUnknown;
}
/** Listede kısa özet: "3 ifade", "2 boşluk" … */
export function structuredSummary(interactionType: string | null | undefined, payload: unknown): string {
  if (!isPreviewType(interactionType) || !isObj(payload)) return "";
  const n: Record<PreviewType, number> = {
    true_false: list(payload.statements).length,
    fill_blank: list(payload.segments).filter((x) => x.type === "blank").length,
    matching: list(payload.left).length,
    numeric: 1,
    ordering: list(payload.items).length,
    classification: list(payload.items).length,
    mark_text: list(payload.segments).filter((x) => typeof x.id === "string").length,
    error_fix: list(payload.segments).filter((x) => typeof x.id === "string").length,
    multi_choice: list(payload.options).length,
    two_stage: 2,
    region_select: list(payload.regions).length,
    clock: 1,
  };
  const base = interactionType === "numeric" || interactionType === "clock" ? s.summary[interactionType] ?? "" : `${n[interactionType]} ${s.summary[interactionType] ?? ""}`;
  return isObj(payload.stimulus) ? `${base} · ${s.stimulusKind[text(payload.stimulus.kind)] ?? ""}` : base;
}

export type AnswerKeyRow = { question_id: string; interaction_type: string; schema_version: number; key: unknown; policy: string; policy_version: number; points: number };
export function parseKeyRows(data: unknown): AnswerKeyRow[] {
  return Array.isArray(data) ? data.filter((r): r is AnswerKeyRow => isObj(r) && typeof r.question_id === "string") : [];
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{children}</span>
);

function StimulusView({ st }: { st: Obj }) {
  return (
    <figure className="mb-3 rounded border border-slate-200 bg-slate-50 p-2 text-sm" data-testid="stimulus-preview">
      {st.caption ? <figcaption className="mb-1 font-semibold">{text(st.caption)}</figcaption> : null}
      {st.kind === "table" ? (
        <table className="table">
          <thead>
            <tr>{(Array.isArray(st.columns) ? st.columns : []).map((c, i) => <th key={i}>{String(c)}</th>)}</tr>
          </thead>
          <tbody>
            {(Array.isArray(st.rows) ? st.rows : []).map((r, i) => (
              <tr key={i}>{(Array.isArray(r) ? r : []).map((c, j) => <td key={j}>{String(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-1">
          {list(st.bars).map((b, i) => {
            const max = Math.max(1, ...list(st.bars).map((x) => Number(x.value) || 0));
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate">{text(b.label)}</span>
                <span className="h-3 rounded bg-brand" style={{ width: `${(100 * (Number(b.value) || 0)) / max}%`, maxWidth: "60%" }} />
                <span className="text-xs">{String(b.value)}{st.unit ? ` ${text(st.unit)}` : ""}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">{s.alt}: {text(st.alt)}</p>
    </figure>
  );
}
const Options = ({ items }: { items: unknown }) => (
  <ul className="space-y-1">
    {list(items).map((x) => (
      <li key={text(x.id)} className="rounded border border-slate-200 px-2 py-1">
        <Chip>{text(x.id)}</Chip>
        {text(x.text)}
      </li>
    ))}
  </ul>
);
const Segments = ({ p }: { p: Obj }) => (
  <p className="leading-8">
    {list(p.segments).map((g, i) =>
      typeof g.id === "string" ? (
        <span key={i} className="rounded border-b-2 border-dotted border-brand px-0.5" title={g.id}>{text(g.text)}</span>
      ) : (
        <span key={i}>{text(g.text)}</span>
      ),
    )}
  </p>
);

function PayloadView({ type, p }: { type: PreviewType; p: Obj }) {
  const stimulus = isObj(p.stimulus) ? <StimulusView st={p.stimulus} /> : null;
  return (
    <>
      {stimulus}
      <PayloadBody type={type} p={p} />
    </>
  );
}
function PayloadBody({ type, p }: { type: PreviewType; p: Obj }) {
  switch (type) {
    case "mark_text":
    case "error_fix":
      return (
        <div>
          <p className="mb-1 text-xs text-slate-500">
            {s.unit[text(p.unit)] ?? text(p.unit)}
            {typeof p.max_select === "number" ? ` · ${s.maxSelect} ${p.max_select}` : ""}
          </p>
          <Segments p={p} />
        </div>
      );
    case "multi_choice":
      return (
        <div>
          <p className="mb-1 text-xs text-slate-500">{typeof p.select_count === "number" ? `${s.selectCount}: ${p.select_count}` : s.selectCountHidden}</p>
          <Options items={p.options} />
        </div>
      );
    case "two_stage": {
      const s1 = isObj(p.stage1) ? p.stage1 : {}, s2 = isObj(p.stage2) ? p.stage2 : {};
      return (
        <div className="space-y-2">
          <p className="label">1 · {text(s1.prompt)}</p>
          <Options items={s1.options} />
          <p className="label">2 · {text(s2.prompt)} <span className="text-xs font-normal text-slate-500">({s.stageMode[text(s2.mode)] ?? text(s2.mode)})</span></p>
          {s2.mode === "choice" ? <Options items={s2.options} /> : null}
        </div>
      );
    }
    case "region_select": {
      const f = isObj(p.figure) ? p.figure : {};
      const regions = list(p.regions);
      return (
        <div>
          <p className="mb-1 text-xs text-slate-500">
            {s.figure[text(f.kind)] ?? text(f.kind)}
            {f.kind === "grid" ? ` ${String(f.rows)}×${String(f.cols)}` : ""}
            {typeof p.max_select === "number" ? ` · ${s.maxSelect} ${p.max_select}` : ""}
          </p>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${f.kind === "grid" && typeof f.cols === "number" ? f.cols : Math.min(6, regions.length)}, minmax(0, 1fr))` }}>
            {regions.map((r) => (
              <div key={text(r.id)} className="rounded border border-slate-300 p-1 text-center text-xs">
                <Chip>{text(r.id)}</Chip>
                {text(r.text)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "clock":
      return (
        <p>
          {s.clockMode[text(p.mode)] ?? text(p.mode)} · {s.clockDisplay[text(p.display)] ?? text(p.display)} · {s.step} {String(p.step_minutes)} {s.minutes}
          {p.shown_time ? <span className="ml-2 rounded bg-slate-100 px-2 font-mono">{text(p.shown_time)}</span> : null}
        </p>
      );
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

function KeyView({ type, p, k }: { type: PreviewType; p: Obj; k: Obj }) {
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
  } else if (type === "mark_text" && Array.isArray(k.targets)) {
    rows.push([s.targets, k.targets.map((x) => label(p.segments, x)).join(", ")]);
  } else if (type === "error_fix" && isObj(k.errors)) {
    for (const [id, v] of Object.entries(k.errors)) rows.push([label(p.segments, id), (isObj(v) && Array.isArray(v.accepted) ? v.accepted.map(String) : []).join(" | ")]);
    rows.push([s.fixPolicy, text(k.fix_policy) || "review_unmatched"]);
    if (typeof k.find_weight === "number") rows.push([s.findWeight, String(k.find_weight)]);
    if (k.case_insensitive) rows.push([s.caseInsensitive, "✓"]);
  } else if (type === "multi_choice" && Array.isArray(k.correct)) {
    rows.push([s.correct, k.correct.map((x) => label(p.options, x)).join(", ")]);
  } else if (type === "two_stage") {
    rows.push(["1", label(isObj(p.stage1) ? p.stage1.options : [], k.stage1)]);
    rows.push(["2", k.stage2 === undefined ? s.parentScores : label(isObj(p.stage2) ? p.stage2.options : [], k.stage2)]);
  } else if (type === "region_select") {
    if (typeof k.count === "number") rows.push([s.regionCount, `${k.count} / ${list(p.regions).length}`]);
    if (Array.isArray(k.targets)) rows.push([s.targets, k.targets.map((x) => label(p.regions, x)).join(", ")]);
  } else if (type === "clock") {
    rows.push([s.value, text(k.time)]);
    if (k.accept_12h) rows.push([s.accept12h, "✓"]);
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

  const known = isPreviewType(interactionType) && isObj(payload);
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
