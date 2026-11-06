// H06 — görsel/etkileşim kabul boşlukları (Playwright, web dışa aktarımı, gerçek izole Auth/REST/Storage/Edge).
// Yalnız `test-isolated-services.py --run-local --with-storage --ui-hold` geçici fixture'ı kabul edilir (loopback, @example.invalid).
// Ortam: GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_WEB_BACKEND, GINA_QA_WEB_ANON, GINA_QA_PLAYWRIGHT_PATH,
//        GINA_H06_DB (yalnız `gina_http_*_audit` geçici DB), GINA_H06_OUT (çıktı), GINA_H06_ONLY (isteğe bağlı akış listesi).
// Sentetik veri (yalnız geçici DB): 098 tarifindeki kütüphane paketi + otomatik Birlikte Prova (ortak kaynak "segments" + 320×200 PNG
// görsel), D14 için `provenance.generator = ai` bir soru, H01 için kullanıcıya ek `apple` kimliği (auth.identities satırı; gerçek Apple yok).
// Taklitler açıkça yazılır: (T1) `/auth/v1/settings` yanıtına `external.apple = true` eklenir (Apple düğmesinin yerleşimi için; giriş yapılmaz);
// (T2) Apple kimliği DB satırıdır, Apple ile doğrulama tıklanmaz. Web ölçümü fiziksel cihaz kabulü DEĞİLDİR (C15).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../../../..');
const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
const f = JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname, '127.0.0.1'); assert.match(f.email, /@example\.invalid$/);
const web = process.env.GINA_QA_WEB; assert.equal(new URL(web).hostname, '127.0.0.1');
const backend = process.env.GINA_QA_WEB_BACKEND; assert.equal(new URL(backend).hostname, '127.0.0.1');
const placeholderAnon = process.env.GINA_QA_WEB_ANON;
const DB = process.env.GINA_H06_DB || ''; assert.match(DB, /^gina_http_[0-9a-f]{16}_audit$/, 'disposable DB only');
const out = path.resolve(process.env.GINA_H06_OUT || path.join(root, 'docs/release/h06-2026-11-06/ui'));
fs.mkdirSync(out, { recursive: true });
const only = (process.env.GINA_H06_ONLY || '').split(',').filter(Boolean);
const tr = JSON.parse(fs.readFileSync(path.join(root, 'packages/core/src/i18n/tr.json')));
const t = (key, vars = {}) => {
  let s = tr[key]; if (s === undefined) s = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tr);
  assert.equal(typeof s, 'string', 'missing i18n key ' + key);
  for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v));
  return s;
};
const SIZES = { phone: { width: 390, height: 844 }, narrow: { width: 360, height: 740 }, tablet: { width: 768, height: 1024 }, wide: { width: 1280, height: 800 } };
const ALL = Object.keys(SIZES);
const results = [];
const record = (check, passed, detail) => { results.push({ check, passed, ...(detail === undefined ? {} : { detail }) }); console.error((passed ? 'ok ' : 'FAIL ') + check + (passed ? '' : ' ' + JSON.stringify(detail).slice(0, 600))); };
let browser;
const S = {};

