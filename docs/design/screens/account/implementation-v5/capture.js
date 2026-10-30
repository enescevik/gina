// Fully intercepted browser fixtures. Never contacts or writes the demo database.
async page => {
 const browser=page.context().browser(),dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/account/implementation-v5';
 const id='11111111-1111-4111-8111-111111111111';const results=[],errors=[];
 const fixtures={children:[{id,name:'Ece',grade:2,avatar:'avatar-reference-girl'}],families:{id,name:'Çevik Ailesi',invite_code:'AB12CD34',timezone:'Europe/Istanbul'},devices:[],push_preferences:{approvals:true,exams:true,weekly_summary:false},child_shares:[],
 plans:['free','plus','pro'].map((code,i)=>({code,name_i18n:{tr:['Ücretsiz','Gina Plus','Gina Pro'][i]},max_children:[2,4,8][i],max_devices:[1,3,null][i],max_active_tasks_per_child:[5,20,null][i],history_days:[30,180,null][i],ai_weekly:i>0})),
 get_family_entitlement:[{plan:'free',source:'default'}],plan_products:[],store_subscriptions:[],
 get_shared_child_view:{child:{first_name:'Ece',grade:2},label:'Öğretmeni',scopes:['grades','tasks_summary'],expires_at:'2026-12-01T00:00:00Z',grades:[{subject:'Türkçe',score:95,max_score:100,date:'2026-10-29'}],tasks_summary:{days:30,completed:22,approved:20,returned:2}}};
 const routes=[['sign-in','/sign-in','none','Hoş geldin'],['family','/family','unassigned','Ailene yer aç'],['pair','/device/pair','anonymous','Eşleştirme kodu al'],['notifications','/parent/notifications','parent','Bildirim'],['share','/parent/share','parent','Öğretmen'],['subscription','/parent/subscription','parent','Gina Plus'],['teacher-report','/s/fixture-token','none','Ece'],['reset-password','/reset-password','none','Şifreni yenile'],['delete-account','/parent/menu','parent','Hesabımı sil']];
 for(const [slug,path,role,expected] of routes){
  const context=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:844}});const p=await context.newPage();
  p.on('pageerror',e=>errors.push({slug,message:e.message}));
  if(role!=='none')await p.addInitScript(({id,role})=>{const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:role==='parent'?id:null,child_id:null,device_id:null,role:role==='parent'?'parent':'none',admin:false}}))+'.fixture';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'parent@fixture.test',is_anonymous:role==='anonymous'}}));},{id,role});
  await p.route('http://127.0.0.1:54321/**',route=>{const name=new URL(route.request().url()).pathname.split('/').pop();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtures[name]??null)});});
  await p.routeWebSocket('**/realtime/**',s=>s.close());
  await p.goto('http://localhost:8082'+path,{waitUntil:'domcontentloaded'});await p.getByText(expected,{exact:false}).first().waitFor();
  if(slug==='delete-account'){await p.getByRole('button',{name:'Hesabımı sil',exact:true}).click();await p.getByText('Kimliğini doğrulamak',{exact:false}).waitFor();await p.getByRole('button',{name:'Hesabımı kalıcı olarak sil',exact:true}).scrollIntoViewIfNeeded();}
  await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));
  await p.screenshot({path:dir+'/'+slug+'-phone.png'});
  const small=await p.locator('[role="button"],[role="link"],[role="switch"]').evaluateAll(xs=>xs.filter(x=>!x.closest('[aria-hidden="true"]')).map(x=>({label:x.getAttribute('aria-label')||x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})).filter(x=>x.w>0&&(x.w<47.5||x.h<47.5)));
  const missing=await p.locator('img').evaluateAll(xs=>xs.filter(x=>!x.naturalWidth).length);
  results.push({slug,smallTargets:small,missingImages:missing,horizontalOverflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  if(['subscription','share','family'].includes(slug)){await p.evaluate(()=>{const el=Array.from(document.querySelectorAll('div')).find(e=>getComputedStyle(e).overflowY==='auto'&&e.scrollHeight>e.clientHeight+10);if(el)el.scrollTop=el.clientHeight-70;});await p.screenshot({path:dir+'/'+slug+'-part2-phone.png'});}
  await context.close();
 }
 return {results,errors,allBackendTrafficMocked:true};
}
