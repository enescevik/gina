import { QuestionReports } from "@/components/question-reports";
import {
  LEGACY_INTERACTION_TYPES,
  PHASE2A_INTERACTION_TYPES,
  PHASE2B_INTERACTION_TYPES,
  STRUCTURED_INTERACTION_TYPES,
  type Database,
  type Json,
  type Tables,
} from "@gina/core";
import { useMemo, useState } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { useConfirm } from "@/components/confirm-dialog";
import { StructuredQuestionPreview, structuredSummary, typeLabel } from "@/components/structured-question-preview";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

type Question = Tables<"question_bank">;
type Difficulty = Database["public"]["Enums"]["question_difficulty"];

const PAGE = 50;
type Choice = { key: string; text: string };
/** C12 (B02): şıklar bilinen biçimdeyse ({key,text}[]) alan alan düzenlenir; JSON yalnız bilinmeyen biçimde. */
function readChoices(value: Json | null): Choice[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const out: Choice[] = [];
  for (const c of value) {
    if (!c || typeof c !== "object" || Array.isArray(c)) return null;
    const { key, text, ...rest } = c as Record<string, Json>;
    if (typeof key !== "string" || typeof text !== "string" || Object.keys(rest).length) return null;
    out.push({ key, text });
  }
  return out;
}
const DIFFICULTIES: Difficulty[] = ["kolay", "orta", "orta_ustu", "zor"];
/** QT: tür filtresi — eski türler `kind`, yapılandırılmış türler `interaction_type` sütunuyla süzülür. */
const TYPE_FILTERS: string[] = [...LEGACY_INTERACTION_TYPES, ...STRUCTURED_INTERACTION_TYPES, ...PHASE2A_INTERACTION_TYPES, ...PHASE2B_INTERACTION_TYPES];

