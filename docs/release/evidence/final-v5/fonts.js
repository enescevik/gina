// Isolated, intercepted fixture browser: no request reaches the demo database.
async page => {
  const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:320,height:844},colorScheme:'dark',reducedMotion:'reduce'});
  page=await context.newPage();
  const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/final-v5/parent';
  const id='11111111-1111-4111-8111-111111111111', can='22222222-2222-4222-8222-222222222222';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
  const children=[{id,name:'Ece',avatar:'avatar-reference-girl',grade:2},{id:can,name:'Can',avatar:'avatar-reference-boy',grade:5}];
  const tasks=['Dişlerini fırçala','20 dakika kitap oku','Odanı düzenle'].map((title,i)=>({id:'task-'+i,child_id:id,title,icon:['brush-teeth','read-book','tidy-room'][i],stars:i+1,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
  const fixtures={
    children, families:{id,name:'Çevik Ailesi',timezone:'Europe/Istanbul',invite_code:'ABCD1234'},family_members:{display_name:'Enes'},
    task_templates:tasks,task_completions:[{id:'completion-1',child_id:id,template_id:'task-0',due_date:today,status:'done',task_templates:{title:tasks[0].title,icon:'brush-teeth',stars:2},children:{name:'Ece'}}],
    star_events:[{child_id:id,delta:12,created_at:today+'T09:00:00Z'},{child_id:can,delta:8,created_at:today+'T09:00:00Z'}],
    events:[{id:'event-1',title:'Yüzme antrenmanı',type:'activity',child_id:id,children:{name:'Ece'},starts_at:today+'T12:30:00Z',ends_at:today+'T13:30:00Z',rrule:null,all_day:false,location:'Spor merkezi'},{id:'event-2',title:'Ailece sinema',type:'family',child_id:null,children:null,starts_at:today+'T15:00:00Z',ends_at:today+'T17:00:00Z',rrule:null,all_day:false,location:'Kent sineması'}],
    event_exceptions:[],notes:[{id:'note-1',title:'Okuma alışkanlığı',body:'Bu hafta her akşam birlikte kitap okuduk.',subject:'Türkçe',child_id:id,children:{name:'Ece'},visibility:'family',updated_at:today+'T09:00:00Z'}],
    grades:[{id:'grade-1',subject:'Fen Bilimleri',kind:'exam',score:85,max_score:100,graded_on:today,note:null}],
    family_rewards:[{id:'reward-1',title:'Ailece sinema',icon:'reward-movie-night',cost_stars:20,active:true},{id:'reward-2',title:'Yeni bir oyuncak',icon:'reward-toy',cost_stars:30,active:true}],
    reward_requests:[{id:'request-1',status:'requested',cost_snapshot:20,requested_at:today+'T09:00:00Z',family_rewards:{title:'Ailece sinema',icon:'reward-movie-night'},children:{name:'Ece'}}],
    devices:[{id:'device-1',name:'Salon tableti',paired_at:today+'T09:00:00Z'}],parent_pin_set:true,
  };
  await page.addInitScript(({id})=>{const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture-only';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',is_anonymous:false}}));},{id});
  const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();requests.push({path:url.pathname,method:req.method()});let body=fixtures[name]??[];
    if(name==='task_completions' && url.searchParams.get('status')==='eq.approved')body=[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'content-range':'0-1/2'}});
  });
  await page.routeWebSocket('**/realtime/**',s=>s.close());
  const routes=[['index','','Ailenin günü'],['tasks','tasks','Dişlerini fırçala'],['rewards','rewards','Ailece sinema'],['calendar','calendar','Yüzme antrenmanı'],['grades','grades','Fen Bilimleri'],['notes','notes','Okuma alışkanlığı'],['menu','menu','ABCD1234'],['child-mode','child-mode','Ece']];
  let releaseFonts;
  const gate=new Promise(resolve=>{releaseFonts=resolve;});
  await page.route('**/*.ttf',async route=>{await gate;await route.continue();});
  await page.goto('http://localhost:8082/parent/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  const waitsForFontFiles=await page.getByRole('button',{name:'Onayla',exact:true}).count()===0;
  releaseFonts();
  await page.getByRole('button',{name:'Onayla',exact:true}).waitFor();
  const faces=await page.evaluate(()=>Array.from(document.fonts).map(f=>({family:f.family,status:f.status})));
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument');
  const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'[style*="Nunito_700Bold"]'});
  const rendered=[];
  for(const nodeId of nodeIds){rendered.push(...(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts);}
  const everyLabelUsesNunito=rendered.length>0&&rendered.every(f=>f.isCustomFont&&f.postScriptName.startsWith('Nunito'));
  await page.screenshot({path:dir+'/index-phone.png'});
  await context.close();
  if(!waitsForFontFiles||!everyLabelUsesNunito||faces.some(f=>f.status!=='loaded'))throw new Error('Font first-paint regression');
  return {waitsForFontFiles,everyLabelUsesNunito,faces,rendered,allBackendTrafficMocked:true};
}
