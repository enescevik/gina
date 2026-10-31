// Playwright browser-run-code function. All Supabase traffic is fulfilled locally; no DB writes.
// Captures are app renders with fixture data, not real authenticated-device evidence.
async (page) => {
  const context = await page.context().browser().newContext({locale:'tr-TR',colorScheme:'dark',reducedMotion:'reduce'});
  page = await context.newPage();
  const dir = '/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/final-v5/child';
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
    const req=route.request(),url=new URL(req.url());requests.push({path:url.pathname,method:req.method()});
    const name=url.pathname.split('/').pop();let body=fixtures[name]??[];
    if(name==='children' && !url.searchParams.has('id'))body=[child,{...child,id:'22222222-2222-4222-8222-222222222222',name:'Can',grade:5}];
    if(name==='start_exam_attempt')body={id:'attempt-fixture',deadline_at:null};
    if(name==='get_attempt_questions')body=[{id:'q1',kind:'multiple_choice',stem:'Ece’nin 12 kalemi vardı. 4 kalemini arkadaşına verdi. Kaç kalemi kaldı?',choices:[{key:'A',text:'6'},{key:'B',text:'8'},{key:'C',text:'10'},{key:'D',text:'16'}]},{id:'q2',kind:'open',stem:'Nasıl düşündüğünü anlat.',choices:null}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
  });
  await page.routeWebSocket('**/realtime/**',socket=>socket.close());
  const allRoutes=[['room-preview','room-preview'],['week','week'],['calendar','calendar'],['goal','goal'],['collection','collection'],['index',''],['pin','pin?childId='+id+'&name=Ece'],['prova-index','prova'],['prova-exam','prova/exam-demo'],['today','today']];
  const routes=allRoutes.filter(x=>['today','room-preview','week','pin','index'].includes(x[0]));
  const results=[];
  for(const [slug,route] of routes){
    for(const [device,width,height] of [['tablet',1280,800],['phone',390,844]]){
    await page.setViewportSize({width,height});
      await page.goto('http://localhost:8082/child/'+route,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>document.body.innerText.trim().length>0);
      const expected = {'room-preview':'Odamı düzenle',week:'Dişlerini fırçala',calendar:'Ailece sinema',goal:'Ailece sinema',collection:'Diş Parlatan',index:'Ece',pin:'Çocuk PIN’i','prova-index':'Matematik provası','prova-exam':'Soru 1 / 2',today:'Dişlerini fırçala'}[slug];
      await page.getByText(expected,{exact:true}).first().waitFor();
      await page.waitForFunction(()=>["Baloo2_600SemiBold","Baloo2_700Bold","Baloo2_800ExtraBold","Nunito_400Regular","Nunito_600SemiBold","Nunito_700Bold"].every(name=>Array.from(document.fonts).some(f=>f.family.replaceAll('"','')===name&&f.status==='loaded')));
      await page.waitForFunction(()=>!document.querySelector('[role="progressbar"]'));
      await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));
      const missing=await page.locator('img').evaluateAll(xs=>xs.filter(x=>x.naturalWidth===0).length);
      const body=await page.locator('body').innerText();
      await page.screenshot({path:`${dir}/${slug}-${device}.png`});
      results.push({slug,device,missingImages:missing,body:body.slice(0,160),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    }
  }
  await context.close();
  return {results,interceptedRequests:requests.length,allBackendTrafficMocked:true};
}
