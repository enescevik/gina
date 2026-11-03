import {
  ARTICLE_OUTBOX_PREFIX,
  ArticleOutbox,
  type PendingArticleCommand,
} from "@gina/core";
import { supabase } from "./supabase";
let generation = 0;
export function clearArticleCommands() {
  generation++;
  for (
    const k of Object.keys(localStorage).filter((k) =>
      k.startsWith(ARTICLE_OUTBOX_PREFIX)
    )
  ) localStorage.removeItem(k);
}
export function createArticleOutbox(user: string) {
  const active = generation;
  const guard = () => {
    if (active !== generation) throw Error("article_session_changed");
  };
  return new ArticleOutbox(
    {
      get: (k) => {
        guard();
        return localStorage.getItem(k);
      },
      set: (k, v) => {
        guard();
        localStorage.setItem(k, v);
      },
      remove: (k) => {
        guard();
        localStorage.removeItem(k);
      },
      keys: () => {
        guard();
        return Object.keys(localStorage);
      },
    },
    user,
    () => crypto.randomUUID(),
  );
}
export async function sendArticleCommand(p: PendingArticleCommand) {
  const c = p.payload,
    abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), 20000);
  try {
    const request = c.action === "save"
      ? supabase().rpc("save_help_article", {
        p_request_id: p.request,
        p_id: c.id,
        p_revision: c.revision,
        p_slug: c.slug,
        p_locale: c.locale,
        p_platform: c.platform,
        p_title: c.title,
        p_body: c.body,
      })
      : supabase().rpc("review_help_article", {
        p_request_id: p.request,
        p_id: c.id,
        p_revision: c.revision,
        p_action: c.action,
        p_reason: c.reason,
      });
    const { data, error } = await request.abortSignal(abort.signal);
    if (error) throw error;
    if (
      !data || typeof data !== "object" || Array.isArray(data) ||
      data.id !== c.id ||
      data.revision !== (c.action === "save" ? c.revision + 1 : c.revision) ||
      (c.action !== "save" && data.action !== c.action)
    ) throw Error("article_receipt_invalid");
    return data;
  } finally {
    clearTimeout(timer);
  }
}
