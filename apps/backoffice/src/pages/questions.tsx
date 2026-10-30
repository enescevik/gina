import type { Database, Json, Tables } from "@gina/core";
import { useMemo, useState } from "react";

import { Card, Layout, Notice } from "@/components/Layout";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { errorMessage, supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";

type Question = Tables<"question_bank">;
type Difficulty = Database["public"]["Enums"]["question_difficulty"];

const PAGE = 50;
const DIFFICULTIES: Difficulty[] = ["kolay", "orta", "orta_ustu", "zor"];

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
  const set = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch });

  async function save() {
    let choices: Json | null = null;
    if (draft.choices.trim()) {
      try {
        choices = JSON.parse(draft.choices) as Json;
      } catch {
        onDone(null, new Error(t.questions.invalidJson));
        return;
      }
    }
    setBusy(true);
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
    if (!window.confirm(t.questions.confirmDelete)) return;
    const { error } = await supabase().rpc("admin_delete_global_question", { p_question_id: q.id });
    onDone(error ? null : t.questions.deleted, error ?? undefined);
  }

  const area = (key: "stem" | "choices" | "expected_answer" | "solution" | "explanation" | "source_urls", label: string, rows = 3) => (
    <div className="md:col-span-2">
      <label className="label">{label}</label>
      <textarea className={`input ${key === "choices" ? "font-mono" : ""}`} rows={rows} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </div>
  );

  return (
    <Card title={`${t.common.edit}: ${q.id}`}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid grid-cols-3 gap-2 md:col-span-2">
          <div>
            <label className="label">{t.questions.grade}</label>
            <input type="number" min={1} max={12} className="input" value={draft.grade} onChange={(e) => set({ grade: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">{t.questions.subject}</label>
            <input className="input" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
          </div>
          <div>
            <label className="label">{t.questions.topic}</label>
            <input className="input" value={draft.topic} onChange={(e) => set({ topic: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">{t.questions.difficulty}</label>
          <select className="input" value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t.questions.difficulties[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t.questions.kind}</label>
          <p className="py-1.5 text-sm">{t.questions.kinds[q.kind]}</p>
        </div>
        {area("stem", t.questions.stem, 4)}
        {q.kind === "multiple_choice" ? (
          <>
            {area("choices", t.questions.choices, 6)}
            <div>
              <label className="label">{t.questions.correctKey}</label>
              <input className="input w-24" value={draft.correct_key} onChange={(e) => set({ correct_key: e.target.value })} />
            </div>
            <div />
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
    const res = await q;
    return { rows: unwrap(res), count: res.count ?? 0 };
  }, [grade, subject, topic, limit]);

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
      <p className="mb-4 text-sm text-slate-500">{t.questions.help}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {list.error ? <Notice tone="error">{errorMessage(list.error, t.errors)}</Notice> : null}

      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <select className="input" value={grade ?? ""} onChange={(e) => { setGrade(e.target.value ? Number(e.target.value) : null); setSubject(""); setTopic(""); setLimit(PAGE); }}>
          <option value="">{`${t.questions.grade}: ${t.questions.all}`}</option>
          {options.grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(""); setLimit(PAGE); }}>
          <option value="">{`${t.questions.subject}: ${t.questions.all}`}</option>
          {options.subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={topic} onChange={(e) => { setTopic(e.target.value); setLimit(PAGE); }}>
          <option value="">{`${t.questions.topic}: ${t.questions.all}`}</option>
          {options.topics.map((s) => (
            <option key={s} value={s}>{s}</option>
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
                      <td>{t.questions.kinds[q.kind]}</td>
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
