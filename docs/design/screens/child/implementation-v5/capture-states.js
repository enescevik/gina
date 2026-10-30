// Playwright browser-run-code function. All Supabase traffic is fulfilled locally; no DB writes.
// Captures are app renders with fixture data, not real authenticated-device evidence.
async (page) => {
  const context = await page.context().browser().newContext({locale:'tr-TR'});
  page = await context.newPage();
  const dir = '/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/implementation-v5';
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
  let state="normal"; const pending=[];
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const req=route.request(),url=new URL(req.url());requests.push({path:url.pathname,method:req.method()});
    const name=url.pathname.split('/').pop();let body=fixtures[name]??[];
    if(name==='task_templates' && state==='empty') body=[];
    if(name==='task_templates' && state==='loading') { pending.push(route); return; }
    if(name==='task_templates' && state==='error') { await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Bağlantı kurulamadı. Lütfen daha sonra tekrar dene.'})}); return; }
    if(name==='children' && !url.searchParams.has('id'))body=[child,{...child,id:'22222222-2222-4222-8222-222222222222',name:'Can',grade:5}];
    if(name==='start_exam_attempt')body={id:'attempt-fixture',deadline_at:null};
    if(name==='get_attempt_questions')body=[{id:'q1',kind:'multiple_choice',stem:'Ece’nin 12 kalemi vardı. 4 kalemini arkadaşına verdi. Kaç kalemi kaldı?',choices:[{key:'A',text:'6'},{key:'B',text:'8'},{key:'C',text:'10'},{key:'D',text:'16'}]},{id:'q2',kind:'open',stem:'Nasıl düşündüğünü anlat.',choices:null}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
  });
  await page.routeWebSocket('**/realtime/**',socket=>socket.close());
  const results=[];
  for(state of ['empty','loading','error']){
    await page.goto('http://localhost:8082/child/week');
    if(state==='loading') { await page.getByText('Haftam',{exact:true}).waitFor(); await page.getByText('Odan hazırlanıyor…',{exact:true}).waitFor(); }
    else if(state==='error') await page.getByText('Bağlantı kurulamadı. Lütfen daha sonra tekrar dene.',{exact:true}).waitFor();
    else await page.getByText('Görev yok',{exact:true}).waitFor();
    for(const [device,width,height] of [['phone',390,844],['tablet',1280,800]]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));
      await page.screenshot({path:`${dir}/state-${state}-${device}.png`});
      results.push({state,device,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    }
    for(const route of pending.splice(0)) await route.abort();
  }
  await page.setViewportSize({width:390,height:844});
  state='normal';
  await page.goto('http://localhost:8082/child/room-preview');
  await page.getByRole('tab',{name:'Dostum',exact:true}).click();
  await page.getByRole('radio',{name:'Dostum olmasın',exact:true}).click();
  const petNone=await page.getByRole('radio',{name:'Dostum olmasın',exact:true}).isChecked();
  await page.getByRole('tab',{name:'Karakter',exact:true}).click();
  await page.getByRole('radio',{name:'Karakter 2',exact:true}).click();
  const character=await page.getByRole('radio',{name:'Karakter 2',exact:true}).isChecked();
  await page.goto('http://localhost:8082/child/prova/exam-demo');
  await page.getByRole('radio',{name:'B, 8',exact:true}).click();
  const answer=await page.getByRole('radio',{name:'B, 8',exact:true}).isChecked();
  await page.getByRole('button',{name:'Sonraki',exact:true}).click();
  await page.getByText('Soru 2 / 2',{exact:true}).waitFor();
  await page.screenshot({path:`${dir}/prova-open-answer-phone.png`});
  if(!petNone || !character || !answer) throw new Error('Radio selection failed');
  const report={results,interactions:{petNone,character,answer,nextQuestion:true},interceptedRequests:requests.length,allBackendTrafficMocked:true};
  await context.close();
  return report;
}
