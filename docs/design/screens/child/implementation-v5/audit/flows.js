// Playwright browser-run-code function. All Supabase traffic is fulfilled locally; no DB writes.
// Captures are app renders with fixture data, not real authenticated-device evidence.
async (page) => {
  const context = await page.context().browser().newContext({locale:'tr-TR'});
  page = await context.newPage();
  const dir = '/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/implementation-v5/audit';
  const id = '11111111-1111-4111-8111-111111111111';
  const child = { id, name: 'Ece', avatar: 'girl-01', grade: 2 };
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Istanbul'}).format(new Date());
  const tasks = ['Dişlerini fırçala','20 dakika kitap oku','Odanı düzenle'].map((title,i)=>({id:`task-${i}`,title,icon:['brush-teeth','read-book','tidy-room'][i],stars:i+1,days_of_week:[0,1,2,3,4,5,6],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
  const defs = ['Diş Parlatan','Kitap Kurdu','İlk Adım','25 Görev'].map((title,i)=>({slug:`badge-${i}`,title_i18n:{tr:title,en:title},icon:['badge-tooth-care','badge-bookworm','badge-first-task','badge-gold'][i],sort_order:i}));
  const fixtures = {
    children: child, task_templates:tasks, task_completions:[{template_id:'task-0',due_date:today,status:'approved'}],
    families:{timezone:'Europe/Istanbul'}, star_events:[{delta:12,created_at:today+'T10:00:00Z'}], child_room_preferences:null,
    family_rewards:[{id:'r1',title:'Ailece sinema',icon:'reward-movie-night',cost_stars:20},{id:'r2',title:'Birlikte oyun',icon:'reward-game-time',cost_stars:15}],
    events:[{id:'e1',title:'Ailece sinema',type:'family',child_id:id,starts_at:today+'T16:00:00Z',ends_at:today+'T18:00:00Z',all_day:false,rrule:null,location:'Kent sineması'}],
    badge_definitions:defs, child_badge_awards:defs.slice(0,3).map(x=>({badge_slug:x.slug,awarded_at:'2026-10-25T12:00:00Z'})),
    exams:[{id:'exam-demo',title:'Matematik provası',status:'assigned',timed:false,duration_minutes:null,question_ids:['q1','q2'],exam_attempts:[]},{id:'exam-done',title:'Hayat Bilgisi',status:'completed',timed:false,duration_minutes:null,question_ids:['q3','q4','q5','q6'],exam_attempts:[{status:'completed',mc_total:4,mc_correct:3}]}],
    child_goals:{id:'g1',family_rewards:{title:'Ailece sinema',icon:'reward-movie-night',cost_stars:20}},
  };
  await page.addInitScript(({id})=>{
    const exp=Math.floor(Date.now()/1000)+86400;
    const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:id,device_id:id,role:'device',admin:false}}))+'.fixture-only';
    localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',is_anonymous:true}}));
  },{id});
  const requests=[];
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const req=route.request(),url=new URL(req.url());requests.push({path:url.pathname,method:req.method(),body:req.postDataJSON()});
    const name=url.pathname.split('/').pop();let body=fixtures[name]??[];
    if(name==='children' && !url.searchParams.has('id'))body=[child,{...child,id:'22222222-2222-4222-8222-222222222222',name:'Can',grade:5}];
    if(name==='set_room_preference'){fixtures.child_room_preferences={character_key:req.postDataJSON().p_character,theme_key:'default',pet_key:fixtures.child_room_preferences?.pet_key??'cat'};body=null;}
    if(name==='set_room_pet'){fixtures.child_room_preferences={character_key:fixtures.child_room_preferences?.character_key??'unspecified',theme_key:'default',pet_key:req.postDataJSON().p_pet};body=null;}
    if(name==='verify_parent_pin')body=req.postDataJSON().p_pin==='5678';
    if(name==='start_exam_attempt')body={id:'attempt-fixture',deadline_at:null};
    if(name==='get_attempt_questions')body=[{id:'q1',kind:'multiple_choice',stem:'Ece’nin 12 kalemi vardı. 4 kalemini arkadaşına verdi. Kaç kalemi kaldı?',choices:[{key:'A',text:'6'},{key:'B',text:'8'},{key:'C',text:'10'},{key:'D',text:'16'}]},{id:'q2',kind:'open',stem:'Nasıl düşündüğünü anlat.',choices:null}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
  });
  await page.routeWebSocket('**/realtime/**',socket=>socket.close());
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://localhost:8082/child/room-preview',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('radio',{name:'Karakter 2',exact:true}).click();
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await page.getByText('Odan kaydedildi.',{exact:true}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('radio',{name:'Karakter 2',exact:true}).waitFor();
  if(!await page.getByRole('radio',{name:'Karakter 2',exact:true}).isChecked())throw new Error('Character did not survive reload');
  await page.getByRole('tab',{name:'Dostum',exact:true}).click();
  await page.getByRole('radio',{name:'Köpek',exact:true}).click();
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await page.getByText('Odan kaydedildi.',{exact:true}).waitFor();
  if(fixtures.child_room_preferences.pet_key!=='dog')throw new Error('Pet not saved');
  // Convert the same intercepted fixture into a parent session and seed a persisted UI lock.
  await page.evaluate(({id})=>{
    const auth=JSON.parse(localStorage.getItem('sb-127-auth-token'));const exp=Math.floor(Date.now()/1000)+86400;
    auth.access_token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture-only';
    auth.user.is_anonymous=false;localStorage.setItem('sb-127-auth-token',JSON.stringify(auth));
    localStorage.setItem('gina-child-mode:'+id,JSON.stringify({id,name:'Ece'}));
  },{id});
  // addInitScript originally creates a device token on every navigation. Remove it by opening a second context with just copied storage.
  const parentContext=await page.context().browser().newContext({locale:'tr-TR',storageState:await context.storageState(),viewport:{width:1280,height:800}});
  const parent=await parentContext.newPage();
  await parent.route('http://127.0.0.1:54321/**',async route=>{
    const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
    requests.push({path:url.pathname,method:req.method(),body:req.postDataJSON()});
    let body=fixtures[name]??[];
    if(name==='children' && !url.searchParams.has('id'))body=[child];
    if(name==='verify_parent_pin')body=req.postDataJSON().p_pin==='5678';
    if(name==='set_room_pet'){fixtures.child_room_preferences.pet_key=req.postDataJSON().p_pet;body=null;}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await parent.routeWebSocket('**/realtime/**',s=>s.close());
  await parent.goto('http://localhost:8082/parent/menu',{waitUntil:'domcontentloaded',timeout:60000});
  await parent.waitForURL('**/parent/child-mode/today');
  await parent.reload({waitUntil:'domcontentloaded'});
  await parent.getByRole('button',{name:'Ebeveyn',exact:true}).waitFor();
  await parent.goto('http://localhost:8082/child/week',{waitUntil:'domcontentloaded'});
  await parent.waitForURL('**/parent/child-mode/today');
  await parent.getByRole('button',{name:'Ebeveyn',exact:true}).click();
  await parent.getByLabel('PIN',{exact:true}).fill('0000');
  await parent.getByRole('button',{name:'Çocuk modundan çık',exact:true}).click();
  await parent.getByText("Veli PIN'i yanlış.",{exact:true}).waitFor();
  if(!await parent.evaluate(id=>localStorage.getItem('gina-child-mode:'+id),id))throw new Error('Wrong PIN unlocked the app');
  await parent.getByLabel('PIN',{exact:true}).fill('5678');
  await parent.getByRole('button',{name:'Çocuk modundan çık',exact:true}).click();
  await parent.waitForURL('**/parent');
  if(await parent.evaluate(id=>localStorage.getItem('gina-child-mode:'+id),id))throw new Error('Valid PIN did not remove lock');
  await parentContext.close();await context.close();
  return {characterPersisted:true,petPersisted:true,lockSurvivesReload:true,parentDeepLinkBlocked:true,childDeepLinkBlocked:true,wrongPinRejected:true,correctPinUnlocks:true,allBackendTrafficMocked:true,mutations:requests.filter(r=>r.method==='POST')};
}
