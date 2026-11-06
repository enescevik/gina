import { useState } from "react";
import { adminRpc } from "@/lib/admin-rpc";
import { parseArticle } from "@/lib/help-article-structure";
import { useSupportQuery } from "@/lib/use-support-query";
import {
  assignTicket,
  cannedReplies,
  type IdeaStage,
  ideaStages,
  loadMeta,
  loadOperators,
  opsError,
  relatedArticles,
  setIdeaStage,
  waitingLabel,
  waitingOverdue,
} from "@/lib/support-ops";

/**
 * Sorumlu, bekleme süresi ve (fikirde) ürün durumu + benzer fikir bağı.
 * Atama ve fikir durumu görüşme revizyonunu değiştirmez: yazılan taslak bozulmaz.
 * Bu bilgiler veliye gösterilmez (aile RPC'leri bu alanları döndürmez).
 */
export function TicketPanel(
  { id, locked, onChanged }: {
    id: string;
    locked: boolean;
    onChanged: () => void;
  },
) {
  const [tick, setTick] = useState(0);
  const meta = useSupportQuery(() => loadMeta(id), id + ":meta:" + tick);
  const operators = useSupportQuery(loadOperators, "operators");
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const m = meta.data;
  async function run(action: () => Promise<unknown>, done: string) {
    if (busy || locked) return;
    setBusy(true);
    setNote(null);
    try {
      await action();
      setNote({ text: done, error: false });
      onChanged();
    } catch (error) {
      setNote({ text: opsError(error), error: true });
    } finally {
      setBusy(false);
      setTick((n) => n + 1);
    }
  }
  if (meta.error) {
    return (
      <div className="support-notice error" role="alert">
        <p>Sorumlu ve bekleme bilgisi yüklenemedi.</p>
        <button className="btn-secondary" onClick={meta.reload}>
          Yeniden dene
        </button>
      </div>
    );
  }
  if (!m) return <p className="support-ops-loading">Sorumlu bilgisi yükleniyor…</p>;
  const me = operators.data?.find((o) => o.is_me);
  const wait = waitingLabel(m.waiting_since);
  return (
    <div className="support-ops" data-testid="support-ops">
      <div className="support-ops-row">
        <span
          className={"support-chip " +
            (wait && waitingOverdue(m.waiting_since) ? "status-overdue" : "")}
          data-testid="support-waiting"
        >
          {wait ? `Veli ${wait} bekliyor` : "Veli yanıt beklemiyor"}
        </span>
        <label className="support-ops-assign">
          Sorumlu
          <select
            className="input"
            data-testid="support-assignee"
            value={m.assignee_id ?? ""}
            disabled={busy || locked || !operators.data}
            onChange={(e) => {
              const next = e.target.value || null;
              void run(
                () => assignTicket(id, m.assignee_id, next),
                next ? "Sorumlu kaydedildi." : "Sorumlu kaldırıldı.",
              );
            }}
          >
            <option value="">Sorumlusuz</option>
            {m.assignee_id &&
                !operators.data?.some((o) => o.id === m.assignee_id)
              ? (
                <option value={m.assignee_id}>
                  {(m.assignee_label ?? "Ekip üyesi") + " (yetkisi bitti)"}
                </option>
              )
              : null}
            {operators.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label + (o.is_me ? " (siz)" : "")}
              </option>
            ))}
          </select>
        </label>
        {me && m.assignee_id !== me.id
          ? (
            <button
              className="btn-secondary"
              data-testid="support-assign-me"
              disabled={busy || locked}
              onClick={() =>
                void run(
                  () => assignTicket(id, m.assignee_id, me.id),
                  "Görüşme size atandı.",
                )}
            >
              Bana ata
            </button>
          )
          : null}
      </div>
      {m.kind === "idea" ? <IdeaControls meta={m} busy={busy || locked} run={run} /> : null}
      {note
        ? (
          <p
            className={"support-ops-note" + (note.error ? " error" : "")}
            role={note.error ? "alert" : "status"}
          >
            {note.text}
          </p>
        )
        : null}
    </div>
  );
}