function psql(sql, user = 'postgres') {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', user, '-d', DB, '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim();
}
const lit = v => "'" + String(v).replace(/'/g, "''") + "'";

// 320×200 sentetik PNG (yalnız şekil: mor çerçeve, nane şeritler). Gerçek içerik yok.
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const edge = x < 6 || y < 6 || x >= w - 6 || y >= h - 6, band = Math.floor(x / 40) % 2 === 0 && y > 60 && y < 140;
      const c = edge ? [0x6b, 0x4e, 0xd6] : band ? [0x7c, 0xd8, 0xb5] : [0xff, 0xf8, 0xec];
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function seed() {
  const existing = psql(`select id from public.group_exams where title='H06 ortak provası' limit 1;`);
  if (existing) { S.group = existing; } else {
    const t098 = fs.readFileSync(path.join(root, 'supabase/tests/098_library_credit_safety.test.sql'), 'utf8').split('\n');
    const defs = t098.filter(l => l.startsWith('create function pg_temp.base_bundle()') || l.startsWith('create function pg_temp.bundle()'));
    assert.equal(defs.length, 2, '098 bundle recipe not found');
    const img = png(320, 200), b64 = img.toString('base64'), sha = crypto.createHash('sha256').update(img).digest('hex');
    const asset = JSON.stringify({ key: 'segments', mime: 'image/png', sha256: sha, width: 320, height: 200, base64: b64 });
    S.group = crypto.randomUUID();
    const claims = lit(JSON.stringify({ sub: f.userId, role: 'authenticated', gina: { admin: true } }));
    psql(`update public.app_settings set value='true' where key in('library_packages.enabled','cohorts.enabled');
      update public.plans set cohort_monthly=greatest(cohort_monthly,5);
      begin;\n${defs.join('\n')}
      create function pg_temp.h06() returns jsonb language sql as $$select jsonb_set(jsonb_set(pg_temp.bundle(),'{assets,0}',${lit(asset)}::jsonb),'{package_key}','"h06-group-media"')$$;
      create temp table st(name text primary key,id uuid); grant all on st to authenticated,service_role;
      set local role authenticated; select set_config('request.jwt.claims',${claims},true);
      insert into st select 'rev1',(public.admin_import_library_bundle(gen_random_uuid(),pg_temp.h06())->>'id')::uuid;
      select public.admin_review_library_question(gen_random_uuid(),(select id from st),'question-'||i,1,0,'suitable','ok') from generate_series(1,4) i;
      reset role; select set_config('request.jwt.claims','{"role":"service_role"}',true);
      select public.prepare_library_delivery_media('${f.userId}',(select id from st),jsonb_build_array(jsonb_build_object('source_hash',${lit(sha)},'base64',${lit(b64)})));
      set local role authenticated; select set_config('request.jwt.claims',${claims},true);
      select public.admin_set_library_publication(gen_random_uuid(),(select id from st),0,public.admin_library_publication((select id from st))#>>'{checks,review_fingerprint}','H06 ortak paket','Test',array['free','plus','pro']::public.plan_code[],'Test programı',true,'published');
      select public.admin_create_package_group_exam('${S.group}',(select id from st),1,'H06 ortak provası',array['source:segments'],now()-interval '1 hour',now()+interval '2 hours',20,array['free','plus','pro']::public.plan_code[]);
      commit;`);
  }
  // D14: düzenlenebilir sentetik AI sorusu (kişi adı uyarılı).
  S.aiQuestion = psql(`select id from public.question_bank where family_id='${f.familyId}' and stem like 'H06:%' limit 1;`) || psql(`insert into public.question_bank(family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,solution,provenance)
    values('${f.familyId}',5,'Fen Bilimleri','Işık','multiple_choice','orta','H06: Elif ışığın yansımasını gözlemliyor. Ay neden ışık kaynağı değildir?',
    '[{"key":"A","text":"Kendi ışığını üretir"},{"key":"B","text":"Güneşten aldığı ışığı yansıtır"},{"key":"C","text":"Işığı yutar"},{"key":"D","text":"Işığı kırar"}]'::jsonb,'B','Ay, Güneş ışığını yansıtır.',
    '{"generator":"ai","model":"synthetic-local","prompt_version":"h06","content_review":{"status":"needs_review","detector":"h06","flags":[{"code":"person_name","names":["Elif"],"fields":["stem"],"suggestion":"Adı genel bir ifadeyle değiştirin."}]}}'::jsonb) returning id;`).split('\n')[0];
}
function appleIdentity(on) {
  if (on) psql(`insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    select 'h06-synthetic-apple-sub','${f.userId}',jsonb_build_object('sub','h06-synthetic-apple-sub','email','${f.email}'),'apple',now(),now(),now()
    where not exists(select 1 from auth.identities where user_id='${f.userId}' and provider='apple');`, 'supabase_admin');
  else psql(`delete from auth.identities where user_id='${f.userId}' and provider='apple' and provider_id='h06-synthetic-apple-sub';`, 'supabase_admin');
}

async function context(opts = {}, { appleSettings = false } = {}) {
  const { viewport, ...rest } = opts;
  const c = await browser.newContext({ viewport: viewport || SIZES.phone, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', ...rest });
  await c.route(backend + '/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const headers = { ...req.headers() };
    if (headers.apikey === placeholderAnon) headers.apikey = f.anon;
    if (headers.authorization === 'Bearer ' + placeholderAnon) headers.authorization = 'Bearer ' + f.anon;
    try {
      const res = await route.fetch({ url: f.url + req.url().slice(backend.length), headers, timeout: 90000 });
      if (appleSettings && /\/auth\/v1\/settings/.test(req.url())) {
        const j = await res.json(); j.external = { ...(j.external || {}), apple: true };
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) });
      }
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 503, body: 'fixture unavailable' }); }
  });
  const p = await c.newPage(); p.setDefaultTimeout(25000);
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  return p;
}
const body = p => p.locator('body').innerText();
const btn = (p, n) => p.getByRole('button', { name: n, exact: true });
async function signIn(p) {
  await p.goto(web + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.email); await p.getByLabel('Şifre', { exact: true }).fill(f.password);
  await p.getByLabel('Şifre', { exact: true }).press('Enter');
  await p.waitForURL('**/parent', { timeout: 30000 });
}
async function enterChildMode(p, name) {
  await p.goto(web + '/parent/child-mode'); await p.waitForTimeout(1500);
  const pick = p.getByRole('button', { name: new RegExp('^' + name) }).first();
  if (await pick.count()) await pick.click();
  await p.getByLabel('Çocuk PIN’i', { exact: true }).fill('1234');
  await btn(p, 'Dünyama gir').click();
  await p.waitForURL('**/parent/child-mode/today', { timeout: 20000 });
}
const sample = async p => { const s = []; for (let i = 0; i < 6; i++) { s.push(await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)); await p.waitForTimeout(40); } return s; };

