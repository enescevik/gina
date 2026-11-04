import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  curriculumBundleSchema,
  type CurriculumCommand,
  curriculumCommandSchema,
  curriculumDetailSchema,
  type CurriculumReview,
  curriculumReviewSchema,
  curriculumRowSchema,
  type Json,
} from "@gina/core";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { unwrap, useAdminQuery } from "@/lib/use-async";
import { createLibraryQueue } from "@/lib/library-review";
import { Card, Notice } from "./Layout";

const statuses = {
  draft: "Kaynak incelemesi bekliyor",
  reviewed: "İncelendi · henüz açık değil",
  published: "Katalogda açık",
  withdrawn: "Geri çekildi",
};
type ReviewForm =
  & Omit<
    CurriculumReview,
    "source_checked" | "counts_checked" | "applicability_checked"
  >
  & {
    source_checked: boolean;
    counts_checked: boolean;
    applicability_checked: boolean;
  };
const emptyReview = (): ReviewForm => ({
  programme: "",
  school_scope: "",
  programme_url: "",
  issues_resolution: "",
  note: "",
  source_checked: false,
  counts_checked: false,
  applicability_checked: false,
});
function reasonLabel(reason: string) {
  if (reason === "source_review_required") {
    return "Özgün dosya ve hücreler karşılaştırılmalı.";
  }
  if (reason === "programme_and_school_scope_required") {
    return "Program sürümü ve okul kapsamı doğrulanmalı.";
  }
  if (reason === "uncoded_source_instruction") {
    return "Kaynakta kodu olmayan yönerge var; kod uydurulmamalı.";
  }
  if (reason === "wording_conflict") {
    return "Aynı çıktı kodunun farklı metinleri var; tema bağlamı incelenmeli.";
  }
  return "Kaynak uyarısı: " + reason;
}
export function CurriculumReviewPanel() {
  const { session } = useAuth();
  return session
    ? <Workspace key={session.user.id} user={session.user.id} />
    : null;
}
function Workspace({ user }: { user: string }) {
  const router = useRouter();
  const queue = useMemo(
    () =>
      createLibraryQueue(
        user,
        "curriculum",
        (v) => curriculumCommandSchema.parse(v),
      ),
    [user],
  );
  const [pending, setPending] = useState<CurriculumCommand | null>(null),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [bundle, setBundle] = useState<
      ReturnType<typeof curriculumBundleSchema.parse> | null
    >(null),
    [filename, setFilename] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<
      { id: string; revision: number; form: ReviewForm } | null
    >(null);
  const [grade, setGrade] = useState(""),
    [subject, setSubject] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  const [confirmed, setConfirmed] = useState(false),
    [decisionNote, setDecisionNote] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const live = useRef(true), fileGeneration = useRef(0);
  useEffect(() => {
    live.current = true;
    const sequence = fileGeneration;
    return () => {
      live.current = false;
      sequence.current++;
    };
  }, []);
  useEffect(() => {
    let active = true;
    queue.restore().then((value) => {
      if (active) {
        setPending(value);
        if (value && value.action !== "import") setSelected(value.id);
        setReady(true);
      }
    }).catch(() => {
      if (active) {
        setBlocked(true);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [queue]);
  const list = useAdminQuery(async () =>
    curriculumRowSchema.array().parse(
      unwrap(await supabase().rpc("admin_list_curriculum_candidates")),
    )
  );
  const detail = useAdminQuery(
    async () =>
      selected
        ? curriculumDetailSchema.parse(
          unwrap(
            await supabase().rpc("admin_get_curriculum_candidate", {
              p_id: selected,
            }),
          ),
        )
        : null,
    [selected],
  );
  const current = !list.error && !detail.error && !detail.loading &&
      detail.data?.id === selected
    ? detail.data
    : null;
  const form = draft && current && draft.id === current.id
    ? draft.form
    : current?.review ? {...current.review, ...(current.status === "withdrawn" ? {source_checked:false, counts_checked:false, applicability_checked:false} : {})} : emptyReview();
  const stale = !!draft && !!current && draft.revision !== current.revision;
  const dirty = !!draft || !!bundle || !!decisionNote;
  const locked = busy || !!pending || blocked || !ready;
  const guard = useRef({ dirty, busy });
  useEffect(() => {
    guard.current = { dirty, busy };
  }, [dirty, busy]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (guard.current.dirty || guard.current.busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const request = (e: Event) => {
      if (!guard.current.dirty && !guard.current.busy) return;
      e.preventDefault();
      if (!guard.current.busy) {
        setLeave(() => (e as CustomEvent<() => void>).detail);
      }
    };
    const navigate = (href: string) => {
      guard.current.dirty = false;
      void router.push(href);
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (
        !a || a.target === "_blank" || e.defaultPrevented || e.button !== 0 ||
        e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
        (!guard.current.dirty && !guard.current.busy)
      ) return;
      e.preventDefault();
      e.stopPropagation();
      if (!guard.current.busy) setLeave(() => () => navigate(a.href));
    };
    router.beforePopState(({ as }) => {
      if (!guard.current.dirty && !guard.current.busy) return true;
      window.history.pushState(window.history.state, "", router.asPath);
      if (!guard.current.busy) setLeave(() => () => navigate(as));
      return false;
    });
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gina:library-leave", request);
    window.addEventListener("gina:signout", request);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gina:library-leave", request);
      window.removeEventListener("gina:signout", request);
      document.removeEventListener("click", click, true);
      router.beforePopState(() => true);
    };
  }, [router]);
  useEffect(() => {
    if (leave && !dialog.current?.open) dialog.current?.showModal();
    else if (!leave) dialog.current?.close();
  }, [leave]);
  function patch(value: Partial<ReviewForm>) {
    if (current) {
      setDraft({
        id: current.id,
        revision: current.revision,
        form: { ...form, ...value },
      });
      setConfirmed(false);
    }
  }
  function choose(id: string) {
    const go = () => {
      setSelected(id);
      setDraft(null);
      setBundle(null);
      setFilename("");
      setDecisionNote("");
      setConfirmed(false);
      setMessage("");
    };
    if (dirty) setLeave(() => go);
    else go();
  }
  async function openFile(file: File | null) {
    if (!file || locked) return;
    const generation = ++fileGeneration.current;
    setMessage("");
    try {
      if (file.size > 5_000_000) throw Error("size");
      const parsed = curriculumBundleSchema.parse(
        JSON.parse(await file.text()),
      );
      if (live.current && fileGeneration.current === generation) {
        setBundle(parsed);
        setFilename(file.name);
      }
    } catch {
      if (live.current && fileGeneration.current === generation) {
        setBundle(null);
        setFilename("");
        setMessage(
          "Dosya doğrulanamadı. En çok 5 MB olan GINA kaynak inceleme dosyasını seçin. Dosya yüklenmedi.",
        );
      }
    }
  }
  async function send(command: CurriculumCommand) {
    if (busy || blocked || !ready) return;
    setBusy(true);
    setMessage("");
    try {
      command = curriculumCommandSchema.parse(command);
      if (!pending) {
        await queue.prepare(command);
        if (!live.current) return;
        setPending(command);
      }
      let response;
      if (command.action === "import") {
        response = await supabase().rpc("admin_import_curriculum_candidates", {
          p_request_id: command.request,
          p_bundle: command.bundle as unknown as Json,
        }).abortSignal(AbortSignal.timeout(30000));
      } else {response = await supabase().rpc(
          "admin_change_curriculum_candidate",
          {
            p_request_id: command.request,
            p_id: command.id,
            p_revision: command.revision,
            p_action: command.action,
            p_review: command.action === "review"
              ? command.review as unknown as Json
              : null,
            p_note: command.action === "review"
              ? command.review.note
              : command.note,
            p_confirmed: true,
          },
        ).abortSignal(AbortSignal.timeout(20000));}
      if (response.error) {
        if (/^(P0001|22\w{3}|23\w{3})$/.test(response.error.code ?? "")) {
          await queue.acknowledge(command.request);
          if (live.current) setPending(null);
        }
        throw response.error;
      }
      const result = response.data;
      if (
        !result || typeof result !== "object" || Array.isArray(result) ||
        result.request !== command.request || result.action !== command.action
      ) throw Error("uncertain");
      if (command.action === "import") {
        if (
          typeof result.created !== "number" ||
          typeof result.existing !== "number" ||
          !Number.isInteger(result.created) ||
          !Number.isInteger(result.existing) || result.created < 0 ||
          result.existing < 0 ||
          result.total !== command.bundle.candidates.length ||
          result.created + result.existing !== result.total
        ) throw Error("uncertain");
      } else if (
        result.id !== command.id || result.revision !== command.revision + 1 ||
        result.status !==
          ({
            review: "reviewed",
            publish: "published",
            withdraw: "withdrawn",
          } as const)[command.action]
      ) throw Error("uncertain");
      await queue.acknowledge(command.request);
      if (!live.current) return;
      setPending(null);
      setDraft(null);
      setBundle(null);
      setFilename("");
      setDecisionNote("");
      setConfirmed(false);
      setMessage(
        command.action === "import"
          ? `${result.created} yeni aday alındı; ${result.existing} kayıt zaten vardı. Hiçbiri kendiliğinden incelenmiş veya yayımlanmış sayılmadı.`
          : command.action === "review"
          ? "Kaynak incelemesi kaydedildi. Aile kataloğuna açma ayrı adımdır."
          : command.action === "publish"
          ? "Katalog kaydı açıldı. Genel özellik kapalıysa ailelere henüz görünmez. Okulun seçimi ayrıca doğrulanır."
          : "Katalog kaydı geri çekildi. Ailelerin geçmiş kayıtları silinmedi.",
      );
      list.reload();
      detail.reload();
    } catch (e) {
      if (live.current) {
        const code = (e as Error)?.message;
        setMessage(
          code === "curriculum_revision_conflict"
            ? "Başka bir inceleme kaydı değiştirdi. Yenileyip güncel kayıtla devam edin."
            : code === "curriculum_source_changed"
            ? "Aynı dosya kimliğinde farklı içerik var. Kaynağı düzeltmeden üzerine yazılamaz."
            : "İşlem doğrulanamadı. Bekleyen kayıt varsa aynı işlemle kontrol edin; aksi durumda alanları ve yetkinizi kontrol edin.",
        );
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  const rows = (list.data ?? []).filter((r) =>
    (!grade || r.grade === Number(grade)) &&
    (!subject || r.subject === subject) && (!status || r.status === status)
  );
  const subjects = [...new Set((list.data ?? []).map((r) => r.subject))].sort((
    a,
    b,
  ) => a.localeCompare(b, "tr"));
  const candidate = current?.candidate;
  const reviewValid = curriculumReviewSchema.safeParse(form).success;
  return (
    <section
      className={"library-drafts curriculum-review" +
        (selected ? " has-candidate" : "")}
    >
      <div className="library-intro">
        <div>
          <h2>Senaryo kaynakları</h2>
          <p>
            Kaynağı kontrol et → incelemeyi kaydet → ayrı kararla kataloğa aç.
          </p>
        </div>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            list.reload();
            detail.reload();
          }}
        >
          Yenile
        </button>
      </div>
      <Notice>
        Bu bölüm tam müfredat değildir. Okulun uyguladığı program ve seçtiği
        senaryo ayrıca doğrulanır. Dosya içe almak hiçbir kaydı onaylamaz.
      </Notice>
      {message ? <Notice>{message}</Notice> : null}
      {blocked
        ? (
          <Notice tone="error">
            Bu tarayıcıda işlem kaydı açılamıyor. Yinelenen karar oluşturmamak
            için gönderim durduruldu.
          </Notice>
        )
        : null}
      {pending
        ? (
          <Notice>
            <p>
              Önceki işlemin sonucu belirsiz. Aynı kimlik ve içerikle kontrol
              edelim.
            </p>
            <button
              className="btn"
              disabled={busy || blocked}
              onClick={() => void send(pending)}
            >
              Aynı işlemi kontrol et
            </button>
          </Notice>
        )
        : null}
      <details className="my-5 rounded-3xl border border-[#e5dcf3] bg-white p-5">
        <summary className="cursor-pointer font-bold">
          Kaynak inceleme dosyası ekle
        </summary>
        <p className="my-3">
          GINA biçimindeki kaynak adaylarını seçin. Özgün metin, dosya özeti ve
          hücre bağlantıları korunur. Dosya seçmek sunucuya göndermez.
        </p>
        <input
          className="block max-w-full py-3"
          type="file"
          accept=".json,application/json"
          aria-label="Kaynak inceleme dosyası"
          disabled={locked}
          onChange={(e) => void openFile(e.target.files?.[0] ?? null)}
        />
        {bundle
          ? (
            <div className="my-3">
              <p>
                {filename} · {bundle.candidates.length} aday · 0 otomatik onay
              </p>
              <button
                className="btn mt-3"
                disabled={locked}
                onClick={() =>
                  void send({
                    request: crypto.randomUUID(),
                    action: "import",
                    bundle,
                  })}
              >
                Adayları inceleme kuyruğuna al
              </button>
            </div>
          )
          : null}
      </details>
      {list.error || detail.error
        ? (
          <Notice tone="error">
            Kaynaklar veya yetkiniz doğrulanamadı. Önceki içerik gizlendi;
            yeniden deneyin.
          </Notice>
        )
        : null}
      {!list.error
        ? (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <label className="label">
                Sınıf<select
                  className="input"
                  aria-label="Sınıf"
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tüm sınıflar</option>
                  {Array.from({ length: 8 }, (_, i) => i + 5).map((g) => (
                    <option key={g} value={g}>{g}. sınıf</option>
                  ))}
                </select>
              </label>
              <label className="label">
                Ders<select
                  className="input"
                  aria-label="Ders"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tüm dersler</option>
                  {subjects.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="label">
                Durum<select
                  className="input"
                  aria-label="Durum"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tüm durumlar</option>
                  {Object.entries(statuses).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid min-w-0 gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
              <aside aria-label="Senaryo adayları" className="space-y-3">
                <p>
                  {list.loading
                    ? "Kaynaklar yükleniyor…"
                    : `${rows.length} kayıt`}
                </p>
                {!list.loading && !rows.length
                  ? (
                    <Card title="Henüz kayıt yok">
                      <p>
                        İnceleme dosyası ekleyin veya filtreleri genişletin.
                      </p>
                    </Card>
                  )
                  : null}
                {current && !rows.slice(page * 15, (page + 1) * 15).some(r => r.id === current.id) ? <div className="rounded-2xl border border-brand bg-brand-light p-4" aria-label="Seçili senaryo"><small>Seçili kayıt</small><strong className="block">{current.subject} · {current.grade}. sınıf</strong><span>{current.label} · {current.term}. dönem · {current.exam}. yazılı</span></div> : null}
                {rows.slice(page * 15, (page + 1) * 15).map((r) => (
                  <button
                    key={r.id}
                    className={"w-full rounded-2xl border p-4 text-left " +
                      (selected === r.id
                        ? "border-brand bg-brand-light"
                        : "border-slate-200 bg-white")}
                    disabled={locked}
                    onClick={() => choose(r.id)}
                  >
                    <strong className="block">
                      {r.subject} · {r.grade}. sınıf
                    </strong>
                    <span className="block">
                      {r.label} · {r.question_count} soru
                    </span>
                    <span className="block text-sm">
                      {r.academic_year} · {r.term}. dönem · {r.exam}. yazılı
                    </span>
                    <span className="block text-sm">{statuses[r.status]}</span>
                  </button>
                ))}
                <div className="flex gap-2">
                  <button
                    className="btn-secondary"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Önceki
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={(page + 1) * 15 >= rows.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sonraki
                  </button>
                </div>
              </aside>
              <div className="min-w-0 space-y-5 curriculum-detail">
                {current && candidate
                  ? (
                    <>
                      <Card
                        title={`${candidate.subject} · ${candidate.grade}. sınıf · ${candidate.label}`}
                      >
                        <p>
                          {candidate.academic_year} · {candidate.term}. dönem ·
                          {" "}
                          {candidate.exam}. yazılı · {candidate.question_count}
                          {" "}
                          soru
                        </p>
                        <p className="my-3 font-bold">
                          {statuses[current.status]}
                        </p>
                        <a
                          className="btn-secondary inline-flex"
                          href={candidate.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Özgün kaynak dosyasını aç ↗
                        </a>
                        <p className="mt-3 text-sm">
                          Sayfa: {candidate.sheet} · Senaryo başlığı:{" "}
                          {candidate.header_cell}
                        </p>
                        <details className="my-3">
                          <summary>Dosya ve kayıt sürümü</summary>
                          <p className="break-all text-sm">
                            Kaynak SHA-256: {candidate.source_sha256}
                          </p>
                          <p className="break-all text-sm">
                            Kayıt: {current.content_hash} · İnceleme sürümü:
                            {" "}
                            {current.revision}
                          </p>
                        </details>
                        <div className="my-4 rounded-2xl bg-[#f0e9fb] p-4">
                          <strong>İnceleme noktaları</strong>
                          <ul className="list-disc pl-5">
                            {candidate.review_reasons.map((r) => (
                              <li key={r}>{reasonLabel(r)}</li>
                            ))}
                          </ul>
                        </div>
                        {candidate.blocks.map((b, i) => (
                          <section
                            key={i}
                            className="my-3 rounded-2xl border border-[#e5dcf3] p-4"
                          >
                            <h3>{b.count} soru · Dağılım {i + 1}</h3>
                            <p className="text-sm">
                              Soru adedi hücresi: {b.count_cell}
                            </p>
                            {b.outcomes.map((o, j) => (
                              <div key={j} className="mt-3">
                                <strong>
                                  {o.code ?? "Kaynakta çıktı kodu yok"}
                                </strong>
                                <p>{o.text}</p>
                                <p className="text-sm">
                                  Metin hücresi: {o.cell}
                                </p>
                              </div>
                            ))}
                          </section>
                        ))}
                      </Card>
                      {stale
                        ? (
                          <Notice tone="error">
                            <p>
                              Bu düzenleme eski sürüme ait. Alanlarınız
                              korunuyor; yeni sürümün üzerine kaydedemezsiniz.
                            </p>
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                setDraft(null);
                                setConfirmed(false);
                                setDecisionNote("");
                                setMessage("");
                              }}
                            >
                              Güncel incelemeyi aç
                            </button>
                          </Notice>
                        )
                        : null}
                      <Card title="Kaynak ve kapsam incelemesi">
                        <p>
                          Özgün dosya ile program sayfasını açarak
                          karşılaştırın. İnceleme belirsizlikleri çözmeden onay
                          vermeyin.
                        </p>
                        <fieldset
                          disabled={locked || stale ||
                            current.status === "published"}
                          className="mt-4 space-y-4"
                        >
                          <label className="label">
                            Program adı ve sürümü<input
                              className="input"
                              aria-label="Program adı ve sürümü"
                      value={form.programme}
                              maxLength={160}
                              onChange={(e) =>
                                patch({
                                  programme: e.target.value,
                                  applicability_checked: false,
                                })}
                            />
                          </label>
                          <label className="label">
                            Geçerli okul türü, dal veya kapsam<textarea
                              className="input"
                              aria-label="Geçerli okul türü, dal veya kapsam"
                      value={form.school_scope}
                              maxLength={500}
                              onChange={(e) =>
                                patch({
                                  school_scope: e.target.value,
                                  applicability_checked: false,
                                })}
                            />
                          </label>
                          <label className="label">
                            Resmî program sayfası<input
                              className="input"
                              type="url"
                              aria-label="Resmî program sayfası"
                      value={form.programme_url}
                              maxLength={2000}
                              onChange={(e) =>
                                patch({
                                  programme_url: e.target.value,
                                  applicability_checked: false,
                                })}
                            />
                          </label>
                          <label className="label">
                            Uyarılar nasıl çözüldü?<textarea
                              className="input min-h-28"
                              aria-label="Uyarılar nasıl çözüldü?"
                      value={form.issues_resolution}
                              maxLength={4000}
                              onChange={(e) =>
                                patch({
                                  issues_resolution: e.target.value,
                                  source_checked: false,
                                })}
                            />
                          </label>
                          <label className="label">
                            İnceleme gerekçesi<textarea
                              className="input"
                              aria-label="İnceleme gerekçesi"
                      value={form.note}
                              maxLength={2000}
                              onChange={(e) => patch({ note: e.target.value })}
                            />
                          </label>
                          {([[
                            "source_checked",
                            "Dosya, hücreler ve tüm öğrenme çıktıları kaynakla aynı.",
                          ], [
                            "counts_checked",
                            "Soru dağılımı ve toplam adet doğru; ortak bloklar çoğaltılmadı.",
                          ], [
                            "applicability_checked",
                            "Program sürümünü, okul kapsamını ve uyarı çözümlerini doğruladım.",
                          ]] as const).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex min-h-12 items-center gap-3"
                            >
                              <input
                                type="checkbox"
                                checked={form[key]}
                                onChange={(e) =>
                                  patch({ [key]: e.target.checked })}
                              />
                              {label}
                            </label>
                          ))}
                          <button
                            className="btn"
                            disabled={!reviewValid}
                            onClick={() =>
                              void send({
                                request: crypto.randomUUID(),
                                action: "review",
                                id: current.id,
                                revision: current.revision,
                                review: curriculumReviewSchema.parse(form),
                              })}
                          >
                            İncelemeyi kaydet
                          </button>
                        </fieldset>
                      </Card>
                      {current.status === "reviewed" ||
                          current.status === "published"
                        ? (
                          <Card
                            title={current.status === "published"
                              ? "Katalogdan geri çek"
                              : "Kataloğa açmadan önce"}
                          >
                            <p>
                              Kaynak incelemesi, GINA sorularının pedagojik
                              onayı veya okulun senaryo seçimi değildir. Okulun
                              seçtiği kapsamı veli ayrıca doğrulamalıdır.
                            </p>
                            <label className="label mt-4">
                              Karar gerekçesi<textarea
                                className="input"
                                aria-label="Karar gerekçesi"
                      value={decisionNote}
                                maxLength={2000}
                                disabled={locked}
                                onChange={(e) => {
                                  setDecisionNote(e.target.value);
                                  setConfirmed(false);
                                }}
                              />
                            </label>
                            <label className="my-4 flex min-h-12 items-center gap-3">
                              <input
                                type="checkbox"
                                checked={confirmed}
                                disabled={locked}
                                onChange={(e) => setConfirmed(e.target.checked)}
                              />
                              {current.status === "published"
                                ? "Yeni seçimlerden kaldırılacağını, geçmişin silinmeyeceğini anladım."
                                : "Kaydedilmiş incelemeyi esas alarak bu sürümü kataloğa açıyorum."}
                            </label>
                            <button
                              className="btn"
                              disabled={locked || !!draft || !confirmed ||
                                !decisionNote.trim()}
                              onClick={() =>
                                void send({
                                  request: crypto.randomUUID(),
                                  action: current.status === "published"
                                    ? "withdraw"
                                    : "publish",
                                  id: current.id,
                                  revision: current.revision,
                                  note: decisionNote,
                                  confirmed: true,
                                })}
                            >
                              {current.status === "published"
                                ? "Kaydı geri çek"
                                : "Bu sürümü kataloğa aç"}
                            </button>
                          </Card>
                        )
                        : null}
                    </>
                  )
                  : (
                    <Card
                      title={detail.loading && selected
                        ? "Kaynak açılıyor…"
                        : "Bir senaryo seçin"}
                    >
                      <p>
                        Önce özgün kaynak ve soru dağılımı; ardından program
                        kapsamı ve gerekçeli inceleme.
                      </p>
                    </Card>
                  )}
              </div>
            </div>
          </>
        )
        : null}
      <dialog
        ref={dialog}
        aria-label="Kaydedilmemiş kaynak incelemesi"
        onCancel={() => setLeave(null)}
        className="max-w-md rounded-3xl bg-[#fffdf9] p-7 backdrop:bg-black/30"
      >
        <h3>İncelemeden çıkılsın mı?</h3>
        <p className="my-4">
          Gönderilmemiş düzenlemeler ve seçilen dosya kaldırılır. Gönderilen
          belirsiz işlemin kaydı korunur.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => setLeave(null)}>
            Burada kal
          </button>
          <button
            className="btn"
            onClick={() => {
              const go = leave;
              setLeave(null);
              setDraft(null);
              setBundle(null);
              setDecisionNote("");
              guard.current.dirty = false;
              go?.();
            }}
          >
            Düzenlemeleri bırak
          </button>
        </div>
      </dialog>
    </section>
  );
}