function IdeaControls(
  { meta, busy, run }: {
    meta: NonNullable<Awaited<ReturnType<typeof loadMeta>>>;
    busy: boolean;
    run: (a: () => Promise<unknown>, done: string) => Promise<void>;
  },
) {
  const expected = { stage: meta.idea_stage, similar: meta.similar_to };
  const stage = (meta.idea_stage ?? "new") as IdeaStage;
  return (
    <div className="support-ops-idea" data-testid="idea-controls">
      <label>
        Fikir durumu
        <select
          className="input"
          data-testid="idea-stage"
          value={stage}
          disabled={busy}
          onChange={(e) =>
            void run(
              () =>
                setIdeaStage(meta.id, expected, {
                  stage: e.target.value as IdeaStage,
                  similar: meta.similar_to,
                }),
              "Fikir durumu kaydedildi.",
            )}
        >
          {Object.entries(ideaStages).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <p className="support-ops-hint">
        Fikir durumu yalnız ekip içindir; aileye otomatik mesaj gitmez. Destek
        talepleri fikir listesine taşınamaz.
      </p>
      <h3>Benzer fikirler</h3>
      {meta.similar.length === 0
        ? <p className="support-ops-hint">Benzer başlıklı fikir bulunmadı.</p>
        : (
          <ul className="support-similar" data-testid="idea-similar">
            {meta.similar.map((s) => (
              <li key={s.id}>
                <span>
                  {s.subject}
                  {s.idea_stage ? ` · ${ideaStages[s.idea_stage]}` : ""}
                  {s.linked ? " · bağlı" : ""}
                </span>
                {s.id === meta.similar_to
                  ? (
                    <button
                      className="support-link"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            setIdeaStage(meta.id, expected, {
                              stage,
                              similar: null,
                            }),
                          "Benzer fikir bağı kaldırıldı.",
                        )}
                    >
                      Bağı kaldır
                    </button>
                  )
                  : !s.linked
                  ? (
                    <button
                      className="support-link"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            setIdeaStage(meta.id, expected, {
                              stage,
                              similar: s.id,
                            }),
                          "Benzer fikir olarak bağlandı.",
                        )}
                    >
                      Bununla bağla
                    </button>
                  )
                  : null}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

type Article = { id: string; title: string; body: string };
/**
 * Hazır yanıt ve ilgili yardım yazısı: yalnız açık görüşmenin "Aileye yanıt"
 * taslağına eklenir, kendiliğinden gönderilmez. Yalnız yayımlanmış yazılar önerilir.
 */
export function ReplyHelpers(
  { subject, category, disabled, onInsert }: {
    subject: string;
    category: string;
    disabled: boolean;
    onInsert: (text: string) => void;
  },
) {
  const articles = useSupportQuery(async () => {
    const data = await adminRpc("get_help_articles", {
      p_locale: "tr",
      p_platform: "all",
      p_editor: false,
    });
    if (!Array.isArray(data)) throw Error("unexpected_shape");
    return (data as Article[]).filter((a) =>
      typeof a.title === "string" && typeof a.body === "string"
    );
  }, "published-help-tr");
  const canned = cannedReplies.filter((c) =>
    !c.categories.length || c.categories.includes(category)
  );
  const related = articles.data
    ? relatedArticles(articles.data, subject, category)
    : [];
  return (
    <div className="support-helpers" data-testid="support-helpers">
      <details>
        <summary>Hazır yanıt ekle</summary>
        <div className="support-helper-list">
          {canned.map((c) => (
            <button
              key={c.id}
              className="btn-secondary"
              disabled={disabled}
              onClick={() => onInsert(c.body)}
            >
              {c.title}
            </button>
          ))}
        </div>
      </details>
      <details>
        <summary>
          İlgili yardım yazısı
          {related.length ? ` (${related.length})` : ""}
        </summary>
        <div className="support-helper-list">
          {articles.error
            ? <p className="support-ops-hint">Yardım yazıları yüklenemedi.</p>
            : !articles.data
            ? <p className="support-ops-hint">Yükleniyor…</p>
            : !related.length
            ? (
              <p className="support-ops-hint">
                Bu konuyla eşleşen yayımlanmış yardım yazısı yok.
              </p>
            )
            : related.map((a) => {
              const short = parseArticle(a.body)?.short.trim() ??
                a.body.split("\n").find((l) => l.trim())?.trim() ?? "";
              return (
                <button
                  key={a.id}
                  className="btn-secondary"
                  disabled={disabled}
                  onClick={() =>
                    onInsert(`Yardım yazısı: ${a.title}\n${short}`)}
                >
                  {a.title}
                </button>
              );
            })}
        </div>
      </details>
      <p className="support-ops-hint">
        Eklenen metin yalnız bu görüşmenin taslağına girer; göndermeden önce
        düzenleyebilirsiniz.
      </p>
    </div>
  );
}