// Düzen/etkileşim denetimi: kapsam = en üstteki açık modal (aria-modal) ya da sayfa.
async function audit(p) {
  return p.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
    const modals = [...document.querySelectorAll('[aria-modal="true"]')].filter(vis);
    const scope = modals.length ? modals[modals.length - 1] : document.body;
    const sel = 'button,[role=button],a[href],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],input:not([type=hidden]),textarea,select';
    const inter = [...scope.querySelectorAll(sel)].filter(vis).filter(e => !e.closest('[aria-hidden="true"]'))
      .filter(e => !e.parentElement?.closest(sel) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName));
    const name = e => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.innerText || '').join(' ') || e.innerText || e.getAttribute('title') || e.getAttribute('placeholder') || (e.id && document.querySelector(`label[for="${e.id}"]`)?.innerText) || '').trim().replace(/\s+/g, ' ');
    const box = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
    // Kaydırma kabı tarafından kırpılan kısım görünmez: örtüşme yalnız görünen dikdörtgende aranır.
    const clipped = e => { let r = e.getBoundingClientRect(), x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
      for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const st = getComputedStyle(a);
        if (/(hidden|auto|scroll|clip)/.test(st.overflow + st.overflowX + st.overflowY)) { const q = a.getBoundingClientRect(); x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom); } }
      return x2 - x1 > 0 && y2 - y1 > 0 ? { x: x1, y: y1 + scrollY, w: x2 - x1, h: y2 - y1 } : null; };
    const items = inter.map(e => ({ e, n: name(e), b: box(e), c: clipped(e), role: e.getAttribute('role') || e.tagName.toLowerCase(), disabled: e.getAttribute('aria-disabled') === 'true' || e.disabled === true }));
    const small = items.filter(i => i.b.w < 48 || i.b.h < 48).map(i => ({ name: i.n.slice(0, 60), role: i.role, w: i.b.w, h: i.b.h }));
    const unlabeled = items.filter(i => !i.n).map(i => ({ role: i.role, ...i.b }));
    const overlaps = [];
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
      const A = items[a], B = items[b]; if (A.e.contains(B.e) || B.e.contains(A.e) || !A.c || !B.c) continue;
      const ix = Math.min(A.c.x + A.c.w, B.c.x + B.c.w) - Math.max(A.c.x, B.c.x), iy = Math.min(A.c.y + A.c.h, B.c.y + B.c.h) - Math.max(A.c.y, B.c.y);
      if (ix > 4 && iy > 4) overlaps.push([A.n.slice(0, 40), B.n.slice(0, 40)]);
    }
    const offRight = items.filter(i => i.b.x + i.b.w > innerWidth + 1 || i.b.x < -1).map(i => i.n.slice(0, 40));
    const text = (scope.innerText || '');
    return {
      viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth - innerWidth,
      interactive: items.length, small, unlabeled, overlaps, offRight,
      rawKeys: (text.match(/\b(?:h06|d14|u01|accountV5|deletionPreview|subscription|group|groupPhases|experience|sources|notebook|auth|prova|provaP02|common)\.[a-zA-Z0-9_.]+\b/g) || []).slice(0, 5),
      runningAnimations: document.getAnimations().filter(a => a.playState === 'running').length,
    };
  });
}
const layoutClean = a => a.overflow <= 1 && a.overlaps.length === 0 && a.offRight.length === 0 && a.rawKeys.length === 0 && a.unlabeled.length === 0;
async function shotAll(p, name, list = ALL, after) {
  const m = {};
  for (const size of list) {
    await p.setViewportSize(SIZES[size]); await p.waitForTimeout(800);
    if (after) await after(size);
    await p.screenshot({ path: path.join(out, `${name}-${size}.png`), fullPage: true });
    m[size] = await audit(p);
  }
  await p.setViewportSize(SIZES.phone);
  return m;
}
async function failDump(p, name) {
  if (!p) return;
  try { await p.screenshot({ path: path.join(out, `FAILED-${name}.png`), fullPage: true }); fs.writeFileSync(path.join(out, `FAILED-${name}.txt`), (await body(p)).slice(0, 6000)); } catch {}
}
// Klavye: Tab ile odak sırası; birincil eylem ulaşılabilir mi, odaklanan öğe görünür alanda mı.
async function tabWalk(p, target, max = 30) {
  const seen = [];
  await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect();
      return { n: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || '').trim().slice(0, 50), inView: r.top >= 0 && r.top + Math.min(r.height, 48) <= innerHeight + 1 && r.width > 0 }; });
    if (!s) continue; seen.push(s);
    if (target.test(s.n)) return { reached: true, steps: i + 1, allInView: seen.every(x => x.inView), order: seen.map(x => x.n + (x.inView ? '' : ' [görünür alan dışında]')) };
  }
  return { reached: false, allInView: seen.every(x => x.inView), order: seen.map(x => x.n + (x.inView ? '' : ' [görünür alan dışında]')) };
}

