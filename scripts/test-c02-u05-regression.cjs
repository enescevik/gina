const { loopbackFixtureRouteFetch } = require('./loopback-fixture-fetch.cjs');
const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// C02 regression copy of scripts/test-u05-planner-ui.cjs (U05 flows re-accepted on the C02 build: empty/full
// cell moves, bell-based times, copy day, server-side subject confirmation, source text, bag, sources,
// distribution). Differences: output under docs/release/c02-2026-11-06/u05-regression and the C02 cell text.
// U05 planner UI acceptance. Only the disposable synthetic fixture from
// `test-isolated-services.py --run-local --ui-hold` is accepted (127.0.0.1, example.invalid).
// Env: GINA_QA_UI_FIXTURE (fixture json), GINA_QA_WEB (web export), GINA_QA_PLAYWRIGHT_PATH,
// GINA_QA_FAIL_DIR. Seeds that the parent API cannot write (ready documents, a stored AI draft)
// go straight into the disposable database found by the fixture's family id.
const fs = require("node:fs"), assert = require("node:assert/strict"), { randomUUID, randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || "playwright");
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, "127.0.0.1");
assert.match(f.email, /^gina-[0-9a-f-]+@example\.invalid$/);
const web = process.env.GINA_QA_WEB;
assert.equal(new URL(web).hostname, "127.0.0.1");
const out = process.cwd() + "/docs/release/c02-2026-11-06/u05-regression";
fs.mkdirSync(out + "/screenshots", { recursive: true });
const failDir = process.env.GINA_QA_FAIL_DIR || "/tmp";
let browser, page, stage = "setup";
const results = [];
const pass = (check, detail) => { results.push({ check, passed: true, ...(detail ? { detail } : {}) }); console.log("PASS " + check); };

