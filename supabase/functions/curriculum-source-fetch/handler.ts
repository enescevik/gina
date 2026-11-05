import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/supabase.ts";
import {
  fetchWithPolicy,
  INDEX_PAGES,
  inspectXlsx,
  matchSubjectLinks,
  MAX_PAGE_BYTES,
  parseIndex,
  PolicyError,
  type Resolver,
  sha256Hex,
  type Transport,
} from "../_shared/curriculum-source.ts";

const BUCKET = "gina-curriculum-sources";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface FetchTarget {
  exam_family: string;
  school_year: string;
  term: number;
  exam_no?: number;
  grade?: number;
  subject: string;
  programme?: string;
  /** Optional disambiguation; must still be one of the links on the official index page. */
  link_url?: string;
}
export interface FetchDeps {
  db: SupabaseClient;
  admin: { userId: string } | null;
  transport?: Transport;
  resolve?: Resolver;
  upload?: (path: string, bytes: Uint8Array) => Promise<string | null>;
}
const slug = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(
    /[̀-ͯ]/g,
    "",
  ).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";

function parseTarget(raw: unknown): FetchTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const term = Number(t.term), grade = t.grade === undefined ? undefined : Number(t.grade);
  const exam = t.exam_no === undefined ? undefined : Number(t.exam_no);
  if (
    typeof t.exam_family !== "string" || t.exam_family !== "oyss" ||
    typeof t.school_year !== "string" ||
    !/^20\d{2}-20\d{2}$/.test(t.school_year) ||
    Number(t.school_year.slice(5)) !== Number(t.school_year.slice(0, 4)) + 1 ||
    ![1, 2].includes(term) || (exam !== undefined && ![1, 2].includes(exam)) ||
    (grade !== undefined && (!Number.isInteger(grade) || grade < 1 || grade > 12)) ||
    typeof t.subject !== "string" || !t.subject.trim() || t.subject.length > 80 ||
    (t.programme !== undefined && (typeof t.programme !== "string" || t.programme.length > 160)) ||
    (t.link_url !== undefined && (typeof t.link_url !== "string" || t.link_url.length > 500))
  ) return null;
  return {
    exam_family: "oyss",
    school_year: t.school_year,
    term,
    exam_no: exam,
    grade,
    subject: t.subject.trim(),
    programme: t.programme as string | undefined,
    link_url: t.link_url as string | undefined,
  };
}

/** Admin-only. Downloads on the server, records a revision receipt; never publishes or picks a scenario. */
export async function handleCurriculumSourceFetch(
  req: Request,
  deps: FetchDeps,
): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!deps.admin) return json({ error: "forbidden" }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: "invalid_input" }, 400);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  if (!body || typeof body !== "object" || !UUID.test(String(body.request_id))) {
    return json({ error: "invalid_input" }, 400);
  }
  const target = parseTarget(body.target);
  if (!target) return json({ error: "invalid_input" }, 400);
  const requestId = String(body.request_id);
  if (target.grade !== undefined && (target.grade < 5 || target.grade > 12)) {
    return json({
      outcome: "grade_out_of_scope",
      alternative: "free_study",
      officially_verified: false,
      note: "Common written-exam tables cover grades 5–12 only; no other year or grade is substituted.",
    });
  }
  const indexUrl =
    INDEX_PAGES[`${target.exam_family}:${target.school_year}:${target.term}`];
  if (!indexUrl) {
    return json({
      outcome: "unpublished",
      alternative: "free_study",
      officially_verified: false,
      note: "No official index is known for this year/term; no URL was guessed.",
    });
  }
  const sourceKey = `${target.exam_family}:${target.school_year}:${target.term}:${slug(target.subject)}`;
  const record = (source: Record<string, unknown>, revision: Record<string, unknown> | null) =>
    deps.db.rpc("record_curriculum_source_fetch", {
      p_request_id: requestId,
      p_actor_id: deps.admin!.userId,
      p_source: source,
      p_revision: revision,
    });
  const base = {
    source_key: sourceKey,
    exam_family: target.exam_family,
    school_year: target.school_year,
    term: target.term,
    label: target.subject,
    index_url: indexUrl,
    link_url: indexUrl,
    index_published_on: null as string | null,
    index_updated_on: null as string | null,
    error: null as string | null,
  };
  const failure = async (code: string) => {
    const { data, error } = await record({ ...base, error: code.slice(0, 300) }, null);
    if (error) return json({ error: error.code === "42501" ? "forbidden" : "save_failed" }, error.code === "42501" ? 403 : 500);
    return json({ ...data, officially_verified: false });
  };
  let links, dates;
  try {
    const page = await fetchWithPolicy(indexUrl, { transport: deps.transport, resolve: deps.resolve, maxBytes: MAX_PAGE_BYTES });
    ({ links, dates } = parseIndex(new TextDecoder().decode(page.body)));
  } catch (e) {
    return failure("index:" + (e instanceof PolicyError ? e.message : "unavailable"));
  }
  base.index_published_on = dates.published ?? null;
  base.index_updated_on = dates.updated ?? null;
  const matches = matchSubjectLinks(links, target.subject);
  const chosen = target.link_url
    ? matches.find((l) => l.href === target.link_url) ?? links.find((l) => l.href === target.link_url)
    : matches.length === 1
    ? matches[0]
    : undefined;
  if (!chosen) {
    if (matches.length > 1 && !target.link_url) {
      return json({
        outcome: "ambiguous_subject_link",
        officially_verified: false,
        candidates: matches.map((m) => ({ text: m.text, href: m.href })),
        note: "Choose the link for the child's school level; only links on the official index page are accepted.",
      });
    }
    return failure("subject_link_not_found");
  }
  base.link_url = chosen.href;
  let fetched, inspection, digest;
  try {
    fetched = await fetchWithPolicy(chosen.href, { transport: deps.transport, resolve: deps.resolve });
    inspection = inspectXlsx(fetched.body, fetched.mime);
    digest = await sha256Hex(fetched.body);
  } catch (e) {
    return failure("file:" + (e instanceof PolicyError ? e.message : "unavailable"));
  }
  const storagePath = `${target.exam_family}/${target.school_year}-t${target.term}/${digest}.xlsx`;
  let stored: string | null = null;
  try {
    stored = deps.upload
      ? await deps.upload(storagePath, fetched.body)
      : await defaultUpload(deps.db, storagePath, fetched.body);
  } catch {
    stored = null;
  }
  const { data, error } = await record(base, {
    sha256: digest,
    bytes: fetched.body.length,
    mime: inspection.mime,
    resolved_url: fetched.finalUrl,
    redirect_chain: fetched.chain,
    inspection,
    storage_path: stored,
  });
  if (error) {
    return json(
      { error: error.code === "42501" ? "forbidden" : error.message === "request_conflict" ? "request_conflict" : "save_failed" },
      error.code === "42501" ? 403 : error.message === "request_conflict" ? 409 : 500,
    );
  }
  return json({ ...data, index: { url: indexUrl, ...dates }, officially_verified: false, stored: stored !== null });
}

async function defaultUpload(db: SupabaseClient, path: string, bytes: Uint8Array) {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false,
  });
  // Same bytes already stored under the same hash path is not an error.
  if (error && !/already exists|duplicate/i.test(error.message)) return null;
  return path;
}
