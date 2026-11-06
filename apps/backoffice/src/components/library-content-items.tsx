import { useCallback, useState } from "react";
import Link from "next/link";
import { prereviewStatus, prereviewStatusLabel } from "@gina/core";
import { useAuth } from "@/lib/auth";
import { type KeysetPage, useKeysetList } from "@/lib/keyset";
import { Notice } from "./Layout";
import {
  CandidateSourceBadge,
  type PrereviewKind,
  PrereviewBadge,
  PrereviewDecisionQueue,
  PrereviewGateNotice,
  prereviewKey,
  RequestPrereviewButton,
  useCandidateSources,
  usePrereviewGate,
  usePrereviews,
} from "./content-prereview";
import { adminRpc, fmtWhen, shortHash } from "./review-rpc";

// P05 birleşik içerik listesi + E01 AI ön inceleme rozeti. C07: `admin_library_content_page` ile gerçek
// keyset sayfalama (ilk 200 sınırı yok), AI süzgeci sunucuda, senaryo adayları da listede (AI rozetiyle).
// Yönetici kararı (durum / editoryal karar / canlı) ve AI ön incelemesi iki ayrı sütundur.

type ItemKind = "package" | "contribution_set" | "legacy_item" | "collection" | "legacy_contribution" | "curriculum_candidate";
type ItemStatus = "draft" | "reviewed" | "approved" | "published" | "withdrawn";
export type ContentItem = {
  kind: ItemKind;
  id: string;
  title: string | null;
  grade: number | null;
  subject: string | null;
  status: ItemStatus;
  version: number | null;
  publication_version: number | null;
  series_key: string | null;
  previous_id: string | null;
  parent_id: string | null;
  source_family_id: string | null;
  prereview_status: string | null;
  admin_decision: string | null;
  live: boolean;
  created_at: string;
  updated_at: string;
};

const kindLabels: Record<ItemKind, string> = {
  package: "Taslak paket",
  contribution_set: "Aile katkısı",
  legacy_item: "Koleksiyon sorusu",
  collection: "Koleksiyon",
  legacy_contribution: "Eski katkı",
  curriculum_candidate: "Senaryo adayı",
};
const statusLabels: Record<ItemStatus, string> = {
  draft: "Taslak · yönetici kararı bekliyor",
  reviewed: "İncelendi",
  approved: "Onaylandı · yayın değil",
  published: "Yayın kararı verildi",
  withdrawn: "Geri çekildi",
};
const decisionLabels: Record<string, string> = {
  suitable: "Editör: bütün sorular uygun",
  changes_requested: "Editör: düzeltme istendi",
  approved: "Yönetici kabul etti",
  rejected: "Yönetici reddetti",
};
const prereviewKindOf: Partial<Record<ItemKind, PrereviewKind>> = { package: "library_package", contribution_set: "contribution_set", curriculum_candidate: "curriculum_candidate" };
const PAGE = 50;

type Trail =
  | { kind: "contribution"; data: ContributionTrail }
  | { kind: "package"; data: PackageTrail };
type ContributionTrail = {
  chain_id: string;
  current: string | null;
  steps: {
    id: string;
    version: number;
    status: string;
    created_at: string;
    supersedes_id: string | null;
    title: string | null;
    question_count: number;
    decision: string | null;
    review_note: string | null;
    reviewed_at: string | null;
    package_id: string | null;
    package_status: string | null;
    prereview_status: string | null;
  }[];
};
type PackageTrail = {
  package_key: string;
  revisions: {
    id: string;
    revision: number;
    content_hash: string;
    created_at: string;
    status: ItemStatus;
    live: boolean;
    publication_version: number | null;
    prereview_status: string | null;
    questions: { key: string; outcome: string | null; note: string | null }[];
  }[];
};

function aiLabel(s: string | null) {
  const parsed = prereviewStatus.safeParse(s);
  return parsed.success ? prereviewStatusLabel(parsed.data, "tr") : "istenmedi";
}

const contributionStatus: Record<string, string> = {
  pending: "İnceleme bekliyor",
  approved: "Kabul edildi",
  rejected: "Reddedildi",
  withdrawn: "Geri çekildi",
  preparing: "Hazırlanıyor",
};