const flows = {};

// (1) D8-1: `groups` (katılım / sıralama / sonuç) ve `question-media` pencereleri; normal ve azaltılmış hareket.
flows.group_modals = async () => {
  const childName = 'Synthetic child';
  const openers = {
    join: async p => { await btn(p, t('group.join')).first().click(); await p.getByRole('checkbox', { name: t('group.participation') }).waitFor(); },
    ranking: async p => { await btn(p, t('group.showRanking')).first().click(); await p.getByText(t('group.rankingConsent')).first().waitFor(); },
    result: async p => { await btn(p, t('group.result')).first().click(); await btn(p, t('group.closeResult')).waitFor(); },
  };
  const closers = {
    join: async p => { await btn(p, t('common.cancel')).last().click(); },
    ranking: async p => { await btn(p, t('common.cancel')).last().click(); },
    result: async p => { await btn(p, t('group.closeResult')).click(); },
  };
  const measured = {};
  const probe = async (motion, which, { layout = false, enrollAfter = false } = {}) => {
    const p = await context({ reducedMotion: motion });
    try {
      await signIn(p);
      await p.goto(web + '/parent/prova/groups'); await p.getByText('H06 ortak provası').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(1200);
      const r = {};
      for (const w of which) {
        await openers[w](p).catch(async e => { throw Error(w + ' opener: ' + String(e.message).split('\n')[0]); });
        const samples = await sample(p);
        await p.waitForTimeout(500);
        await p.screenshot({ path: path.join(out, `modal-group_${w}-${motion}-phone.png`) });
        r[w] = { runningAnimationsDuringOpen: samples, ...(layout ? { sizes: await shotAll(p, `modal-group_${w}`) } : {}) };
        if (w === 'join' && enrollAfter) {
          await p.getByText(childName, { exact: true }).last().click();
          await p.getByRole('checkbox', { name: t('group.participation') }).click();
          await btn(p, t('group.enroll')).click();
          await p.getByText(t('group.enrolled', { name: childName }), { exact: true }).waitFor({ timeout: 30000 });
          r.enrolled = true;
        } else await closers[w](p);
        await p.waitForTimeout(600);
      }
      if (p.errors.length) r.pageErrors = p.errors.slice(0, 3);
      return r;
    } catch (e) { await failDump(p, `group-${motion}`); return { error: String(e.message).split('\n')[0] }; }
    finally { await p.context().close(); }
  };
  measured.normalJoin = await probe('no-preference', ['join']);
  measured.reduceJoin = await probe('reduce', ['join'], { layout: true, enrollAfter: true });
  measured.reduceAfter = await probe('reduce', ['ranking', 'result'], { layout: true });
  measured.normalAfter = await probe('no-preference', ['ranking', 'result']);
  const pairs = [['join', measured.reduceJoin.join, measured.normalJoin.join], ['ranking', measured.reduceAfter.ranking, measured.normalAfter.ranking], ['result', measured.reduceAfter.result, measured.normalAfter.result]];
  for (const [w, red, nor] of pairs) {
    const ok = !!red && !!nor && red.runningAnimationsDuringOpen.every(n => n === 0) && nor.runningAnimationsDuringOpen.some(n => n > 0);
    record(`d8_1_group_${w}_modal_respects_reduced_motion`, ok, { reduce: red?.runningAnimationsDuringOpen ?? measured, normal: nor?.runningAnimationsDuringOpen ?? measured });
    if (red?.sizes) record(`h06_group_${w}_modal_layout`, Object.values(red.sizes).every(layoutClean), red.sizes);
  }
  S.groupMeasured = measured;
};

