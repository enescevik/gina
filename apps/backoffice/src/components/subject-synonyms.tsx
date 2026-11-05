import { type FormEvent, useState } from "react";
import {
  groupSubjectSynonyms,
  readSubjectSuggestion,
  type SubjectSuggestion,
  subjectSynonymSchema,
} from "@gina/core";
import { Notice } from "@/components/Layout";
import { useAdminQuery } from "@/lib/use-async";
import { s04Rpc } from "@/components/s04-rpc";

/** Ders kimliği → eşanlamlılar. Yalnız okuma; eşanlamlılar migration ile kaynaktan gelir. */
export function useSubjectSynonyms(enabled: boolean) {
  return useAdminQuery(async () => {
    if (!enabled) return null;
    const rows = subjectSynonymSchema.array().parse(
      await s04Rpc("admin_subject_synonyms"),
    );
    return groupSubjectSynonyms(rows);
  }, [enabled]);
}

export function SynonymChips(
  { items }: {
    items: { alias: string; grades: string; ambiguity: boolean }[] | undefined;
  },
) {
  const [open, setOpen] = useState(false);
  if (!items?.length) {
    return <p className="mt-2 text-sm">Eşanlamlı yok.</p>;
  }
  const shown = open ? items : items.slice(0, 6);
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold">
        Eşanlamlılar ({items.length})
      </p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Eşanlamlılar">
        {shown.map((s) => (
          <li
            key={s.alias}
            className={`rounded-full border px-3 py-1 text-sm ${
              s.ambiguity
                ? "border-amber-200 bg-amber-50"
                : "border-violet-100 bg-[#F6F2FD]"
            }`}
            title={s.ambiguity
              ? "Belirsiz etiket: veliye birden fazla aday gösterilir"
              : undefined}
          >
            {s.alias}{" "}
            <span className="text-xs text-slate-600">· {s.grades}</span>
          </li>
        ))}
      </ul>
      {items.length > 6
        ? (
          <button
            type="button"
            className="mt-2 min-h-12 text-sm font-semibold text-[#6042DE] underline"
            onClick={() => setOpen(!open)}
          >
            {open ? "Daha az göster" : `Tümünü göster (${items.length})`}
          </button>
        )
        : null}
    </div>
  );
}

/** Yöneticinin velinin göreceği eşleşme önerisini denediği alan. Hiçbir kayda yazmaz. */
export function SubjectMatchTester() {
  const [text, setText] = useState(""),
    [grade, setGrade] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<SubjectSuggestion | null>(null);
  async function run(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResult(readSubjectSuggestion(
        await s04Rpc("suggest_subject", {
          p_text: text.trim(),
          p_grade: grade === "" ? null : Number(grade),
        }),
      ));
    } catch {
      setResult(null);
      setError("Öneri alınamadı. Metni kısaltıp yeniden deneyin.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Ders eşleştirme denemesi"
      className="mb-5 rounded-3xl border border-violet-100 bg-[#FCFAF6] p-5"
    >
      <h3 className="font-bold">Veli ne yazarsa hangi ders önerilir?</h3>
      <p className="mt-1 text-sm">
        Ders programı ve ödev girişinde yazılan kısaltma, sınıfa göre aday
        derslere eşlenir. Tek aday olsa bile veli onaylamadan bağlanmaz;
        eşleşme yoksa velinin yazdığı ad olduğu gibi kalır.
      </p>
      <form
        onSubmit={(e) => void run(e)}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-0 flex-1">
          Yazılan ders adı
          <input
            className="input mt-2 w-full"
            maxLength={80}
            value={text}
            placeholder="ör. Fen Bil., MAT, Din"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label>
          Çocuğun sınıfı
          <select
            className="input mt-2"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">Bilinmiyor</option>
            <option value="0">Okul öncesi</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}. sınıf</option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={busy || !text.trim()}>
          {busy ? "Bakılıyor…" : "Önerileri göster"}
        </button>
      </form>
      {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
      {result
        ? (
          <div className="mt-4" aria-live="polite">
            <p className="font-semibold">
              {result.match === "none"
                ? "Eşleşme yok — veli etiketi olduğu gibi saklanır."
                : result.match === "single"
                ? "Tek aday — veliye öneri olarak gösterilir, onayı beklenir."
                : `${result.candidates.length} aday — veliye seçtirilir.`}
            </p>
            {result.scope_note
              ? (
                <p className="mt-1 text-sm">
                  Bu ders genelde başka sınıflarda okutulur; veliye not olarak
                  söylenir, engellenmez.
                </p>
              )
              : null}
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {result.candidates.map((c) => (
                <li
                  key={c.subject_id}
                  className="rounded-2xl border border-violet-100 bg-white p-3"
                >
                  <span className="font-bold">{c.label_tr}</span>
                  <span className="block text-sm">
                    {c.grade_min}–{c.grade_max}. sınıf ·{" "}
                    {c.in_grade_scope ? "sınıfa uygun" : "sınıf kapsamı dışında"}{" "}
                    · “{c.matched_alias}”
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
        : null}
    </section>
  );
}