function Editor({ q, onDone }: { q: Question; onDone: (text: string | null, err?: unknown) => void }) {
  const [draft, setDraft] = useState({
    grade: q.grade,
    subject: q.subject,
    topic: q.topic,
    difficulty: q.difficulty,
    stem: q.stem,
    choices: q.choices == null ? "" : JSON.stringify(q.choices, null, 2),
    correct_key: q.correct_key ?? "",
    expected_answer: q.expected_answer ?? "",
    solution: q.solution ?? "",
    explanation: q.explanation ?? "",
    source_urls: q.source_urls.join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const [rows, setRows] = useState<Choice[] | null>(() => readChoices(q.choices));
  const set = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch });
  // QT: yapılandırılmış soruda metin/içerik/anahtar içerik özetine (content_hash) bağlıdır; burada yalnız üst bilgi düzenlenir.
  const structured = q.kind === "structured";

  async function save() {
    let choices: Json | null = null;
    if (rows) {
      if (rows.some((r) => !r.text.trim())) {
        onDone(null, new Error("Bütün şıkları doldurun."));
        return;
      }
      choices = rows.map((r) => ({ key: r.key, text: r.text })) as Json;
    } else if (draft.choices.trim()) {
      try {
        choices = JSON.parse(draft.choices) as Json;
      } catch {
        onDone(null, new Error(t.questions.invalidJson));
        return;
      }
    }
    setBusy(true);
    const meta = {
      grade: draft.grade,
      subject: draft.subject.trim(),
      topic: draft.topic.trim(),
      difficulty: draft.difficulty,
      solution: draft.solution || null,
      explanation: draft.explanation || null,
      source_urls: draft.source_urls.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    if (structured) {
      const { error } = await supabase().from("question_bank").update(meta).eq("id", q.id).is("family_id", null);
      setBusy(false);
      onDone(error ? null : t.common.saved, error ?? undefined);
      return;
    }
    const { error } = await supabase()
      .from("question_bank")
      .update({
        grade: draft.grade,
        subject: draft.subject.trim(),
        topic: draft.topic.trim(),
        difficulty: draft.difficulty,
        stem: draft.stem,
        choices,
        correct_key: draft.correct_key.trim() || null,
        expected_answer: draft.expected_answer || null,
        solution: draft.solution || null,
        explanation: draft.explanation || null,
        source_urls: draft.source_urls.split("\n").map((s) => s.trim()).filter(Boolean),
      })
      .eq("id", q.id)
      .is("family_id", null);
    setBusy(false);
    onDone(error ? null : t.common.saved, error ?? undefined);
  }

  async function remove() {
    if (busy) return;
    if (!(await confirm.ask({ title: "Global soruyu sil", body: t.questions.confirmDelete, confirmLabel: t.common.delete, tone: "danger" }))) return;
    const { error } = await supabase().rpc("admin_delete_global_question", { p_question_id: q.id });
    onDone(error ? null : t.questions.deleted, error ?? undefined);
  }

  const area = (key: "stem" | "choices" | "expected_answer" | "solution" | "explanation" | "source_urls", label: string, rows = 3) => (
    <div className="md:col-span-2">
      <label className="label" htmlFor={`q-${key}`}>{label}</label>
      <textarea id={`q-${key}`} className={`input ${key === "choices" ? "font-mono" : ""}`} rows={rows} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </div>
  );

  return (
    <Card title={`${t.common.edit}: ${q.id}`}>
      {confirm.element}
      {q.times_asked > 0 ? (
        <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          Bu soru {fmtNumber(q.times_asked)} kez sorulmuş. Çocuk cevabı bulunan soruda metin, şık veya doğru cevap değişikliği sunucu tarafından reddedilir; yalnız anlatım, çözüm ve kaynak güncellenebilir.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid grid-cols-3 gap-2 md:col-span-2">
          <div>
            <label className="label" htmlFor="q-grade">{t.questions.grade}</label>
            <input id="q-grade" type="number" min={1} max={12} className="input" value={draft.grade} onChange={(e) => set({ grade: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="q-subject">{t.questions.subject}</label>
            <input id="q-subject" className="input" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="q-topic">{t.questions.topic}</label>
            <input id="q-topic" className="input" value={draft.topic} onChange={(e) => set({ topic: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="q-difficulty">{t.questions.difficulty}</label>
          <select id="q-difficulty" className="input" value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t.questions.difficulties[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t.questions.kind}</label>
          <p className="py-1.5 text-sm">{typeLabel(q.kind, q.interaction_type)}</p>
        </div>
        {structured ? (
          <>
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2">{t.questions.structured.readOnly}</p>
            <div className="md:col-span-2">
              <p className="label">{t.questions.stem}</p>
              <p className="whitespace-pre-wrap rounded border border-slate-200 p-2 text-sm">{q.stem}</p>
            </div>
            <StructuredQuestionPreview questionId={q.id} interactionType={q.interaction_type} schemaVersion={q.schema_version} payload={q.payload} />
          </>
        ) : (
          area("stem", t.questions.stem, 4)
        )}
        {structured ? null : q.kind === "multiple_choice" ? (
          <>
            {rows ? (
              <fieldset className="md:col-span-2">
                <legend className="label">{t.questions.choices} · {t.questions.correctKey}</legend>
                <div className="grid gap-2">
                  {rows.map((r, i) => (
                    <div key={r.key} className="flex items-center gap-3">
                      <label className="flex min-h-12 min-w-16 items-center gap-2 font-semibold">
                        <input type="radio" name="q-correct" className="h-5 w-5" checked={draft.correct_key === r.key} onChange={() => set({ correct_key: r.key })} aria-label={`${t.questions.correctKey}: ${r.key}`} />
                        {r.key}
                      </label>
                      <input className="input" aria-label={`${t.questions.choices} ${r.key}`} value={r.text} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                {area("choices", t.questions.choices, 6)}
                <div>
                  <label className="label" htmlFor="q-correct">{t.questions.correctKey}</label>
                  <input id="q-correct" className="input w-24" value={draft.correct_key} onChange={(e) => set({ correct_key: e.target.value })} />
                </div>
                <div />
              </>
            )}
          </>
        ) : (
          area("expected_answer", t.questions.expectedAnswer)
        )}
        {area("solution", t.questions.solution)}
        {area("explanation", t.questions.explanation)}
        {area("source_urls", t.questions.sourceUrls, 2)}
        <div className="md:col-span-2">
          <label className="label">{t.questions.provenance}</label>
          <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(q.provenance, null, 2)}</pre>
          <p className="mt-1 text-xs text-slate-500">
            {t.questions.timesAsked}: {fmtNumber(q.times_asked)} · {t.questions.updatedAt}: {fmtDateTime(q.updated_at)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn" disabled={busy} onClick={() => void save()}>
          {t.common.save}
        </button>
        <button className="btn-secondary" onClick={() => onDone(null)}>
          {t.common.close}
        </button>
        <button className="btn-danger ml-auto" onClick={() => void remove()}>
          {t.common.delete}
        </button>
      </div>
    </Card>
  );
}

export default function QuestionsPage() {
  const [grade, setGrade] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Question | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const facets = useAdminQuery(async () => unwrap(await supabase().rpc("admin_question_facets")));
  const list = useAdminQuery(async () => {
    let q = supabase()
      .from("question_bank")
      .select("*", { count: "exact" })
      .is("family_id", null)
      .order("grade")
      .order("subject")
      .order("topic")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (grade != null) q = q.eq("grade", grade);
    if (subject) q = q.eq("subject", subject);
    if (topic) q = q.eq("topic", topic);
    if (type) q = (LEGACY_INTERACTION_TYPES as readonly string[]).includes(type) ? q.eq("kind", type as Question["kind"]) : q.eq("interaction_type", type);
    const res = await q;
    return { rows: unwrap(res), count: res.count ?? 0 };
  }, [grade, subject, topic, type, limit]);

  const options = useMemo(() => {
    const f = facets.data ?? [];
    const grades = [...new Set(f.map((r) => r.grade))].sort((a, b) => a - b);
    const subjects = [...new Set(f.filter((r) => grade == null || r.grade === grade).map((r) => r.subject))].sort();
    const topics = [
      ...new Set(f.filter((r) => (grade == null || r.grade === grade) && (!subject || r.subject === subject)).map((r) => r.topic)),
    ].sort();
    return { grades, subjects, topics };
  }, [facets.data, grade, subject]);

  const onDone = (text: string | null, err?: unknown) => {
    if (err) {
      setMsg({ text: errorMessage(err, t.errors), tone: "error" });
      return;
    }
    if (text) setMsg({ text, tone: "ok" });
    setSelected(null);
    list.reload();
    facets.reload();
  };

  return (
    <Layout title={t.questions.title}>
      <QuestionReports />
      <p className="mb-4 text-sm text-slate-500">{t.questions.help}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {list.error ? <Notice tone="error">{errorMessage(list.error, t.errors)}</Notice> : null}

      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <select aria-label={t.questions.grade} className="input" value={grade ?? ""} onChange={(e) => { setGrade(e.target.value ? Number(e.target.value) : null); setSubject(""); setTopic(""); setLimit(PAGE); }}>
          <option value="">{`${t.questions.grade}: ${t.questions.all}`}</option>
          {options.grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select aria-label={t.questions.subject} className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(""); setLimit(PAGE); }}>
          <option value="">{`${t.questions.subject}: ${t.questions.all}`}</option>
          {options.subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select aria-label={t.questions.topic} className="input" value={topic} onChange={(e) => { setTopic(e.target.value); setLimit(PAGE); }}>
          <option value="">{`${t.questions.topic}: ${t.questions.all}`}</option>
          {options.topics.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select aria-label={t.questions.kind} className="input" value={type} onChange={(e) => { setType(e.target.value); setLimit(PAGE); }}>
          <option value="">{`${t.questions.kind}: ${t.questions.all}`}</option>
          {TYPE_FILTERS.map((k) => (
            <option key={k} value={k}>{t.questions.types[k]}</option>
          ))}
        </select>
      </div>

      {selected ? <Editor key={selected.id} q={selected} onDone={onDone} /> : null}

      <Card title={list.data ? `${fmtNumber(list.data.count)} ${t.questions.count}` : undefined}>
        {!list.data ? (
          <p className="text-slate-500">{t.common.loading}</p>
        ) : list.data.rows.length === 0 ? (
          <p className="text-sm text-slate-500">{t.questions.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.questions.grade}</th>
                  <th>{t.questions.subject}</th>
                  <th>{t.questions.topic}</th>
                  <th>{t.questions.stem}</th>
                  <th>{t.questions.kind}</th>
                  <th>{t.questions.difficulty}</th>
                  <th className="text-right">{t.questions.timesAsked}</th>
                  <th>{t.questions.provenance}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((q) => {
                  const prov = (q.provenance ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={q.id} className={selected?.id === q.id ? "bg-brand-light" : ""}>
                      <td>{q.grade}</td>
                      <td>{q.subject}</td>
                      <td>{q.topic}</td>
                      <td className="max-w-md">{q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem}</td>
                      <td>
                        {typeLabel(q.kind, q.interaction_type)}
                        {q.kind === "structured" ? (
                          <span className="block text-xs text-slate-500">{structuredSummary(q.interaction_type, q.payload)}</span>
                        ) : null}
                      </td>
                      <td>{t.questions.difficulties[q.difficulty]}</td>
                      <td className="text-right">{fmtNumber(q.times_asked)}</td>
                      <td className="text-xs text-slate-500">
                        {[prov.generator, prov.model, prov.prompt_version].filter(Boolean).map(String).join(" · ") || t.common.none}
                      </td>
                      <td>
                        <button className="btn-secondary" onClick={() => { setMsg(null); setSelected(q); window.scrollTo({ top: 0 }); }}>
                          {t.common.edit}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.data.rows.length < list.data.count ? (
              <button className="btn-secondary mt-3" onClick={() => setLimit(limit + PAGE)}>
                {t.questions.loadMore}
              </button>
            ) : null}
          </div>
        )}
      </Card>
    </Layout>
  );
}