flows.question_media = async () => {
  const entry = psql(`select exam_id from public.group_exam_entries where group_id='${S.group}' and child_id='${f.childId}' limit 1;`);
  assert.ok(entry, 'group entry missing (run group_modals first)');
  const media = psql(`select count(*) from public.learning_source_links l join public.learning_sources s on s.id=l.source_id where s.family_id='${f.familyId}' and s.kind='question_image' and s.status='ready';`);
  const probe = async (motion, layout) => {
    const p = await context({ reducedMotion: motion });
    try {
      await signIn(p); await enterChildMode(p, 'Synthetic child');
      await p.goto(web + `/parent/child-mode/prova/${entry}`); await p.waitForTimeout(3000);
      const startBtn = p.getByRole('button', { name: /^(Başla|Başlayalım|Denemeye başla|Prova’ya başla|Hazırım)/ }).first();
      if (await startBtn.count()) { await startBtn.click(); await p.waitForTimeout(2500); }
      const trigger = p.getByRole('button', { name: /^Görseli büyüt/ }).first();
      for (let i = 0; i < 6 && !(await trigger.count()); i++) {
        const next = btn(p, t('prova.next')).first();
        if (!(await next.count())) break; await next.click(); await p.waitForTimeout(1500);
      }
      if (!(await trigger.count())) { await failDump(p, `question_media-${motion}`); return { error: 'trigger_absent' }; }
      await p.screenshot({ path: path.join(out, `question-with-image-${motion}-phone.png`), fullPage: true });
      await trigger.click();
      const samples = await sample(p);
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(out, `modal-question_media-${motion}-phone.png`) });
      const r = { runningAnimationsDuringOpen: samples };
      if (layout) {
        await btn(p, t('experience.zoomIn')).click(); await p.waitForTimeout(300);
        r.zoomText = (await body(p)).match(/\d+%/)?.[0];
        r.sizes = await shotAll(p, 'modal-question_media');
      }
      if (p.errors.length) r.pageErrors = p.errors.slice(0, 3);
      return r;
    } catch (e) { await failDump(p, `question_media-${motion}`); return { error: String(e.message).split('\n')[0] }; }
    finally { await p.context().close(); }
  };
  const reduce = await probe('reduce', true), normal = await probe('no-preference', false);
  record('d8_1_question_media_modal_respects_reduced_motion', !reduce.error && !normal.error && reduce.runningAnimationsDuringOpen.every(n => n === 0) && normal.runningAnimationsDuringOpen.some(n => n > 0),
    { readyQuestionImages: Number(media), reduce: reduce.runningAnimationsDuringOpen ?? reduce, normal: normal.runningAnimationsDuringOpen ?? normal });
  if (reduce.sizes) record('h06_question_media_modal_layout', Object.values(reduce.sizes).every(layoutClean), { zoomAfterPlus: reduce.zoomText, sizes: reduce.sizes });
};

