import { useRef, useState } from "react";
import { Notice } from "@/components/Layout";
import { useAdminQuery } from "@/lib/use-async";
import { s04Rpc } from "@/components/s04-rpc";

/**
 * C11 — ders eşanlamlısı yönetimi. Ekleme yalnız "yönetici" satırı üretir; kaynaktan gelen satırlar silinmez,
 * yalnız öneriden kaldırılır / yeniden açılır. Her değişiklik gerekçe ister; sunucuda sürüm kontrolü (CAS),
 * istek makbuzu ve denetim kaydıyla yazılır. Eşanlamlı yalnız aday üretir: veli onayı olmadan ders bağlanmaz.
 */
type SynonymRow = {
  subject_id: string;
  alias: string;
  alias_normalized: string;
  grade_min: number;
  grade_max: number;
  source: "catalog" | "policy_ambiguity" | "admin";
  active: boolean;
  revision: number;
};
type SynonymChange = {
  id: number;
  alias_normalized: string;
  grade_min: number;
  action: "add" | "update" | "deactivate" | "reactivate";
  note: string;
  created_at: string;
};
const sourceLabel: Record<SynonymRow["source"], string> = {
  catalog: "Katalog kaynağı",
  policy_ambiguity: "Belirsizlik kuralı",
  admin: "Yönetici ekledi",
};
const actionLabel: Record<SynonymChange["action"], string> = {
  add: "Eklendi",
  update: "Düzenlendi",
  deactivate: "Öneriden kaldırıldı",
  reactivate: "Yeniden açıldı",
};
const gradeText = (g: number) => (g === 0 ? "Okul öncesi" : `${g}. sınıf`);

function readRows(value: unknown): SynonymRow[] {
  if (!Array.isArray(value)) throw new Error("unexpected_synonyms");
  return value.filter((r): r is SynonymRow =>
    !!r && typeof r === "object" &&
    typeof (r as SynonymRow).alias_normalized === "string" &&
    typeof (r as SynonymRow).revision === "number"
  );
}
function readChanges(value: unknown): SynonymChange[] {
  if (!Array.isArray(value)) throw new Error("unexpected_history");
  return value as SynonymChange[];
}
function errorText(e: unknown) {
  const m = (e as { message?: string }).message ?? "";
  if (m.includes("synonym_exists")) {
    return "Bu ders için aynı ad, çakışan sınıf aralığında zaten var.";
  }
  if (m.includes("synonym_changed") || m.includes("request_conflict")) {
    return "Kayıt başka bir işlemle değişti. Liste yenilendi; yeniden deneyin.";
  }
  if (m.includes("synonym_source_locked")) {
    return "Kaynaktan gelen eşanlamlı düzenlenemez; yalnız öneriden kaldırılabilir.";
  }
  if (m.includes("subject_unknown")) return "Ders kaydı etkin değil.";
  if (m.includes("synonym_invalid")) {
    return "Ad, sınıf aralığı veya gerekçe geçersiz (gerekçe en az 10 karakter).";
  }
  return "Kaydedilemedi. Bağlantıyı kontrol edip yeniden deneyin.";
}

