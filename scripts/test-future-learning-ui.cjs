// Acceptance harness: use a fresh --ui-hold disposable fixture, never production or demo data.
// GINA_QA_UI_FIXTURE, GINA_QA_WEB, GINA_QA_OUT and optionally GINA_QA_PLAYWRIGHT_PATH.
const assert=require('node:assert/strict');const fs=require('node:fs');const {execFileSync}=require('node:child_process');const {randomUUID}=require('node:crypto');
const {chromium}=require(process.env.GINA_QA_PLAYWRIGHT_PATH||"playwright");
const f=JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE,'utf8'));const api=new URL(f.url);
assert.equal(api.hostname,'127.0.0.1');assert.equal(api.protocol,'http:');assert.equal(api.username+api.password,'');assert.match(f.email,/^gina-[0-9a-f-]+@example\.invalid$/);
for(const key of ['familyId','userId','childId'])assert.match(f[key],/^[0-9a-f-]{36}$/);
const webUrl=new URL(process.env.GINA_QA_WEB);assert.equal(webUrl.protocol,'http:');assert.equal(webUrl.hostname,'127.0.0.1');assert.equal(webUrl.username+webUrl.password,'');const web=webUrl.origin;
function sql(db,text){assert.ok(db==='postgres'||/^gina_http_[0-9a-f]{16}_audit$/.test(db));return execFileSync('docker',['exec','-i','supabase_db_gina','psql','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{input:text}).toString().trim();}
const dbs=sql('postgres',"select datname from pg_database where datname like 'gina_http_%_audit'").split('\n').filter(x=>/^gina_http_[0-9a-f]{16}_audit$/.test(x));
const matches=dbs.filter(db=>sql(db,`select count(*) from public.families where id='${f.familyId}'`)==='1');assert.equal(matches.length,1);const db=matches[0];
const grade=Number(sql(db,`select grade from public.children where id='${f.childId}' and family_id='${f.familyId}'`));assert.ok(grade>=1&&grade<=12);
const q1=randomUUID(),q2=randomUUID(),g=randomUUID(),e=randomUUID(),a=randomUUID();
sql(db,`begin;
insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,expected_answer,provenance) values
('${q1}','${f.familyId}',${grade},'Matematik','Toplama','open_ended',E'Yıldızlı Defter\\nGina defterine önce üç, sonra dört yıldız çizdi.\\n\\nToplam kaç yıldız çizdi?','7','{"outcome_ids":["QA.TOPLAMA"],"curriculum_version":"QA"}'),
('${q2}','${f.familyId}',${grade},'Matematik','Toplama','open_ended',E'Yıldızlı Defter\\nGina defterine önce üç, sonra dört yıldız çizdi.\\n\\nİki yıldız daha çizerse toplam kaç olur?','9','{"outcome_ids":["QA.TOPLAMA"],"curriculum_version":"QA"}');
insert into public.question_source_groups(id,family_id,series_id,version,title,body,grade,subject) values('${g}','${f.familyId}','${g}',1,'Yıldızlı Defter','Gina defterine önce üç, sonra dört yıldız çizdi.',${grade},'Matematik');
insert into public.question_source_members(group_id,question_id,prompt,position) values('${g}','${q1}','Toplam kaç yıldız çizdi?',1),('${g}','${q2}','İki yıldız daha çizerse toplam kaç olur?',2);
update public.question_source_groups set finalized_at=now() where id='${g}';
insert into public.app_settings(key,value) values('question_groups.enabled','true') on conflict(key) do update set value='true';
insert into public.question_reactions(family_id,parent_user_id,question_id) values('${f.familyId}','${f.userId}','${q1}');
insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,kind) values('${e}','${f.familyId}','${f.childId}','Sentetik Prova','Matematik',${grade},array['${q1}','${q2}']::uuid[],'assigned','level_test');
insert into public.exam_attempts(id,family_id,exam_id,child_id,status,finished_at) values('${a}','${f.familyId}','${e}','${f.childId}','submitted',now());
insert into public.exam_answers(attempt_id,question_id,answer_text,score) values('${a}','${q1}','7',100),('${a}','${q2}','8',50);
commit;`);
const results=[];const pass=x=>{results.push(x);console.log('PASS '+x);};
const out=process.env.GINA_QA_OUT;assert.ok(out);fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'tr-TR',timezoneId:'Europe/Istanbul'});
 await ctx.route(f.url+'/**',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});const res=await route.fetch();return route.fulfill({response:res,headers:{...res.headers(),'access-control-allow-origin':'*'}});});
 const page=await ctx.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',err=>errors.push(err.name));
 const fit=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 async function sizes(name){for(const [label,w,h] of [['phone',390,844],['tablet',1280,800]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(250);assert.ok(await fit());await page.screenshot({path:`${out}/${name}-${label}.png`});pass(name+' '+label+' layout');}}
 await page.goto(web);await page.getByLabel('E-posta',{exact:true}).fill(f.email);await page.getByLabel('Şifre',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL('**/parent');
 await page.goto(web+'/parent/prova/reading');const toggle=page.getByRole('switch',{name:'Akşam dinlenme hatırlatması'}).first();await toggle.waitFor();await toggle.click();await page.getByText('Başlangıç (aile saat dilimi)',{exact:true}).first().waitFor();assert.equal(await toggle.getAttribute('aria-checked'),'true');pass('evening preference saves and reveals clock controls');await sizes('preferences');
 await page.goto(web+'/parent/prova/progress?childId='+f.childId);await page.getByText('Kazanım Etiketlerine Göre Gözlemler',{exact:true}).waitFor();await page.getByText('QA.TOPLAMA',{exact:true}).waitFor();await page.getByText(/yorum yapmak için henüz az veri/).first().waitFor();pass('insufficient evidence does not render a score');await sizes('observations');
 await page.goto(web+'/parent/prova/favorites');await page.getByText(/Yıldızlı Defter/).waitFor();await sizes('favorites');await page.getByRole('switch',{name:'Tekrar taslağına ekle'}).first().click();await page.getByRole('button',{name:'Taslağı hazırla (1 seçili)',exact:true}).click();await page.waitForURL('**/parent/prova/builder?draftId=*');
 const id=new URL(page.url()).searchParams.get('draftId');assert.match(id,/^[0-9a-f-]{36}$/);const stored=JSON.parse(sql(db,`select content::text from public.prova_drafts where id='${id}' and family_id='${f.familyId}'`));assert.equal(stored.childId,f.childId);assert.equal(stored.target,2);assert.equal(stored.blocks.length,1);assert.equal(stored.blocks[0].kind,'group');assert.equal(stored.blocks[0].id,g);pass('favorite group opens a private two-question draft');assert.deepEqual(errors,[]);pass('no uncaught browser errors');fs.writeFileSync(out+'/results.json',JSON.stringify({checks:results,failures:[]},null,2)+'\n');
 }finally{await browser.close();}})().catch(err=>{console.error(err.message);process.exitCode=1;});