// (2) H01/H04/H05/D14 değişen ekranları; 4 ölçü; düzen, hedef boyu, etiket, birincil eylem, klavye, azaltılmış hareket.
const expired = 'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
const screens = [
  { name: 'sign-in', url: '/sign-in', signedOut: true, appleSettings: true, primary: t('auth.signIn'), ready: p => p.getByLabel('E-posta', { exact: true }).waitFor(),
    fill: async p => { await p.getByLabel('E-posta', { exact: true }).fill('h06-keyboard@example.invalid'); await p.getByLabel('Şifre', { exact: true }).fill('not-a-real-password'); }, also: [t('experience.social.apple')] },
  { name: 'auth-callback-expired', url: '/auth-callback?' + expired, signedOut: true, primary: t('u01.resendSignup'), ready: p => p.getByText(t('u01.resendTitle')).first().waitFor(), fill: p => p.getByLabel('E-posta', { exact: true }).fill('h06-keyboard@example.invalid') },
  { name: 'auth-callback-fragment-expired', url: '/auth-callback#' + expired, signedOut: true, primary: t('u01.resendSignup'), ready: p => p.getByText(t('u01.resendTitle')).first().waitFor(), fill: p => p.getByLabel('E-posta', { exact: true }).fill('h06-keyboard@example.invalid') },
  { name: 'auth-callback-other-device', url: '/auth-callback?code=00000000-0000-4000-8000-000000000000', signedOut: true, primary: t('u01.backToSignIn'), ready: p => btn(p, t('u01.backToSignIn')).waitFor() },
  { name: 'reset-password-expired', url: '/reset-password?' + expired, signedOut: true, primary: t('accountV5.sendReset'), ready: p => btn(p, t('accountV5.sendReset')).first().waitFor(), fill: p => p.getByLabel('E-posta', { exact: true }).fill('h06-keyboard@example.invalid') },
  { name: 'subscription-ai-consent', url: '/parent/subscription', primary: null, ready: p => p.getByTestId('subscription-ai-consent-note').waitFor(), scrollTo: p => p.getByTestId('subscription-ai-consent-note').scrollIntoViewIfNeeded() },
  { name: 'ai-question-edit', url: () => `/parent/prova/question?editFrom=${S.aiQuestion}`, primary: t('provaP02.editor.next', {}), ready: p => p.getByLabel('Soru', { exact: true }).waitFor() },
  { name: 'account-deletion-apple', url: '/parent/menu?section=account', apple: true, primary: t('accountV5.appleReauth'),
    ready: async p => { const b = btn(p, t('deletionPreview.reviewAccount')); await b.waitFor(); await b.scrollIntoViewIfNeeded(); await b.click(); await btn(p, t('accountV5.appleReauth')).waitFor({ timeout: 30000 }); },
    extraShots: async (p, name) => { for (const size of ['phone', 'narrow']) { await p.setViewportSize(SIZES[size]); await p.waitForTimeout(500); await btn(p, t('accountV5.appleReauth')).scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, `${name}-apple-button-${size}.png`) }); } await p.setViewportSize(SIZES.phone); } },
];
for (const s of screens) {
  flows['screen_' + s.name] = async () => {
    if (s.apple) appleIdentity(true);
    const res = {};
    try {
      for (const motion of ['reduce', 'no-preference']) {
        const p = await context({ reducedMotion: motion }, { appleSettings: !!s.appleSettings });
        try {
          if (!s.signedOut) await signIn(p);
          await p.goto(web + (typeof s.url === 'function' ? s.url() : s.url)); await s.ready(p); await p.waitForTimeout(1500);
          if (motion === 'reduce') {
            res.sizes = await shotAll(p, 'screen-' + s.name, ALL, s.scrollTo ? async () => { await s.scrollTo(p); await p.waitForTimeout(200); } : undefined);
            if (s.primary) {
              const prim = p.getByRole('button', { name: s.primary, exact: true }).first();
              res.primary = { name: s.primary, visible: await prim.isVisible(), disabled: (await prim.getAttribute('aria-disabled')) === 'true' };
              await p.setViewportSize(SIZES.narrow);
              if (s.fill) { await s.fill(p); await p.waitForTimeout(300); res.primary.enabledAfterFill = (await prim.getAttribute('aria-disabled')) !== 'true'; }
              res.keyboard = await tabWalk(p, new RegExp('^' + s.primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
              await p.setViewportSize(SIZES.phone);
            }
            if (s.extraShots) await s.extraShots(p, 'screen-' + s.name);
            for (const extra of s.also || []) res['also:' + extra] = await p.getByRole('button', { name: extra, exact: true }).count();
            res.reducedRunning = await sample(p);
          } else res.normalRunning = await sample(p);
          if (p.errors.length) res['pageErrors_' + motion] = p.errors.slice(0, 3);
        } catch (e) { await failDump(p, 'screen-' + s.name + '-' + motion); throw e; } finally { await p.context().close(); }
      }
    } finally { if (s.apple) appleIdentity(false); }
    const layout = Object.values(res.sizes).every(layoutClean);
    const small = Object.fromEntries(Object.entries(res.sizes).map(([k, v]) => [k, v.small]).filter(([, v]) => v.length));
    record(`h06_screen_${s.name}`, layout && (!s.primary || (res.primary.visible && res.keyboard.reached)) && res.reducedRunning.every(n => n === 0) && !res['pageErrors_reduce'],
      { ...res, smallTargets: small });
  };
}

(async () => {
  seed();
  const db = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ok(!(await db.auth.signInWithPassword({ email: f.email, password: f.password })).error, 'login');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, fn] of Object.entries(flows)) {
    if (only.length && !only.includes(name)) continue;
    try { await fn(); } catch (e) { record(name, false, { error: String(e.message).split('\n')[0] }); }
  }
  const file = path.join(out, only.length ? `checks-${only.join('_').slice(0, 80)}.json` : 'checks.json');
  fs.writeFileSync(file, JSON.stringify({ environment: 'disposable-local-auth-rest-storage-edge; web export; Playwright Chrome headless tr-TR Europe/Istanbul', results }, null, 1));
  console.log(JSON.stringify(results.map(r => [r.check, r.passed])));
  await browser.close();
})().catch(async e => { console.error('FATAL', e.stack); if (browser) await browser.close(); process.exit(1); });
