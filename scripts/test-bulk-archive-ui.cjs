const loopbackFixtureFetch = require('./loopback-fixture-fetch.cjs');
// L02 UI: bulk archive/restore on routines, rewards and notes against the disposable fixture
// from `GINA_QA_UI_FIXTURE=… scripts/test-isolated-services.py --run-local --ui-hold` only.
// Web export: GINA_QA_WEB (built against that fixture). Never point this at demo/production.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {chromium}=require(process.env.GINA_QA_PLAYWRIGHT_PATH||'playwright');
const f=JSON.parse(fs.readFileSync(process.env.GINA_QA_UI_FIXTURE||'/tmp/gina-experience-ui-private.json'));
assert.equal(new URL(f.url).hostname,'127.0.0.1');assert.match(f.email,/^gina-[0-9a-f-]+@example\.invalid$/);
const web=process.env.GINA_QA_WEB||'http://127.0.0.1:8189';assert.equal(new URL(web).hostname,'127.0.0.1');
const out=process.cwd()+'/docs/release/bulk-archive-2026-11-06/ui';fs.mkdirSync(out,{recursive:true});
let browser,page,stage='setup';const results=[];
const ok=check=>{results.push({check,passed:true});console.log('PASS '+check);};
(async()=>{
 const login=await loopbackFixtureFetch(f.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:f.anon,'content-type':'application/json'},body:JSON.stringify({email:f.email,password:f.password})});assert.ok(login.ok);const session=await login.json();
 async function api(path,body,prefer){const res=await loopbackFixtureFetch(f.url+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:f.anon,authorization:'Bearer '+session.access_token,'content-type':'application/json',...(prefer?{prefer}:{})},body:body?JSON.stringify(body):undefined});const text=await res.text();assert.ok(res.ok,path+' '+text);return text?JSON.parse(text):null;}
 for(const key of ['childId','familyId'])assert.match(f[key],/^[0-9a-f-]{36}$/);
 // Fresh synthetic children keep this flow independent from the service-contract state.
 const [ada,can]=await api('children',[{family_id:f.familyId,name:'Ada',grade:3},{family_id:f.familyId,name:'Can',grade:5}],'return=representation');
 const tag=randomUUID().slice(0,4);
 const R={goal:randomUUID(),free:randomUUID(),race:randomUUID()};
 const rewardTitle={goal:`Bisiklet turu ${tag}`,free:`Dondurma ${tag}`,race:`Film gecesi ${tag}`};
 await api('family_rewards',Object.entries(R).map(([k,id])=>({id,family_id:f.familyId,title:rewardTitle[k],icon:'reward-movie-night',cost_stars:10})));
 await api('rpc/set_child_goal',{p_reward_id:R.goal,p_acting_child_id:ada.id});
 const T=[['Diş fırçala','pack-school-bag'],['Kitap oku','read-book'],['Oda topla','read-book']].map(([title,icon])=>({id:randomUUID(),family_id:f.familyId,child_id:ada.id,title,icon,stars:1}));
 const other={id:randomUUID(),family_id:f.familyId,child_id:can.id,title:'Can rutini',icon:'read-book',stars:1};
 await api('task_templates',[...T,other]);
 const N=[];for(const [title,body] of [[`Okul toplantısı ${tag}`,'Perşembe 17:00, sınıf öğretmeni.'],[`Doktor randevusu ${tag}`,'Kontrol için gelecek ay.']]){
  const r=await api('rpc/save_parent_note',{p_request_id:randomUUID(),p_id:null,p_revision:null,p_action:'save',p_child_id:ada.id,p_value:{title,body,subject:'',visibility:'family'}});N.push({id:r.id??r.note?.id??r.row?.id,title});}
 if(!N.every(n=>n.id)){const rows=await api(`notes?child_id=eq.${ada.id}&select=id,title`);for(const n of N)n.id=rows.find(r=>r.title===n.title).id;}
 const history=async()=>(await api('rpc/bulk_archive_history',{p_before:null}))??[];
 const runsBefore=(await history()).length;

 browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:390,height:844},locale:'tr-TR',timezoneId:'Europe/Istanbul'});
 await c.route(f.url+'/**',async route=>{try{if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});const res=await route.fetch({ maxRedirects: 0 });await route.fulfill({response:res,headers:{...res.headers(),'access-control-allow-origin':'*'}});}catch{await route.fulfill({status:503,body:'Local fixture unavailable'});}});
 page=await c.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function shot(name){await page.waitForTimeout(400);await page.screenshot({path:`${out}/${name}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document does not overflow: '+name);assert.ok(!(await page.locator('body').innerText()).includes('bulkArchive.'),'translation resolved: '+name);}
 const phone=()=>page.setViewportSize({width:390,height:844}),tablet=()=>page.setViewportSize({width:1280,height:800});
 const btn=name=>page.getByRole('button',{name,exact:true});
 const box=name=>page.getByRole('checkbox',{name,exact:true});
 const text=t=>page.getByText(t,{exact:true});

 stage='login';await page.goto(web);await page.getByLabel('E-posta',{exact:true}).fill(f.email);await page.getByLabel('Şifre',{exact:true}).fill(f.password);await btn('Giriş yap').click();await page.waitForURL('**/parent');

 // --- Rewards: blocked by active goal in preview, server-side partial success, double tap, lost reply.
 stage='rewards_select';await page.goto(`${web}/parent/rewards`);await btn('Katalog').click();await text(rewardTitle.free).waitFor();
 await btn('Arşivlemek için kayıt seç').click();
 for(const k of ['goal','free','race'])await box(rewardTitle[k]).click();
 await text('3 kayıt seçili').waitFor();await shot('rewards-select-phone');
 await btn('Etkiyi gör').click();
 await text('2 kayıt arşivlenecek · 1 kayıt arşivlenemez').waitFor();
 await page.getByRole('checkbox',{name:`${rewardTitle.goal}: Aktif hedefi var`}).waitFor();
 assert.equal(await page.getByRole('checkbox',{name:`${rewardTitle.goal}: Aktif hedefi var`}).isDisabled(),true);
 await shot('rewards-preview-phone');ok('reward_preview_lists_goal_block_with_reason_and_keeps_it_out');
 stage='rewards_race';
 // After the preview, Can picks the third reward as a goal: the server must skip it at apply time.
 await api('rpc/set_child_goal',{p_reward_id:R.race,p_acting_child_id:can.id});
 const applies=[];page.on('request',r=>{if(r.url().endsWith('/rest/v1/rpc/bulk_archive_apply')&&r.method()==='POST')applies.push(JSON.parse(r.postData()));});
 let lose=true;await page.route('**/rest/v1/rpc/bulk_archive_apply',async route=>{if(lose){lose=false;const res=await route.fetch({ maxRedirects: 0 });assert.ok(res.ok());await route.fulfill({status:503,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({message:'Synthetic lost response'})});}else await route.fallback();});
 await btn('Seçilenleri arşivle').dblclick();
 await text('Toplu işlem sonucu alınamadı. Yeniden dene: aynı istek ikinci kez uygulanmaz.').waitFor();
 assert.equal(applies.length,1,'double tap sends one request');ok('double_tap_sends_single_apply');
 await shot('rewards-lost-reply-phone');
 await btn('Seçilenleri arşivle').click();
 await text('1 kayıt arşivlendi').waitFor();await text('1 kayıt atlandı').waitFor();await text('Bir kısmı tamamlandı. Atlanan kayıtların nedeni listede.').waitFor();
 assert.equal(applies.length,2);assert.equal(applies[0].p_idempotency_key,applies[1].p_idempotency_key);assert.deepEqual(applies[0].p_items,applies[1].p_items);
 assert.equal(applies[0].p_items.length,2);assert.ok(!applies[0].p_items.some(i=>i.id===R.goal),'blocked reward not sent');
 await page.getByRole('checkbox',{name:`${rewardTitle.free}: Arşivlendi`}).waitFor();
 await page.getByRole('checkbox',{name:`${rewardTitle.race}: Aktif hedefi var`}).first().waitFor();
 await shot('rewards-partial-result-phone');await tablet();await shot('rewards-partial-result-tablet');await phone();
 const rw=async id=>(await api(`family_rewards?id=eq.${id}&select=archived_at,active`))[0];
 assert.ok((await rw(R.free)).archived_at);assert.equal((await rw(R.race)).archived_at,null);assert.equal((await rw(R.goal)).archived_at,null);
 const afterArchive=await history();assert.equal(afterArchive.length,runsBefore+1,'lost reply retried with the same key makes one run');
 ok('lost_reply_retry_same_key_one_run_partial_success_per_record');
 await btn('Tamam').click();await btn('Arşivlemek için kayıt seç').waitFor();
 assert.equal(await page.getByRole('button',{name:'Aktif',exact:true}).getAttribute('aria-pressed'),'true');
 await text(rewardTitle.free).waitFor({state:'detached'});await text(rewardTitle.race).waitFor();
 ok('reward_list_refreshed_filter_kept_selection_closed');
 await page.unroute('**/rest/v1/rpc/bulk_archive_apply');

 // --- Notes: bulk archive, then bulk restore returns private.
 stage='notes_archive';await page.goto(`${web}/parent/notes`);await text(N[0].title).waitFor();
 await btn('Arşivlemek için kayıt seç').click();for(const n of N)await box(n.title).click();
 await btn('Etkiyi gör').click();await text('2 kayıt arşivlenecek').waitFor();await shot('notes-archive-preview-phone');
 await btn('Seçilenleri arşivle').click();await text('2 kayıt arşivlendi').waitFor();await btn('Tamam').click();
 for(const n of N)assert.ok((await api(`notes?id=eq.${n.id}&select=archived_at`))[0].archived_at);
 ok('notes_bulk_archived');
 stage='notes_restore';await btn('Arşiv').click();await text(N[0].title).waitFor();
 await btn('Geri almak için kayıt seç').click();for(const n of N)await box(n.title).click();
 await btn('Etkiyi gör').click();await text('2 kayıt geri alınacak').waitFor();
 await text('Notlar özel olarak geri döner: yalnız sen görürsün. Paylaşmak için notu ayrıca aç.').waitFor();await shot('notes-restore-preview-phone');
 await btn('Seçilenleri geri al').click();await text('2 kayıt geri alındı').waitFor();
 await page.getByRole('checkbox',{name:`${N[0].title}: Geri alındı · özel not`}).waitFor();
 await shot('notes-restore-result-phone');await tablet();await shot('notes-restore-result-tablet');await phone();
 for(const n of N){const row=(await api(`notes?id=eq.${n.id}&select=archived_at,visibility`))[0];assert.equal(row.archived_at,null);assert.equal(row.visibility,'private');}
 await btn('Tamam').click();await text(N[0].title).waitFor({state:'detached'});
 ok('notes_bulk_restore_returns_private_and_says_so');

 // --- Routines: child filter kept, archive all, restore returns paused.
 stage='routines_archive';await page.goto(`${web}/parent/tasks?childId=${ada.id}`);await text('Diş fırçala').waitFor();
 assert.equal(await text('Can rutini').count(),0);
 await btn('Arşivlemek için kayıt seç').click();await btn('Tümünü seç').click();await text('3 kayıt seçili').waitFor();
 await btn('Etkiyi gör').click();await text('3 kayıt arşivlenecek').waitFor();await btn('Seçilenleri arşivle').click();await text('3 kayıt arşivlendi').waitFor();await btn('Tamam').click();
 stage='routines_restore';await btn('Arşiv').click();await text('Kitap oku').waitFor();
 await btn('Geri almak için kayıt seç').click();await btn('Tümünü seç').click();await btn('Etkiyi gör').click();
 await text('3 kayıt geri alınacak').waitFor();await text('Rutinler duraklatılmış olarak geri döner: çocuğun listesine girmesi için ayrıca devam ettir.').waitFor();
 await shot('routines-restore-preview-phone');
 await btn('Seçilenleri geri al').click();await text('3 kayıt geri alındı').waitFor();
 await page.getByRole('checkbox',{name:'Oda topla: Geri alındı · duraklatılmış'}).waitFor();
 await shot('routines-restore-result-phone');await tablet();await shot('routines-restore-result-tablet');await phone();
 await btn('Tamam').click();
 assert.equal(await page.getByRole('button',{name:'Arşiv',exact:true}).getAttribute('aria-pressed'),'true');
 for(const r of T){const row=(await api(`task_templates?id=eq.${r.id}&select=archived_at,active`))[0];assert.equal(row.archived_at,null);assert.equal(row.active,false);}
 const o=(await api(`task_templates?id=eq.${other.id}&select=archived_at,active`))[0];assert.equal(o.archived_at,null);assert.equal(o.active,true);
 await btn('Duraklatılan').click();await text('Diş fırçala').waitFor();await shot('routines-paused-after-restore-phone');
 ok('routines_child_filter_kept_restore_returns_paused');

 assert.deepEqual(errors,[]);ok('phone_tablet_layout_and_runtime');
 fs.writeFileSync(out+'/ui-checks.json',JSON.stringify({environment:'disposable-local-real-auth-rest',results},null,2)+'\n');console.log(JSON.stringify(results));await browser.close();
})().catch(async e=>{console.log('CHECK_FAILED '+stage+' '+String(e.message).slice(0,900));const dir=process.env.GINA_QA_FAIL_DIR||'/tmp';if(page){await page.screenshot({path:dir+'/gina-bulk-ui-failed.png'}).catch(()=>{});fs.writeFileSync(dir+'/gina-bulk-ui-failure.txt',await page.locator('body').innerText().catch(()=>''));}if(browser)await browser.close();process.exitCode=1;});
