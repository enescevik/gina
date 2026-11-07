const { loopbackFixtureRouteFetch } = require('./loopback-fixture-fetch.cjs');
const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// U03/L04 calendar UI: past day shows that day's routine version, a later-dated edit leaves today
// unchanged, archived events stay hidden from the parent, and "Tümü" with two children does not repeat
// per-child blocks. Only against the disposable fixture from
// `GINA_QA_UI_FIXTURE=… scripts/test-isolated-services.py --run-local --ui-hold` and a web export built
// against it (GINA_QA_WEB). Never point this at demo/production.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {chromium}=require(process.env.GINA_QA_PLAYWRIGHT_PATH||'playwright');
const f=JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE));
assert.equal(new URL(f.url).hostname,'127.0.0.1');assert.match(f.email,/^gina-[0-9a-f-]+@example\.invalid$/);
const web=process.env.GINA_QA_WEB;assert.equal(new URL(web).hostname,'127.0.0.1');
const out=process.cwd()+'/docs/release/calendar-plan-history-2026-11-06/ui';fs.mkdirSync(out,{recursive:true});
let browser,page,stage='setup';const results=[];
const ok=(check,detail)=>{results.push({check,passed:true,...(detail?{detail}:{})});console.log('PASS '+check);};
const istanbulDay=(offset=0)=>{const d=new Date(Date.now()+offset*86400000);return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
(async()=>{
 const login=await loopbackFixtureFetch(f.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:f.anon,'content-type':'application/json'},body:JSON.stringify({email:f.email,password:f.password})});assert.ok(login.ok);const session=await login.json();
 async function api(path,body,prefer,method){const res=await loopbackFixtureFetch(f.url+'/rest/v1/'+path,{method:method??(body?'POST':'GET'),headers:{apikey:f.anon,authorization:'Bearer '+session.access_token,'content-type':'application/json',...(prefer?{prefer}:{})},body:body?JSON.stringify(body):undefined});const text=await res.text();assert.ok(res.ok,path+' '+text);return text?JSON.parse(text):null;}
 await api(`families?id=eq.${f.familyId}`,{timezone:'Europe/Istanbul'},null,'PATCH');
 const today=istanbulDay(0),yesterday=istanbulDay(-1),later=istanbulDay(3);
 const tag=randomUUID().slice(0,4);
 const [ada,can]=await api('children',[{family_id:f.familyId,name:`Ada ${tag}`,grade:3},{family_id:f.familyId,name:`Can ${tag}`,grade:5}],'return=representation');
 // Routine known since ten days ago; renamed today; renamed again for three days later.
 const R=randomUUID(),R2=randomUUID();
 const base={icon:'read-book',stars:2,days_of_week:[1,2,3,4,5,6,7],time_of_day:'evening',requires_approval:false};
 await api('task_templates',[{id:R,family_id:f.familyId,child_id:ada.id,title:`Kitap oku ${tag}`,...base,starts_on:istanbulDay(-10)},{id:R2,family_id:f.familyId,child_id:can.id,title:`Oda topla ${tag}`,...base,starts_on:istanbulDay(-10)}]);
 const rev=async()=>(await api(`task_templates?id=eq.${R}&select=revision`))[0].revision;
 const now=await api('rpc/change_task_routine',{p_request_id:randomUUID(),p_id:R,p_revision:await rev(),p_action:'save',p_value:{title:`Kitap oku ${tag} (20 dk)`,...base}});
 assert.equal(now.effective_from,today);
 const sched=await api('rpc/change_task_routine',{p_request_id:randomUUID(),p_id:R,p_revision:await rev(),p_action:'save',p_value:{title:`Kitap oku ${tag} (30 dk)`,...base,stars:3},p_effective_from:later});
 assert.equal(sched.effective_from,later);
 const live=(await api(`task_templates?id=eq.${R}&select=title`))[0].title;
 assert.equal(live,`Kitap oku ${tag} (30 dk)`,'live row already carries the scheduled settings');
 // Timetable saved today (no older version exists → past days are "unknown before").
 const lessons=[1,2,3,4,5,6,7].map(d=>({id:'m'+d,day:d,title:'Matematik',start:'09:00',end:'09:40'}));
 await api('rpc/save_school_timetable_request',{p_request_id:randomUUID(),p_child_id:ada.id,p_revision:0,p_lessons:lessons,p_settings:{start:'09:00',duration:40,break:10}});
 // Events: one live, one archived, one family-wide.
 const at=(day,time)=>new Date(`${day}T${time}:00+03:00`).toISOString();
 const ev=(id,title,child,type='activity')=>api('rpc/save_calendar_event',{p_request_id:randomUUID(),p_event_id:id,p_revision:0,p_values:{title,type,child_id:child,starts_at:at(today,'17:00'),ends_at:at(today,'18:00'),all_day:false,location:null,rrule:null}});
 const E={live:randomUUID(),archived:randomUUID(),family:randomUUID()};
 await ev(E.live,`Piyano ${tag}`,ada.id);await ev(E.archived,`Yüzme ${tag}`,ada.id);await ev(E.family,`Aile yemeği ${tag}`,null,'family');
 const archivedRun=await api('rpc/bulk_archive_apply',{p_items:[{type:'event',id:E.archived,revision:1}],p_idempotency_key:randomUUID()});
 assert.equal(archivedRun.summary.ok,1);
 assert.deepEqual(await api(`events?id=eq.${E.archived}&select=id`),[],'parent REST read no longer returns the archived event');
 ok('archived_event_hidden_from_parent_rest_read');

 browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:390,height:844},locale:'tr-TR',timezoneId:'Europe/Istanbul'});
 await c.route(f.url+'/**',async route=>{try{if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});const res=await loopbackFixtureRouteFetch(route);await route.fulfill({response:res,headers:{...res.headers(),'access-control-allow-origin':'*'}});}catch{await route.fulfill({status:503,body:'Local fixture unavailable'});}});
 page=await c.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function shot(name){await page.waitForFunction(()=>!document.querySelector('[role=progressbar]'));await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document does not overflow: '+name);const body=await page.locator('body').innerText();assert.ok(!/dayPlan\.|planHistory\./.test(body),'translation resolved: '+name);}
 const phone=()=>page.setViewportSize({width:390,height:844}),desktop=()=>page.setViewportSize({width:1280,height:800});
 const text=t=>page.getByText(t,{exact:true});
 const open=async(day,child)=>{await page.goto(`${web}/parent/calendar?date=${day}${child?`&childId=${child}`:''}`);};

 stage='login';await page.goto(web);await page.getByLabel('E-posta',{exact:true}).fill(f.email);await page.getByLabel('Şifre',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL('**/parent');

 stage='past_day';await open(yesterday,ada.id);
 await text(`Kitap oku ${tag}`).waitFor();await text('Geçmiş gün').waitFor();
 assert.equal(await text(`Kitap oku ${tag} (20 dk)`).count(),0);assert.equal(await text(`Kitap oku ${tag} (30 dk)`).count(),0);
 await page.getByText(/Bu günün planı kayıtlarda yok/).first().waitFor();
 await text('Matematik').first().waitFor();
 await shot('past-day-old-routine-phone');
 await text(`Kitap oku ${tag}`).scrollIntoViewIfNeeded();await shot('past-day-tasks-section-phone');await desktop();await shot('past-day-old-routine-desktop');await phone();
 ok('past_day_shows_that_days_routine_name_and_unknown_timetable_marker');

 stage='today';await open(today,ada.id);
 await text(`Kitap oku ${tag} (20 dk)`).waitFor();await text('Bugün').first().waitFor();
 assert.equal(await text(`Kitap oku ${tag} (30 dk)`).count(),0,'scheduled edit does not change today');
 assert.equal(await text(`Kitap oku ${tag}`).count(),0);
 await text(`Piyano ${tag}`).waitFor();assert.equal(await text(`Yüzme ${tag}`).count(),0,'archived event hidden in calendar');
 await text('Görevler').waitFor();await text('Etkinlikler').waitFor();await text('Dersler').waitFor();
 await shot('today-scheduled-edit-unchanged-phone');
 await text('Görevler').scrollIntoViewIfNeeded();await shot('today-tasks-section-phone');await desktop();await shot('today-scheduled-edit-unchanged-desktop');await phone();
 ok('future_dated_edit_keeps_today_unchanged',{live_row_title:live});
 ok('archived_event_hidden_in_parent_calendar');

 stage='later';await open(later,ada.id);
 await text(`Kitap oku ${tag} (30 dk)`).waitFor();await page.getByText(/tarihinden itibaren geçerli olacak ayarlar/).first().waitFor();
 await text(`Kitap oku ${tag} (30 dk)`).scrollIntoViewIfNeeded();await shot('later-day-scheduled-routine-phone');
 ok('scheduled_day_shows_new_routine_with_note');

 stage='all_children';await open(today);
 await page.getByRole('button',{name:'Tümü',exact:true}).waitFor();
 await text('Çocuklara göre').waitFor();
 await page.getByRole('button',{name:`Ada ${tag} için günün ayrıntısını aç`,exact:true}).waitFor();
 await page.getByRole('button',{name:`Can ${tag} için günün ayrıntısını aç`,exact:true}).waitFor();
 assert.equal(await page.getByText(/Çanta listesi/).count(),0,'no per-child bag block in Tümü');
 assert.equal(await text(`Aile yemeği ${tag}`).count(),1,'family event listed once');
 await text(`Kitap oku ${tag} (20 dk)`).waitFor();await text(`Oda topla ${tag}`).waitFor();
 assert.equal(await text(`Yüzme ${tag}`).count(),0);
 await shot('all-children-today-phone');
 await text('Çocuklara göre').scrollIntoViewIfNeeded();await shot('all-children-summary-rows-phone');await desktop();await shot('all-children-today-desktop');await phone();
 await page.getByRole('button',{name:`Ada ${tag} için günün ayrıntısını aç`,exact:true}).click();
 await page.getByText(`Ada ${tag} · Çanta listesi`).waitFor();assert.equal(await text(`Oda topla ${tag}`).count(),0);
 await shot('all-children-open-ada-phone');
 ok('all_children_no_repeated_child_blocks_and_open_child_detail');

 assert.deepEqual(errors,[]);ok('phone_desktop_layout_and_runtime');
 fs.writeFileSync(out+'/ui-checks.json',JSON.stringify({environment:'disposable-local-real-auth-rest',today,results},null,2)+'\n');console.log(JSON.stringify(results));await browser.close();
})().catch(async e=>{console.log('CHECK_FAILED '+stage+' '+String(e.message).slice(0,900));const dir=process.env.GINA_QA_FAIL_DIR||'/tmp';if(page){await page.screenshot({path:dir+'/gina-cal-ui-failed.png',fullPage:true}).catch(()=>{});fs.writeFileSync(dir+'/gina-cal-ui-failure.txt',await page.locator('body').innerText().catch(()=>''));}if(browser)await browser.close();process.exitCode=1;});
