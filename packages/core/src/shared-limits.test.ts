import { describe, expect, it } from "vitest";
import {
  CATEGORY_STATUS,
  checkInputRange,
  checkSourceSelection,
  classifyServerError,
  ERROR_CATEGORIES,
  ERROR_CODE_RULES,
  errorBody,
  INPUT_RANGES,
  presetsWithin,
  readSourceLimits,
  SAFE_ERROR_CODE,
  sanitizeDetails,
  SOURCE_LIMIT_DEFAULTS,
} from "./shared-limits";

// Migration metni tek kaynak karşılaştırması için ham olarak içe alınır (vitest ?raw).
import migration from "../../../supabase/migrations/20261106120000_shared_limits.sql?raw";
import setsMigration from "../../../supabase/migrations/20261105010000_learning_source_sets.sql?raw";

describe("error contract", () => {
  it("classifies every known code into a declared category", () => {
    for (const [code, r] of Object.entries(ERROR_CODE_RULES)) {
      expect(SAFE_ERROR_CODE.test(code)).toBe(true);
      expect(ERROR_CATEGORIES).toContain(r.category);
      expect(classifyServerError({ code })).toMatchObject({ code, category: r.category, retryable: r.retryable });
    }
  });
  it("separates session_expired, unauthorized and permission_denied", () => {
    expect(classifyServerError({ code: "session_expired", status: 401 }).category).toBe("session_expired");
    expect(classifyServerError({ code: "unauthorized", status: 401 }).category).toBe("unauthorized");
    expect(classifyServerError({ code: "forbidden", status: 403 }).category).toBe("permission_denied");
    // Gateway verify_jwt reddi: gövdede sözleşme yok → oturum yenilenir
    expect(classifyServerError({ status: 401, body: { message: "Invalid JWT" } as never })).toEqual({
      code: "session_expired",
      category: "session_expired",
      retryable: false,
    });
  });
  it("marks network failures offline and retryable", () => {
    expect(classifyServerError({ network: true })).toEqual({ code: "offline", category: "offline", retryable: true });
  });
  it("never forwards raw server text, UUIDs or JSON as a code", () => {
    for (const raw of ["Internal Server Error: relation x", "3f0b0c2a-1111-4222-8333-444455556666", '{"a":1}', "ERROR 42501"]) {
      const c = classifyServerError({ code: raw, status: 500 });
      expect(c.code).toBe("server_error");
      expect(c.category).toBe("service_unavailable");
    }
    expect(classifyServerError({ code: "weird_but_safe_code", status: 409 })).toMatchObject({ code: "weird_but_safe_code", category: "conflict" });
    expect(classifyServerError({ code: "x", status: 429 }).category).toBe("rate_limited");
    expect(classifyServerError({ code: "x", status: 418 }).category).toBe("validation");
  });
  it("prefers a body that already follows the contract", () => {
    const body = errorBody("ai_rate_limited", { status: 429, details: { remaining: 0 } });
    expect(body).toEqual({ error: "ai_rate_limited", code: "ai_rate_limited", category: "rate_limited", retryable: true, retry_after_s: 60, details: { remaining: 0 } });
    expect(classifyServerError({ body })).toEqual({ code: "ai_rate_limited", category: "rate_limited", retryable: true, retry_after_s: 60 });
    expect(body.error).toBe(body.code);
  });
  it("sanitizes details to numbers, booleans and short safe text", () => {
    expect(sanitizeDetails({ remaining: 2, max_files: 5, ok: false, none: null, id: "3f0b0c2a-1111-4222-8333-444455556666", msg: "relation \"x\" does not exist", mime: "image/png", "bad key": 1, nan: Number.NaN })).toEqual({ remaining: 2, max_files: 5, ok: false, none: null, mime: "image/png" });
  });
  it("maps every category to a status", () => {
    for (const category of ERROR_CATEGORIES) expect(typeof CATEGORY_STATUS[category]).toBe("number");
  });
});