function psql(db, sql) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_gina", "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", db, "-v", "ON_ERROR_STOP=1"], { input: sql }).toString().trim();
}
function findDb(family) {
  assert.match(family, /^[0-9a-f-]{36}$/);
  const dbs = psql("postgres", "select datname from pg_database where datname like 'gina_http_%_audit'").split("\n").filter(Boolean);
  const hit = dbs.filter((db) => { try { return psql(db, `select count(*) from public.families where id='${family}'`) === "1"; } catch { return false; } });
  assert.equal(hit.length, 1, "exactly one disposable db holds the fixture family");
  assert.match(hit[0], /^gina_http_[0-9a-f]{16}_audit$/);
  return hit[0];
}
const istanbul = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
const isoDay = (d) => { const w = new Date(d + "T12:00:00Z").getUTCDay(); return w === 0 ? 7 : w; };
const addDays = (d, n) => new Date(new Date(d + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

(async () => {
  const login = await loopbackFixtureFetch(f.url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: f.anon, "content-type": "application/json" }, body: JSON.stringify({ email: f.email, password: f.password }) });
  assert.ok(login.ok);
  const session = await login.json();
  async function api(path, body, prefer) {
    const res = await loopbackFixtureFetch(f.url + "/rest/v1/" + path, { method: body ? "POST" : "GET", headers: { apikey: f.anon, authorization: "Bearer " + session.access_token, "content-type": "application/json", ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    assert.ok(res.ok, path + " " + text.slice(0, 300));
    return text ? JSON.parse(text) : null;
  }
  const db = findDb(f.familyId);
  // A rerun on the same disposable fixture starts from the same seed state.
  psql(db, `delete from public.learning_sources where family_id='${f.familyId}' and storage_consent='u05-synthetic';
delete from public.ai_operation_jobs where family_id='${f.familyId}' and input_hash like 'u05-%';
delete from public.children where family_id='${f.familyId}' and name in ('Deniz','Ada');`);
  const [deniz, ada] = await api("children", [{ family_id: f.familyId, name: "Deniz", grade: 5 }, { family_id: f.familyId, name: "Ada", grade: 2 }], "return=representation");
  // 40 lessons: Mon–Fri × 8, 08:30 start, 40 min, 10 min break, 50 min lunch after period 4.
  const names = ["Türkçe", "MAT", "Fen Bilimleri", "İngilizce", "Sosyal Bilgiler", "Beden Eğitimi", "Görsel Sanatlar", "Müzik"];
  const lessons = [];
  for (let d = 1; d <= 5; d++) {
    let cursor = 8 * 60 + 30;
    for (let p = 1; p <= 8; p++) {
      lessons.push({ id: `d${d}p${p}`, day: d, title: names[(p - 1 + d - 1) % 8], start: clock(cursor), end: clock(cursor + 40) });
      cursor += 40 + (p === 4 ? 50 : 10);
    }
  }
  assert.equal(lessons.length, 40);
  await api("rpc/save_school_timetable_request", { p_request_id: randomUUID(), p_child_id: deniz.id, p_revision: 0, p_lessons: lessons, p_settings: { start: "08:30", duration: 40, break: 10 } });
  const tomorrow = istanbul(1), today = istanbul(0), tDay = isoDay(tomorrow);
  await api("rpc/save_school_timetable_request", { p_request_id: randomUUID(), p_child_id: ada.id, p_revision: 0, p_settings: { start: "09:00", duration: 40, break: 10 }, p_lessons: [
    { id: "a1", day: tDay, title: "Matematik", start: "09:00", end: "09:40" },
    { id: "a2", day: tDay, title: "Beden Eğitimi", start: "09:50", end: "10:30" },
    { id: "a3", day: tDay, title: "Görsel Sanatlar", start: "10:40", end: "11:20" },
    { id: "a4", day: tDay, title: "Hayat Bilgisi", start: "11:30", end: "12:10" },
  ] });
  // 50 ready documents; the oldest one carries a stored homework draft, so it is only reachable after "more".
  const sources = Array.from({ length: 50 }, (_, i) => ({ id: randomUUID(), name: `Ödev föyü ${String(i + 1).padStart(2, "0")}`, created: new Date(Date.now() - (i + 1) * 60000).toISOString() }));
  const sourceSql = sources.map((s) => `('${s.id}','${f.familyId}','${f.userId}','document','${s.name}','application/pdf',2048,'${randomBytes(32).toString("hex")}','u05/${s.id}.pdf','ready','u05-synthetic','${s.created}')`).join(",\n");
  const due = (n) => addDays(today, n);
  const draft = { items: [
    { kind: "homework", title: "Kesir problemleri", subject: "Matematik", topic: "Kesirler", due_on: due(4), time: null, steps: ["Sayfa 12"], page: 1, note: "" },
    { kind: "homework", title: "Okuma özeti", subject: "Türkçe", topic: "", due_on: due(2), time: null, steps: [], page: 1, note: "" },
    { kind: "homework", title: "Deney raporu", subject: "Fen Bilimleri", topic: "Maddenin halleri", due_on: due(10), time: null, steps: [], page: 2, note: "" },
    { kind: "study", title: "Kelime tekrarı", subject: "İngilizce", topic: "", due_on: null, time: null, steps: [], page: 2, note: "" },
    { kind: "homework", title: "Harita çalışması", subject: "Sosyal Bilgiler", topic: "", due_on: due(5), time: null, steps: [], page: 3, note: "" },
  ], warnings: [] };
  const oldest = sources[49], ttSource = sources[0], job = randomUUID(), ttJob = randomUUID();
  const ttDraft = { lessons: [
    { day: 1, title: "MAT", start: null, end: null, page: 1, note: "" },
    { day: 1, title: "Trk", start: null, end: null, page: 1, note: "Hücre silik okundu" },
    { day: 2, title: "Fen", start: null, end: null, page: 1, note: "" },
  ], warnings: ["Saatler fotoğrafta yok"] };
  psql(db, `insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent,created_at) values ${sourceSql};
insert into public.ai_operation_jobs(id,family_id,requested_by,action,input_hash,lease,status,result) values
 ('${job}','${f.familyId}','${f.userId}','import','u05-${job}',gen_random_uuid(),'done',jsonb_build_object('output','${JSON.stringify(draft).replace(/'/g, "''")}'::jsonb)),
 ('${ttJob}','${f.familyId}','${f.userId}','plan','u05-${ttJob}',gen_random_uuid(),'done','{}'::jsonb);
insert into gina.learning_plan_imports(family_id,child_id,source_id,locale,context,job_id) values ('${f.familyId}','${deniz.id}','${oldest.id}','tr','{"input":{"grade":5}}','${job}');
insert into public.timetable_imports(id,family_id,child_id,source_id,draft) values ('${ttJob}','${f.familyId}','${ada.id}','${ttSource.id}','${JSON.stringify(ttDraft).replace(/'/g, "''")}');
insert into public.app_settings(key,value) values('sources.enabled','true'::jsonb) on conflict (key) do update set value='true'::jsonb;`);

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  await ctx.route(f.url + "/**", async (route) => {
    try {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
      const res = await loopbackFixtureRouteFetch(route);
      await route.fulfill({ response: res, headers: { ...res.headers(), "access-control-allow-origin": "*" } });
    } catch { await route.fulfill({ status: 503, body: "Local fixture unavailable" }); }
  });
  page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    if (/rpc\/(save_school_timetable_request|apply_learning_plan_import)/.test(r.url()) && r.request().method() === "POST") {
      console.log("RPC " + r.url().split("/rpc/")[1] + " " + r.status() + " " + (await r.text().catch(() => "")).slice(0, 300));
    }
  });
  const body = () => page.locator("body").innerText();
  async function shot(name) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/screenshots/${name}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ": document does not overflow");
    assert.ok(!/\bu05\.|weekReview\.|schoolBag\./.test(await body()), name + ": translations resolved");
  }
  async function sized(name, w, h) {
    await page.setViewportSize({ width: w, height: h });
    await shot(name);
  }
  const cell = (id) => page.locator(`[data-testid="tt-cell-${id}"]`);

  stage = "login";
  await page.goto(web);
  await page.getByLabel("E-posta", { exact: true }).fill(f.email);
  await page.getByLabel("Şifre", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.waitForURL("**/parent");

  stage = "open_timetable";
  await page.goto(`${web}/parent/calendar?childId=${deniz.id}&date=${today}`);
  await page.getByRole("button", { name: "Ders programı", exact: true }).first().click();
  await page.getByRole("button", { name: "Hafta tablosu", exact: true }).waitFor();
  for (const name of ["Deniz", "Ada"]) await page.getByRole("button", { name, exact: true }).first().waitFor();
  await shot("timetable-40-day-phone");
  await page.getByRole("button", { name: "Hafta tablosu", exact: true }).click();
  await page.getByRole("button", { name: "Yer değiştir", exact: true }).click();
  await cell("empty:5:8").waitFor({ state: "attached" });
  assert.equal(await page.locator('[data-testid^="tt-cell-d"]').count(), 40);
  await shot("timetable-40-arrange-week-phone");
  pass("forty_lessons_two_children_week_grid", "40 cells + one empty row per day while arranging; Deniz and Ada switch tags");

  stage = "drag_to_empty_with_autoscroll";
  const handle = page.locator('[data-testid="tt-handle-d1p1"]');
  await page.locator('[data-testid="tt-frame"]').evaluate((n) => n.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const hb = await handle.boundingBox();
  const fr = await page.locator('[data-testid="tt-frame"]').boundingBox();
  const fridayBefore = await cell("empty:5:8").boundingBox();
  assert.ok(fridayBefore.x > 390, "Friday empty cell starts outside the phone viewport");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  let px = hb.x + hb.width / 2, py = hb.y + hb.height / 2;
  const glide = async (x, y) => { for (let i = 1; i <= 6; i++) await page.mouse.move(px + (x - px) * i / 6, py + (y - py) * i / 6); px = x; py = y; };
  const right = Math.min(fr.x + fr.width, 390) - 20, bottom = Math.min(fr.y + fr.height, 844) - 20;
  // Hold at the right edge, then the bottom edge: the grid scrolls under the finger both ways.
  let target;
  for (const [x, y, both] of [[right, py, false], [right, bottom, true]]) {
    await glide(x, y);
    for (let i = 0; i < 50; i++) {
      await page.mouse.move(x - (i % 2), y);
      await page.waitForTimeout(60);
      target = await cell("empty:5:8").boundingBox();
      const inX = target.x > fr.x + 60 && target.x + target.width < right - 10;
      const inY = target.y > fr.y + 60 && target.y + target.height < bottom - 10;
      if (both ? inX && inY : inX) break;
    }
  }
  assert.ok(target.x < fridayBefore.x - 200, "grid auto-scrolled while dragging");
  await glide(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.up();
  await page.getByText("Ders taşındı. Saat o günün zil düzenine göre verildi; geri alabilirsin.", { exact: true }).waitFor();
  await shot("drag-to-empty-friday-phone");
  pass("drag_to_empty_cell_with_edge_autoscroll", { scrolledBy: Math.round(fridayBefore.x - target.x) });

  stage = "undo_and_tap_move";
  await page.getByRole("button", { name: "Geri al", exact: true }).first().click();
  await page.getByText("Ders taşındı.", { exact: false }).waitFor({ state: "detached" }).catch(() => {});
  await page.getByRole("button", { name: "Yer değiştir", exact: true }).click();
  await page.getByRole("button", { name: "Yer değiştir", exact: true }).click();
  // Accessible alternative: choose the lesson with the move button, then an empty cell button.
  await page.locator('[data-testid="tt-cell-d2p3"]').getByRole("button", { name: /dersinin yerini değiştir$/ }).click();
  await page.getByText("Yer değiştirmek için başka bir derse, taşımak için boş hücreye dokun.", { exact: false }).waitFor();
  const tapTarget = page.getByRole("button", { name: /dersini Çarşamba, 9\. saate taşı$/ });
  await tapTarget.scrollIntoViewIfNeeded();
  await shot("tap-move-choose-empty-phone");
  await tapTarget.click();
  await page.getByText("Ders taşındı. Saat o günün zil düzenine göre verildi; geri alabilirsin.", { exact: true }).waitFor();
  pass("undo_then_accessible_tap_move_to_empty_cell");
  // Drag again so the saved result carries both moves.
  await page.getByRole("button", { name: "Yer değiştir", exact: true }).click();
  await page.getByRole("button", { name: "Yer değiştir", exact: true }).click();
  await page.getByRole("button", { name: /^Türkçe dersinin yerini değiştir$/ }).first().waitFor();
  await page.locator('[data-testid="tt-cell-d1p1"]').getByRole("button", { name: /dersinin yerini değiştir$/ }).click();
  await page.getByRole("button", { name: /dersini Cuma, 9\. saate taşı$/ }).click();
  await page.getByText("Ders taşındı.", { exact: false }).first().waitFor();

  stage = "copy_day_preview_undo";
  await page.getByRole("button", { name: "Günü kopyala", exact: true }).click();
  await page.getByText("Seçili günlere kopyala", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Salı", exact: true }).click();
  await page.getByRole("button", { name: "Cumartesi", exact: true }).click();
  await page.getByText("Önce / sonra", { exact: true }).waitFor();
  await page.getByText(/^Önce: 7 ders · /).waitFor();
  await page.getByText("Önce: ders yok", { exact: true }).waitFor();
  assert.equal(await page.getByText(/^Sonra: 7 ders · /).count(), 2, "Monday has 7 lessons after the move; both targets show 7");
  await page.getByText("Seçilen günlerdeki mevcut dersler bu günün dersleriyle değiştirilir.", { exact: true }).waitFor();
  await shot("copy-day-before-after-phone");
  await page.getByRole("button", { name: "Seçili günlere kopyala", exact: true }).click();
  await page.getByText("Salı, Cumartesi günlerine kopyalandı. Programı kaydetmeden önce geri alabilirsin.", { exact: true }).waitFor();
  assert.equal(await cell("d2p1").count(), 0, "Tuesday replaced by copies");
  await shot("copy-day-applied-phone");
  await page.getByRole("button", { name: "Kopyalamayı geri al", exact: true }).click();
  await cell("d2p1").waitFor({ state: "attached" });
  assert.equal(await page.getByText(/günlerine kopyalandı/).count(), 0);
  pass("copy_day_before_after_and_undo");

  stage = "subject_match";
  await page.getByRole("button", { name: "Yer değiştir", exact: true }).click();
  await page.getByRole("button", { name: /^Pazartesi, \d, MAT, / }).click();
  await page.getByText("Katalogdaki ders", { exact: true }).waitFor();
  await page.getByText("Yazılan ad korunur: “MAT”.", { exact: false }).waitFor();
  const confirm = page.getByRole("button", { name: "Matematik olarak onayla", exact: true });
  await confirm.waitFor();
  await confirm.scrollIntoViewIfNeeded();
  assert.equal(await page.getByText("Katalog: Matematik", { exact: true }).count(), 0, "no silent binding before confirmation");
  await shot("subject-match-candidates-phone");
  await confirm.click();
  await page.getByText("Katalog: Matematik", { exact: true }).first().waitFor();
  await shot("subject-match-confirmed-phone");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).first().click();
  // C02: a bound cell shows the catalogue title with the document text underneath ("Belgede: MAT").
  assert.ok(await page.getByText("Belgede: MAT", { exact: true }).count() >= 5, "every MAT cell shows the confirmed catalogue subject and its source text");
  pass("subject_suggest_requires_parent_confirmation_and_keeps_source_name");

  stage = "save_timetable";
  await page.getByRole("button", { name: "Programı kaydet", exact: true }).click();
  await page.getByText("Kaydedildi", { exact: true }).first().waitFor();
  const saved = (await api(`school_timetables?child_id=eq.${deniz.id}&select=lessons,revision`))[0];
  const byId = Object.fromEntries(saved.lessons.map((l) => [l.id, l]));
  assert.equal(saved.lessons.length, 40);
  assert.deepEqual([byId.d1p1.day, byId.d1p1.start, byId.d1p1.end], [5, "15:50", "16:30"]);
  assert.deepEqual([byId.d2p3.day, byId.d2p3.start, byId.d2p3.end], [3, "15:50", "16:30"]);
  assert.ok(saved.lessons.filter((l) => l.title === "MAT").length === 5, "source name MAT kept in the saved timetable");
  assert.ok(!saved.lessons.some((l) => l.day === 6), "undone copy not saved");
  assert.ok(Object.keys(byId).every((k) => /^d\dp\d$/.test(k)), "lesson ids preserved");
  await sized("timetable-saved-tablet", 768, 1024);
  await sized("timetable-saved-desktop", 1280, 800);
  pass("saved_moves_use_bell_times_ids_and_names_preserved", { d1p1: byId.d1p1, d2p3: byId.d2p3 });

  stage = "import_doubts_and_bells";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Ada", exact: true }).first().click();
  await page.getByRole("button", { name: "Diğer program işlemleri", exact: true }).click();
  await page.getByRole("button", { name: "Fotoğraftan aktar", exact: true }).click();
  await page.getByRole("button", { name: ttSource.name, exact: true }).click();
  await page.getByText("3 dersin saati eksik. Okulun zil düzenini girerek tamamla; GINA saat tahmin etmez.", { exact: true }).waitFor();
  await page.getByText("Kontrol et · ad tanınmadı, okuma notu var", { exact: true }).waitFor();
  assert.equal(await page.getByText(/^Kontrol et · /).count(), 1, "only the unclear cell is flagged on the cell itself");
  await shot("import-doubt-on-cell-phone");
  await page.getByRole("button", { name: "Zil düzenini gir", exact: true }).click();
  await page.getByRole("button", { name: "Tüm günler", exact: true }).click();
  await page.getByRole("button", { name: "Program taslağına uygula", exact: true }).click();
  await page.getByText(/dersin saati eksik/).waitFor({ state: "detached" });
  await page.getByText(/^09:00–09:40$/).first().waitFor();
  await shot("import-bells-filled-phone");
  pass("uncertainty_on_cell_and_missing_times_from_parent_bells");
  await page.getByRole("button", { name: "Kapat", exact: true }).first().click();
  await page.getByRole("button", { name: "Taslağı kapat", exact: true }).click();

  stage = "bag_suggestions";
  await page.goto(`${web}/parent/calendar?childId=${ada.id}&date=${tomorrow}`);
  await page.getByRole("button", { name: "Ada · Çanta listesi", exact: true }).click();
  await page.getByText("Derslere göre öneri", { exact: true }).waitFor();
  await page.getByText("Okul talebi değil", { exact: true }).waitFor();
  assert.ok((await body()).includes("okulun istediği liste değildir"));
  assert.ok((await body()).includes("Ders adına göre otomatik malzeme eklenmez"), "nothing auto-added");
  for (const s of ["Matematik kitabı", "Matematik defteri", "Spor kıyafeti ve ayakkabısı", "Boya kalemleri ve resim defteri", "Hayat Bilgisi kitabı"]) await page.getByRole("button", { name: s, exact: true }).waitFor();
  await shot("bag-suggestions-phone");
  await page.getByRole("button", { name: "Matematik defteri", exact: true }).click();
  const field = page.getByLabel("Ne gerekiyor?", { exact: true });
  assert.equal(await field.inputValue(), "Matematik defteri");
  await field.fill("Matematik defteri (kareli)");
  await page.getByRole("button", { name: "Listeye ekle", exact: true }).click();
  await page.getByRole("button", { name: "Önerilerin hepsini ekle", exact: true }).click();
  await page.getByText("Önerilerin hepsi listede.", { exact: true }).waitFor();
  await shot("bag-suggestions-added-phone");
  await page.getByRole("button", { name: "Listeyi kaydet", exact: true }).click();
  await page.getByText("Liste kaydedildi. Veli ve çocuk aynı listeyi kullanır.", { exact: true }).waitFor();
  const bag = await api("rpc/get_school_bag", { p_child_id: ada.id, p_day: tomorrow });
  const labels = bag.items.map((i) => i.label);
  assert.ok(labels.includes("Matematik defteri (kareli)"), "edited suggestion saved");
  assert.ok(labels.includes("Spor kıyafeti ve ayakkabısı"));
  assert.ok(!labels.includes("Matematik defteri"), "edited hint is not duplicated");
  await sized("bag-suggestions-tablet", 768, 1024);
  await page.setViewportSize({ width: 390, height: 844 });
  pass("bag_editable_suggestions_marked_not_school_request", { saved: labels.length });

  stage = "sources_paging_and_distribution";
  await page.goto(`${web}/parent/calendar?childId=${deniz.id}&date=${today}`);
  await page.getByRole("button", { name: "Belgeden ödev planla", exact: true }).first().click();
  await page.getByText("Kayıtlı belgeler", { exact: true }).waitFor();
  await page.getByText("30 dosya gösteriliyor", { exact: true }).waitFor();
  assert.equal(await page.getByText(oldest.name, { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Daha fazla dosya göster", exact: true }).click();
  await page.getByText("50 dosya gösteriliyor", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Daha fazla dosya göster", exact: true }).count(), 0);
  await page.getByText(oldest.name, { exact: true }).scrollIntoViewIfNeeded();
  await shot("sources-50-more-phone");
  pass("source_picker_pages_past_30");
  await page.getByText(oldest.name, { exact: true }).click();
  await page.getByText("Kesir problemleri", { exact: true }).waitFor();
  for (const title of draft.items.map((i) => i.title)) await page.getByRole("checkbox", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.getByRole("button", { name: "Günlere dağıt", exact: true }).click();
  await page.getByText(/^Okuma özeti → /).waitFor();
  await shot("distribute-preview-phone");
  await page.getByRole("button", { name: "Tarihleri uygula", exact: true }).click();
  await page.getByText(/planın tarihi değişti/).waitFor();
  await page.getByRole("button", { name: "Dağıtımı geri al", exact: true }).click();
  await page.getByRole("button", { name: "Dağıtımı geri al", exact: true }).waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Günlere dağıt", exact: true }).click();
  await page.getByRole("button", { name: "Tarihleri uygula", exact: true }).click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.getByRole("switch", { name: /İşleri ve tarihleri belgeyle karşılaştırdım/ }).click();
  await shot("distribute-review-phone");
  await page.getByRole("button", { name: "5 çalışmayı ekle", exact: true }).click();
  let plans;
  for (let i = 0; i < 40; i++) {
    plans = await api("rpc/get_learning_plan", { p_child_id: deniz.id, p_from: addDays(today, -2), p_to: addDays(today, 30) });
    if (plans.items.length >= 5) break;
    await page.waitForTimeout(500);
  }
  // Same rule as planner-moves.distributePlanDates: Mon–Fri, one a day, earliest due first.
  const order = draft.items.map((x, index) => ({ index, due: x.due_on })).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.index - b.index);
  const expected = {};
  let day = today, used = 0;
  const next = () => { do day = addDays(day, 1); while (isoDay(day) > 5); used = 0; };
  if (isoDay(day) > 5) next();
  for (const o of order) { if (used >= 1) next(); expected[draft.items[o.index].title] = o.due && day > o.due ? o.due : day; used++; }
  for (const [title, date] of Object.entries(expected)) {
    const item = plans.items.find((p) => p.content.title === title);
    assert.ok(item, title + " saved");
    assert.equal(item.content.planned_on, date, title + " planned date");
    assert.ok(!item.content.due_on || item.content.planned_on <= item.content.due_on);
  }
  await sized("distribute-saved-tablet", 768, 1024);
  await sized("distribute-saved-desktop", 1280, 800);
  pass("bulk_homework_distribution_preview_undo_and_save", expected);

  stage = "source_removal_keeps_lessons";
  // The Edge `learning-source` delete ends in this row delete; links cascade, lessons must not.
  const link = randomUUID();
  psql(db, `insert into public.learning_source_links(id,source_id,timetable_child_id) values ('${link}','${ttSource.id}','${deniz.id}');`);
  const beforeCount = (await api(`school_timetables?child_id=eq.${deniz.id}&select=lessons`))[0].lessons.length;
  psql(db, `delete from public.learning_sources where id='${ttSource.id}';`);
  const after = (await api(`school_timetables?child_id=eq.${deniz.id}&select=lessons`))[0].lessons.length;
  assert.equal(after, beforeCount);
  assert.equal(psql(db, `select count(*) from public.learning_source_links where id='${link}'`), "0");
  pass("removing_source_file_keeps_lessons", { lessons: after });

  assert.deepEqual(errors, []);
  pass("no_page_errors_no_overflow_translations_resolved");
  fs.writeFileSync(out + "/ui-checks.json", JSON.stringify({ environment: "disposable-local-real-auth-rest", viewports: ["390x844", "768x1024", "1280x800"], results }, null, 2) + "\n");
  await browser.close();
})().catch(async (e) => {
  console.log("CHECK_FAILED " + stage + " " + String(e.stack || e.message).slice(0, 1500));
  if (page) {
    await page.screenshot({ path: failDir + "/u05-ui-failed.png" }).catch(() => {});
    fs.writeFileSync(failDir + "/u05-ui-failure.txt", await page.locator("body").innerText().catch(() => ""));
  }
  if (browser) await browser.close();
  process.exitCode = 1;
});
