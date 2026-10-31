// Playwright browser-run-code function. All Supabase traffic is fulfilled locally; no DB writes.
// Captures are app renders with fixture data, not real authenticated-device evidence.
async (page) => {
  const context = await page.context().browser().newContext({locale:'tr-TR',colorScheme:'dark',reducedMotion:'no-preference',recordVideo:{dir:'/Users/enes/.codex/worktrees/gina-avatars/gina/.playwright-mcp/atmosphere-video',size:{width:1280,height:800}}});
  page = await context.newPage();
  const dir = '/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/atmosphere-v5/evidence';
  const id = '11111111-1111-4111-8111-111111111111';
  const child = { id, name: 'Ece', avatar: 'girl-01', grade: 2 };
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Istanbul'}).format(new Date());
  const tasks = ['Dişlerini fırçala','20 dakika kitap oku','Odanı düzenle'].map((title,i)=>({id:`task-${i}`,title,icon:['brush-teeth','read-book','tidy-room'][i],stars:i+1,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
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
  let scenario={key:'rain',time:'09:30',kind:'rain',cloud:.9,windSpeed:6};
  await page.addInitScript(()=>{
    const Original=window.Audio;window.__ginaAudio=[];
    window.Audio=function(...args){const a=new Original(...args);window.__ginaAudio.push(a);return a;};
    window.Audio.prototype=Original.prototype;
  });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const requests=[];
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const req=route.request(),url=new URL(req.url());requests.push({path:url.pathname,method:req.method()});
    const name=url.pathname.split('/').pop();let body=fixtures[name]??[];
    const now=Date.parse('2026-10-31T'+scenario.time+':00Z');
    if(name==='family_room_settings')body={city_id:'745044',sound_enabled:true,motion_enabled:scenario.motion!==false};
    if(name==='room-weather')body={forecast:scenario.kind==='unavailable'?null:{cityId:'745044',updatedAt:new Date(now-3600000).toISOString(),fetchedAt:new Date(now-60000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),hours:[{time:new Date(now-30*60000).toISOString(),temperature:scenario.kind==='snow'?-2:12,cloud:scenario.cloud,windSpeed:scenario.windSpeed,windFrom:60,precipitation:2,kind:scenario.kind}]}};
    if(name==='children' && !url.searchParams.has('id'))body=[child,{...child,id:'22222222-2222-4222-8222-222222222222',name:'Can',grade:5}];
    if(name==='start_exam_attempt')body={id:'attempt-fixture',deadline_at:null};
    if(name==='get_attempt_questions')body=[{id:'q1',kind:'multiple_choice',stem:'Ece’nin 12 kalemi vardı. 4 kalemini arkadaşına verdi. Kaç kalemi kaldı?',choices:[{key:'A',text:'6'},{key:'B',text:'8'},{key:'C',text:'10'},{key:'D',text:'16'}]},{id:'q2',kind:'open',stem:'Nasıl düşündüğünü anlat.',choices:null}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
  });
  await page.routeWebSocket('**/realtime/**',socket=>socket.close());
  await page.setViewportSize({width:1280,height:800});
  await page.clock.setFixedTime(new Date('2026-10-31T09:30:00Z'));
  await page.goto('http://localhost:8083/child/today',{waitUntil:'networkidle'});
  await page.getByText('İstanbul · 12° · Yağmurlu',{exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));
  await page.waitForTimeout(10500); // Record actual native-component motion at rest.
  const video=page.video();await context.close();return {file:await video.path(),errors};
}