export function SubjectSynonymEditor(
  { subjectId, subjectLabel, onChanged }: {
    subjectId: string;
    subjectLabel: string;
    onChanged: () => void;
  },
) {
  const rows = useAdminQuery(
    async () =>
      readRows(await s04Rpc("admin_subject_synonyms")).filter((r) =>
        r.subject_id === subjectId
      ),
    [subjectId],
  );
  const history = useAdminQuery(
    async () =>
      readChanges(
        await s04Rpc("admin_subject_synonym_changes", {
          p_subject_id: subjectId,
        }),
      ),
    [subjectId],
  );
  const [alias, setAlias] = useState(""),
    [min, setMin] = useState("1"),
    [max, setMax] = useState("12"),
    [note, setNote] = useState(""),
    [target, setTarget] = useState<SynonymRow | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  // Aynı niyet yeniden denenirse aynı istek kimliği gider (kayıp yanıt → aynı sonuç, çift kayıt yok).
  const pending = useRef<{ key: string; id: string } | null>(null);
  function requestId(args: unknown) {
    const key = JSON.stringify(args);
    if (pending.current?.key !== key) {
      pending.current = { key, id: crypto.randomUUID() };
    }
    return pending.current.id;
  }
  async function send(args: Record<string, unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = (await s04Rpc("admin_save_subject_synonym", {
        ...args,
        p_request: requestId(args),
      })) as { shared_with?: string[] };
      pending.current = null;
      setMessage(
        done +
          (r.shared_with?.length
            ? ` Bu ad ${r.shared_with.length} başka derste de var; veliye seçenek olarak gösterilir.`
            : ""),
      );
      setAlias("");
      setNote("");
      setTarget(null);
      rows.reload();
      history.reload();
      onChanged();
    } catch (e) {
      setError(errorText(e));
      if (/changed|conflict/.test((e as { message?: string }).message ?? "")) {
        pending.current = null;
        setTarget(null);
        rows.reload();
      }
    } finally {
      setBusy(false);
    }
  }
  const noteOk = note.trim().length >= 10;
  return (
    <section
      aria-label={`${subjectLabel} eşanlamlıları`}
      className="mt-4 rounded-3xl border border-violet-100 bg-[#FCFAF6] p-5"
    >
      <h3 className="font-bold">{subjectLabel} · eşanlamlıları yönet</h3>
      <p className="mt-1 text-sm">
        Eşanlamlılar velinin yazdığı ders adına aday önerir; veli onaylamadan
        bağlanmaz. Kaynaktan gelen satırlar silinmez, yalnız öneriden
        kaldırılabilir. Her değişiklik gerekçesiyle kaydedilir.
      </p>
      {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
      {message ? <div className="mt-3"><Notice>{message}</Notice></div> : null}
      {rows.loading && !rows.data ? <p className="mt-3">Yükleniyor…</p> : null}
      {rows.error ? (
        <div className="mt-3">
          <Notice tone="error">
            Eşanlamlılar yüklenemedi.{" "}
            <button type="button" className="btn-secondary" onClick={rows.reload}>
              Yeniden dene
            </button>
          </Notice>
        </div>
      ) : null}
      <ul className="mt-3 grid gap-2" aria-label="Eşanlamlı satırları">
        {(rows.data ?? []).map((r) => (
          <li
            key={`${r.alias_normalized}:${r.grade_min}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white p-3"
          >
            <span className={r.active ? "min-w-0 break-words" : "min-w-0 break-words text-slate-500"}>
              <span className={r.active ? "font-semibold" : "font-semibold line-through"}>{r.alias}</span>{" "}
              <span className="text-sm">
                · {gradeText(r.grade_min)}–{gradeText(r.grade_max)} · {sourceLabel[r.source]}
                {r.active ? "" : " · öneride değil"}
              </span>
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              aria-label={`${r.alias} ${r.active ? "öneriden kaldır" : "yeniden aç"}`}
              onClick={() => {
                setTarget(r);
                setNote("");
                setMessage("");
              }}
            >
              {r.active ? "Öneriden kaldır" : "Yeniden aç"}
            </button>
          </li>
        ))}
      </ul>
      {target
        ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold">
              “{target.alias}” {target.active ? "öneriden kaldırılacak" : "yeniden açılacak"}
            </p>
            <label className="mt-2 block">
              Gerekçe (en az 10 karakter)
              <textarea
                className="input mt-2 min-h-20 w-full"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn"
                disabled={busy || !noteOk}
                onClick={() =>
                  void send({
                    p_action: target.active ? "deactivate" : "reactivate",
                    p_subject_id: target.subject_id,
                    p_alias: null,
                    p_grade_min: null,
                    p_grade_max: null,
                    p_key: {
                      alias_normalized: target.alias_normalized,
                      subject_id: target.subject_id,
                      grade_min: target.grade_min,
                    },
                    p_revision: target.revision,
                    p_note: note.trim(),
                  }, target.active ? "Eşanlamlı öneriden kaldırıldı." : "Eşanlamlı yeniden açıldı.")}
              >
                {busy ? "Kaydediliyor…" : "Onayla"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                Vazgeç
              </button>
            </div>
          </div>
        )
        : (
          <form
            className="mt-4 grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!alias.trim() || !noteOk) return;
              void send({
                p_action: "add",
                p_subject_id: subjectId,
                p_alias: alias.trim(),
                p_grade_min: Number(min),
                p_grade_max: Number(max),
                p_key: null,
                p_revision: null,
                p_note: note.trim(),
              }, "Eşanlamlı eklendi.");
            }}
          >
            <label className="md:col-span-2">
              Yeni eşanlamlı
              <input
                className="input mt-2 w-full"
                maxLength={80}
                value={alias}
                placeholder="ör. Mat. Uyg."
                onChange={(e) => setAlias(e.target.value)}
              />
            </label>
            <label>
              En küçük sınıf
              <select className="input mt-2 w-full" value={min} onChange={(e) => setMin(e.target.value)}>
                {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{gradeText(i)}</option>)}
              </select>
            </label>
            <label>
              En büyük sınıf
              <select className="input mt-2 w-full" value={max} onChange={(e) => setMax(e.target.value)}>
                {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{gradeText(i)}</option>)}
              </select>
            </label>
            <label className="md:col-span-4">
              Gerekçe (kaynak / okul belgesi; en az 10 karakter)
              <textarea
                className="input mt-2 min-h-20 w-full"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="md:col-span-4">
              <button
                className="btn"
                disabled={busy || !alias.trim() || !noteOk || Number(max) < Number(min)}
              >
                {busy ? "Kaydediliyor…" : "Eşanlamlı ekle"}
              </button>
            </div>
          </form>
        )}
      <h4 className="mt-5 font-semibold">Değişiklik geçmişi</h4>
      {!history.data?.length
        ? <p className="text-sm">Bu derste yönetici değişikliği yok.</p>
        : (
          <ul className="mt-2 grid gap-1 text-sm">
            {history.data.map((h) => (
              <li key={h.id} className="break-words">
                {new Date(h.created_at).toLocaleString("tr-TR")} · {actionLabel[h.action]} ·{" "}
                <span className="font-semibold">{h.alias_normalized}</span> ({gradeText(h.grade_min)}) — {h.note}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