export function LibraryContentItems() {
  const [status, setStatus] = useState<"" | ItemStatus>("");
  const [kind, setKind] = useState<"" | ItemKind>("");
  const [ai, setAi] = useState<"" | "none" | "pending" | "ai_approved" | "needs_admin" | "ai_rejected_suggestion">("");
  const { isAdmin, roles } = useAuth();
  // İçerik ekibi AI kuyruğunu yönetir; yalnız yayın ekibi listeyi ve paket izini görür (yayın kararı ayrı ekranda).
  const canReview = isAdmin || roles.includes("content");
  const fetchPage = useCallback(
    (cursor: string | null) =>
      adminRpc<KeysetPage<ContentItem>>("admin_library_content_page", {
        p_kind: kind || null, p_status: status || null, p_prereview: ai || null, p_cursor: cursor, p_limit: PAGE,
      }),
    [kind, status, ai],
  );
  const items = useKeysetList(fetchPage, JSON.stringify([kind, status, ai]), (r) => r.kind + ":" + r.id);
  const prereviews = usePrereviews();
  const gate = usePrereviewGate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState<{ id: string; value: Trail | null; error: boolean } | null>(null);

  const rows = items.rows ?? [];
  // C09/C05: senaryo adayının kaynak sürümü/hedefi/güncelliği rozette; eski kaynak AI'ya gönderilmez.
  const candidateSources = useCandidateSources(rows.filter((r) => r.kind === "curriculum_candidate").map((r) => r.id));
  const blocked = !canReview || !gate.data || !!gate.data.reason;
  const reload = () => {
    items.reload();
    prereviews.reload();
  };

  async function requestSelected() {
    if (busy || blocked || !selected.size) return;
    setBusy(true);
    setBulk(null);
    let ok = 0, failed = 0;
    for (const key of selected) {
      const [k, id] = key.split(":");
      try {
        await adminRpc("request_content_prereview", { p_kind: k, p_id: id });
        ok++;
      } catch {
        failed++;
      }
    }
    setBulk({
      tone: failed ? "error" : "ok",
      text: `${ok} kayıt AI ön inceleme kuyruğuna alındı${failed ? `, ${failed} kayıt alınamadı` : ""}. AI işlemesi zamanlayıcıyla yapılır; yönetici kararı ve yayın değişmez.`,
    });
    setSelected(new Set());
    setBusy(false);
    reload();
  }
  async function enqueueAll() {
    if (busy || blocked) return;
    setBusy(true);
    setBulk(null);
    try {
      const r = await adminRpc<{ queued: number; requeued: number; unchanged: number }>("enqueue_content_prereview", { p_scope: "all" });
      setBulk({
        tone: "ok",
        text: `Yönetici kararı bekleyen kayıtlar: ${r.queued} yeni, ${r.requeued} içeriği değiştiği için yeniden, ${r.unchanged} değişmedi (yeni AI çağrısı yok).`,
      });
    } catch {
      setBulk({ tone: "error", text: "Toplu kuyruğa alma tamamlanamadı. Yetkinizi kontrol edip yeniden deneyin." });
    } finally {
      setBusy(false);
      reload();
    }
  }
  async function openTrail(item: ContentItem) {
    if (trail?.id === item.id) {
      setTrail(null);
      return;
    }
    setTrail({ id: item.id, value: null, error: false });
    try {
      const value: Trail = item.kind === "contribution_set"
        ? { kind: "contribution", data: await adminRpc<ContributionTrail>("contribution_review_trail", { p_id: item.id }) }
        : { kind: "package", data: await adminRpc<PackageTrail>("admin_library_package_trail", { p_package_id: item.id }) };
      setTrail({ id: item.id, value, error: false });
    } catch {
      setTrail({ id: item.id, value: null, error: true });
    }
  }

  return (
    <section aria-labelledby="content-items-title" className="grid gap-4">
      <div>
        <h2 id="content-items-title" className="text-xl font-bold">Tüm içerik ve AI ön incelemesi</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Taslak paketler, aile katkıları ve koleksiyonlar tek listede. <strong>Yönetici kararı</strong> ve{" "}
          <strong>AI ön incelemesi</strong> ayrı sütunlardadır: AI &quot;uygun&quot; dese bile içerik yayımlanmaz, hak vermez ve bağımsız
          eğitimci incelemesinin yerine geçmez. AI karar veremediğinde kayıt &quot;BEKLİYOR — yönetici kararı&quot; olarak kalır.
        </p>
      </div>
      {canReview ? <PrereviewDecisionQueue onShowQueue={() => setAi("needs_admin")} /> : null}
      {canReview ? <PrereviewGateNotice gate={gate.data} error={gate.error} /> : (
        <Notice>Yayın ekibi görünümü: AI ön inceleme isteği ve editoryal karar içerik ekibindedir. Paketlerin yayın önizlemesine buradan gidebilirsiniz.</Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label">
          Yönetici durumu
          <select className="input mt-2" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Tümü</option>
            {(Object.keys(statusLabels) as ItemStatus[]).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
        </label>
        <label className="label">
          Tür
          <select className="input mt-2" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="">Tümü</option>
            {(Object.keys(kindLabels) as ItemKind[]).map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
          </select>
        </label>
        <label className="label">
          AI ön inceleme
          <select className="input mt-2" value={ai} onChange={(e) => setAi(e.target.value as typeof ai)}>
            <option value="">Tümü</option>
            <option value="needs_admin">BEKLİYOR — yönetici kararı</option>
            <option value="ai_rejected_suggestion">AI ret önerdi</option>
            <option value="ai_approved">AI uygun buldu (yayın değil)</option>
            <option value="pending">Kuyrukta</option>
            <option value="none">İstenmedi</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canReview ? (
          <>
            <button type="button" className="btn-secondary" disabled={busy || blocked || !selected.size} onClick={() => void requestSelected()}>
              Seçilenler için AI ön incelemesi iste ({selected.size})
            </button>
            <button type="button" className="btn-secondary" disabled={busy || blocked} onClick={() => void enqueueAll()}>
              Karar bekleyen tümünü kuyruğa al
            </button>
          </>
        ) : null}
        <button type="button" className="btn-secondary" onClick={reload}>Listeyi yenile</button>
        {items.rows ? <span role="status" data-testid="content-count" className="text-sm text-slate-600">{rows.length} kayıt gösteriliyor{items.hasMore ? " · devamı var" : " · liste tamam"}</span> : null}
      </div>
      {bulk ? <Notice tone={bulk.tone}>{bulk.text}</Notice> : null}
      {items.error && !items.pageError ? <Notice tone="error">İçerik listesi okunamadı. Yetkinizi kontrol edip yeniden deneyin.</Notice> : null}
      {canReview && prereviews.error ? <Notice tone="error">AI ön inceleme kayıtları okunamadı; rozetler eksik olabilir.</Notice> : null}
      <div className="overflow-x-auto">
        <table className="table" aria-label="Kütüphane içerikleri">
          <thead>
            <tr>
              <th><span className="sr-only">Seç</span></th>
              <th>İçerik</th>
              <th>Yönetici kararı</th>
              <th>AI ön inceleme (ayrı kayıt)</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pk = prereviewKindOf[r.kind];
              const rec = pk ? prereviews.data?.get(prereviewKey(pk, r.id)) : undefined;
              const key = pk ? prereviewKey(pk, r.id) : "";
              return [
                <tr key={r.kind + r.id} data-testid="content-item" data-kind={r.kind}>
                  <td>
                    {pk && canReview
                      ? (
                        <input
                          type="checkbox"
                          aria-label={`${r.title ?? "İçerik"} seç`}
                          disabled={blocked}
                          checked={selected.has(key)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                            setSelected(next);
                          }}
                        />
                      )
                      : null}
                  </td>
                  <td className="min-w-[220px]">
                    <p className="font-bold">{r.title ?? "Başlıksız"}</p>
                    <p className="text-xs text-slate-600">
                      {kindLabels[r.kind]} · {r.grade ? `${r.grade}. sınıf` : "sınıf yok"} · {r.subject ?? "ders yok"} · sürüm {r.version ?? 1}
                      {r.publication_version ? ` · yayın sürümü ${r.publication_version}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">Güncelleme {fmtWhen(r.updated_at)}</p>
                    {r.kind === "curriculum_candidate" ? <CandidateSourceBadge source={candidateSources.data?.[r.id]} /> : null}
                  </td>
                  <td className="min-w-[200px]" data-testid="admin-decision">
                    <p className="font-semibold">{statusLabels[r.status]}</p>
                    {r.admin_decision ? <p className="text-xs">{decisionLabels[r.admin_decision] ?? r.admin_decision}</p> : <p className="text-xs text-slate-500">Yönetici kararı yok</p>}
                    <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${r.live ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                      {r.live ? "Ailelere açık" : "Ailelere açık değil"}
                    </p>
                  </td>
                  <td className="min-w-[240px]" data-testid="ai-cell" data-ai={r.prereview_status ?? "none"}>
                    {!pk
                      ? <span className="text-xs text-slate-500">Bu tür AI ön incelemesine girmez</span>
                      : rec || !r.prereview_status
                      ? <PrereviewBadge record={rec} compact />
                      : <span className="text-sm font-semibold">AI ön inceleme · {aiLabel(r.prereview_status)}</span>}
                  </td>
                  <td className="min-w-[200px]">
                    <div className="grid gap-2">
                      {pk && canReview ? <RequestPrereviewButton kind={pk} id={r.id} gate={gate.data} onDone={() => prereviews.reload()} /> : null}
                      {r.kind === "curriculum_candidate"
                        ? isAdmin
                          ? <Link className="btn-secondary text-center" href={{ pathname: "/library", query: { tab: "curriculum" } }}>Senaryo incelemesinde aç</Link>
                          : <span className="text-xs text-slate-500">Senaryo kararı yönetici ekranında verilir.</span>
                        : null}
                      {r.kind === "package"
                        ? <Link className="btn-secondary text-center" href={{ pathname: "/library-publication", query: { packageId: r.id } }}>Yayın önizlemesi</Link>
                        : null}
                      {r.kind === "package" || r.kind === "contribution_set"
                        ? (
                          <button type="button" className="btn-secondary" aria-expanded={trail?.id === r.id} onClick={() => void openTrail(r)}>
                            {r.kind === "contribution_set" ? "Ret → düzeltme izini göster" : "Sürüm izini göster"}
                          </button>
                        )
                        : null}
                    </div>
                  </td>
                </tr>,
                trail?.id === r.id
                  ? (
                    <tr key={"trail" + r.id}>
                      <td />
                      <td colSpan={4}>
                        {rec ? <div className="mb-3 max-w-2xl"><PrereviewBadge record={rec} /></div> : null}
                        <TrailView trail={trail} />
                      </td>
                    </tr>
                  )
                  : null,
              ];
            })}
          </tbody>
        </table>
      </div>
      {items.rows && !rows.length ? <p className="py-4 text-slate-500">Bu filtreyle içerik yok.</p> : null}
      {items.pageError ? <Notice tone="error">Sonraki sayfa okunamadı; yüklenen kayıtlar korunuyor. Yeniden deneyin.</Notice> : null}
      {items.hasMore ? (
        <button type="button" className="btn-secondary justify-self-start" data-testid="content-more" disabled={items.loading} onClick={() => void items.loadMore()}>
          {items.loading ? "Yükleniyor…" : `Sonraki ${PAGE} kaydı yükle`}
        </button>
      ) : null}
    </section>
  );
}

function TrailView({ trail }: { trail: { value: Trail | null; error: boolean } }) {
  if (trail.error) return <Notice tone="error">İz okunamadı. Kayıt silinmiş veya yetkiniz değişmiş olabilir.</Notice>;
  if (!trail.value) return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  if (trail.value.kind === "contribution") {
    const t = trail.value.data;
    return (
      <div data-testid="contribution-trail">
        <h3 className="mb-2 font-bold">Ret → düzeltme → yeniden inceleme zinciri</h3>
        <ol className="grid gap-2">
          {t.steps.map((s) => (
            <li key={s.id} className={`rounded-xl border p-3 text-sm ${s.id === t.current ? "border-brand bg-brand-light" : "border-slate-200"}`}>
              <p className="font-bold">
                {s.version}. kopya · {contributionStatus[s.status] ?? s.status}
                {s.id === t.current ? " · güncel kopya" : ""}
                {s.supersedes_id ? " · önceki reddedilen kopyanın düzeltmesi" : ""}
              </p>
              <p>{s.title ?? "Başlıksız"} · {s.question_count} soru · gönderim {fmtWhen(s.created_at)}</p>
              <p>
                Yönetici kararı: {s.decision ? (s.decision === "approved" ? "kabul" : "ret") : "yok"}
                {s.reviewed_at ? ` (${fmtWhen(s.reviewed_at)})` : ""}
                {s.review_note ? ` · not: “${s.review_note}”` : ""}
              </p>
              <p className="text-xs">
                AI ön inceleme (ayrı): {aiLabel(s.prereview_status)}
                {s.package_id ? ` · taslak paket: ${s.package_status ?? "?"}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const p = trail.value.data;
  return (
    <div data-testid="package-trail">
      <h3 className="mb-2 font-bold">Paket sürümleri · {p.package_key}</h3>
      <ol className="grid gap-2">
        {p.revisions.map((r) => {
          const changes = r.questions.filter((q) => q.outcome === "changes_requested");
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-bold">
                Sürüm {r.revision} · {statusLabels[r.status]} · {r.live ? "ailelere açık" : "ailelere açık değil"}
                {r.publication_version ? ` · yayın sürümü ${r.publication_version}` : ""}
              </p>
              <p>
                Özet <code>{shortHash(r.content_hash)}</code> · {fmtWhen(r.created_at)} · editör: {r.questions.filter((q) => q.outcome === "suitable").length}/{r.questions.length} uygun
                {changes.length ? ` · ${changes.length} düzeltme istendi` : ""}
              </p>
              {changes.map((q) => <p key={q.key} className="text-xs">• {q.key}: {q.note ?? "not yok"}</p>)}
              <p className="text-xs">AI ön inceleme (ayrı): {aiLabel(r.prereview_status)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