describe("shared source limits", () => {
  it("defaults equal the DB seeds and the migration literals", () => {
    expect(setsMigration).toContain("values('sources.max_files','5')");
    expect(setsMigration).toContain("least(10,greatest(1,");
    expect(migration).toContain(`'max_image_bytes',${SOURCE_LIMIT_DEFAULTS.max_image_bytes}`);
    expect(migration).toContain(`'max_pdf_bytes',${SOURCE_LIMIT_DEFAULTS.max_pdf_bytes}`);
    expect(migration).toContain(`'max_pdf_pages',${SOURCE_LIMIT_DEFAULTS.max_pdf_pages}`);
    expect(migration).toContain(`'max_total_pages',${SOURCE_LIMIT_DEFAULTS.max_total_pages}`);
    expect(migration).toContain(`least(${SOURCE_LIMIT_DEFAULTS.max_total_bytes}::bigint`);
    expect(migration).toContain(`set max_media_bytes=${SOURCE_LIMIT_DEFAULTS.max_total_bytes}`);
    expect(readSourceLimits(null)).toEqual({
      max_files: 5,
      max_image_bytes: 4194304,
      max_pdf_bytes: 10485760,
      max_pdf_pages: 5,
      max_total_pages: 20,
      max_total_bytes: 20971520,
      analysis_cost: "per_operation",
    });
  });
  it("reads the policy RPC output and clamps out-of-range values", () => {
    expect(readSourceLimits({ max_files: 3, max_total_bytes: 5242880, enabled: true, max_images: 3 }).max_files).toBe(3);
    expect(readSourceLimits({ max_files: 3, max_total_bytes: 5242880 }).max_total_bytes).toBe(5242880);
    expect(readSourceLimits({ max_files: 99 }).max_files).toBe(10);
    expect(readSourceLimits({ max_files: 0 }).max_files).toBe(1);
    expect(readSourceLimits({ max_files: "7" }).max_files).toBe(7);
    expect(readSourceLimits({ max_files: 2.5 }).max_files).toBe(5);
    expect(readSourceLimits({ max_total_bytes: 99999999 }).max_total_bytes).toBe(20971520);
  });
  it("rejects too many files with the remaining count", () => {
    const limits = readSourceLimits({ max_files: 5 });
    const png = { mime: "image/png", bytes: 1000 };
    expect(checkSourceSelection([png, png, png], limits)).toEqual({ ok: true, remaining: 2, total_bytes: 3000, total_pages: 3 });
    expect(checkSourceSelection(Array(6).fill(png), limits)).toEqual({
      ok: false,
      code: "source_file_limit",
      category: "validation",
      details: { max_files: 5, selected: 6, remaining: 0 },
    });
  });
  it("applies per-file and total limits like the server", () => {
    const limits = readSourceLimits(null);
    expect(checkSourceSelection([{ mime: "application/pdf", bytes: 10485761, pages: 1 }], limits)).toMatchObject({ ok: false, code: "source_size_or_type", details: { index: 0, max_bytes: 10485760 } });
    expect(checkSourceSelection([{ mime: "image/png", bytes: 4194305 }], limits)).toMatchObject({ ok: false, code: "source_size_or_type", details: { max_bytes: 4194304 } });
    expect(checkSourceSelection([{ mime: "application/pdf", bytes: 100, pages: 6 }], limits)).toMatchObject({ ok: false, code: "source_size_or_type" });
    expect(checkSourceSelection([{ mime: "text/plain", bytes: 100 }], limits)).toMatchObject({ ok: false, code: "source_size_or_type" });
    const bigPdf = { mime: "application/pdf", bytes: 7_000_000, pages: 5 };
    expect(checkSourceSelection([bigPdf, bigPdf, bigPdf], limits)).toMatchObject({ ok: false, code: "source_size_or_type", details: { max_total_bytes: 20971520, total_bytes: 21_000_000 } });
    expect(checkSourceSelection([bigPdf, bigPdf, { mime: "application/pdf", bytes: 100, pages: 5 }, { mime: "application/pdf", bytes: 100, pages: 5 }, { mime: "application/pdf", bytes: 100, pages: 1 }], limits)).toMatchObject({ ok: false, details: { total_pages: 21 } });
    expect(checkSourceSelection([bigPdf, bigPdf, { mime: "image/jpeg", bytes: 100 }], limits)).toEqual({ ok: true, remaining: 2, total_bytes: 14_000_100, total_pages: 11 });
  });
});

describe("shared input ranges", () => {
  it("equals the DB literal in the migration (single source)", () => {
    const literal = migration.match(/select '(\{[\s\S]*?\})'::jsonb/)?.[1];
    expect(literal).toBeTruthy();
    const db = JSON.parse(literal!);
    expect(db).toEqual(JSON.parse(JSON.stringify(INPUT_RANGES)));
  });
  it("matches core zod schemas and DB check constraints", () => {
    expect(INPUT_RANGES.prova_minutes).toMatchObject({ min: 1, max: 180 });
    expect(INPUT_RANGES.prova_target).toMatchObject({ min: 1, max: 100 });
    expect(INPUT_RANGES.task_stars).toMatchObject({ min: 0, max: 10 });
    expect(INPUT_RANGES.reward_cost_stars).toMatchObject({ min: 1, max: 500 });
    expect(INPUT_RANGES.group_exam_minutes).toMatchObject({ min: 5, max: 120 });
    for (const [key, range] of Object.entries(INPUT_RANGES)) {
      expect(range.min).toBeLessThanOrEqual(range.max);
      for (const preset of range.presets) expect(checkInputRange(key as never, preset).ok).toBe(true);
      expect(presetsWithin(key as never)).toEqual([...range.presets]);
    }
  });
  it("validates manual entry exactly like preset choice", () => {
    expect(checkInputRange("prova_minutes", 180)).toEqual({ ok: true, value: 180 });
    expect(checkInputRange("prova_minutes", "45")).toEqual({ ok: true, value: 45 });
    expect(checkInputRange("prova_minutes", 181)).toEqual({ ok: false, code: "invalid_input", category: "validation", details: { field: "prova_minutes", min: 1, max: 180 } });
    expect(checkInputRange("prova_minutes", 0).ok).toBe(false);
    expect(checkInputRange("prova_minutes", 12.5).ok).toBe(false);
    expect(checkInputRange("prova_minutes", "").ok).toBe(false);
    expect(checkInputRange("prova_minutes", Number.NaN).ok).toBe(false);
    expect(checkInputRange("task_stars", 0).ok).toBe(true);
    expect(checkInputRange("setup_task_stars", 0).ok).toBe(false);
    expect(presetsWithin("timetable_lesson_minutes", 40, 180)).toEqual([40, 45, 50]);
  });
});
