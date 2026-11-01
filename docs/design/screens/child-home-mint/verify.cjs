// Runs against an Expo web export. Every Supabase request is isolated; no DB writes.
async page => {
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:430,height:932},reducedMotion:'reduce'});
 page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child-home-mint';
 const id='11111111-1111-4111-8111-111111111111';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
 const tasks=['Kitap okuma','Dişlerini fırçala','Matematik tekrarı'].map((title,i)=>({id:'task-'+i,child_id:id,title,icon:['read-book','brush-teeth','homework-math'][i],stars:2,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
 let completions=tasks.slice(0,2).map((task,i)=>({id:'completion-'+i,child_id:id,template_id:task.id,due_date:today,status:i===1?'done':'approved'}));
 let mode='normal',failComplete=false;const errors=[],rpcCalls=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({id})=>{const device=localStorage.getItem('gina-fixture-device')==='yes';const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:device?id:null,device_id:device?id:null,role:device?'device':'parent',admin:false}}))+'.fixture-only';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',is_anonymous:false}}));if(!device)localStorage.setItem('gina-child-mode:'+id,JSON.stringify({id,name:'Ece'}));},{id});
 await page.route('**/auth/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id,aud:'authenticated',role:'authenticated'})}));
 await page.route('**/rest/v1/**',async route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  if(mode==='loading')await new Promise(r=>setTimeout(r,2000));
  if(mode==='error'&&name==='task_templates'){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'fixture_error'})});return;}
  if(name==='complete_task') {rpcCalls.push(req.postDataJSON());if(failComplete){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'fixture_error'})});return;}completions.push({id:'completion-2',child_id:id,template_id:req.postDataJSON().p_template_id,due_date:today,status:'done'});await route.fulfill({status:200,contentType:'application/json',body:'null'});return;}
  if(name==='verify_parent_pin'){rpcCalls.push(req.postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:'false'});return;}
  let body=({children:{id,name:'Ece',avatar:'avatar-reference-girl'},families:{timezone:'Europe/Istanbul'},task_templates:mode==='empty'?[]:tasks,task_completions:completions,star_events:[{child_id:id,delta:12,created_at:today+'T08:00:00Z'}],events:[],event_exceptions:[],child_goals:{id:'goal1',family_rewards:{title:'Ailece sinema',icon:'reward-movie-night',cost_stars:20}}})[name]??[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.routeWebSocket('**/realtime/**',s=>s.close());
 const url='http://localhost:8081/parent/child-mode/today';
 const ready=async()=>{await page.getByText('Matematik tekrarı',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));};
 await page.goto(url);await ready();
 await page.screenshot({path:dir+'/phone.png'});
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:dir+'/tablet.png'});
 checks.push({name:'tablet-overflow',passed:!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))});
 await page.getByRole('button',{name:'Başla',exact:true}).click();
 if(rpcCalls.length)throw Error('Start must not mark task complete');
 await page.screenshot({path:dir+'/task.png'});checks.push({name:'start-opens-without-completing',passed:true});
 failComplete=true;await page.getByRole('button',{name:'Yaptım',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();checks.push({name:'completion-error',passed:true});
 await page.getByRole('button',{name:'Kapat',exact:true}).click();await page.getByRole('button',{name:'Başla',exact:true}).click();checks.push({name:'completion-error-can-reopen',passed:true});failComplete=false;await page.getByRole('button',{name:'Yaptım',exact:true}).click();await page.getByRole('button',{name:'Yaptım',exact:true}).waitFor({state:'detached'});
 await page.getByRole('button',{name:'Kapat',exact:true}).click();await page.getByText('2 onayda',{exact:true}).waitFor();checks.push({name:'completion-updates-pending',passed:true});
 if(rpcCalls[0].p_acting_child_id!==id)throw Error('Wrong acting child');
 await page.getByRole('button',{name:'Ebeveyn',exact:true}).click();await page.getByText('Veli PIN',{exact:false}).first().waitFor();checks.push({name:'parent-pin-required',passed:true});
 await page.getByLabel("Veli PIN'i",{exact:true}).fill('0000');await page.getByRole('button',{name:'Çocuk modundan çık',exact:true}).click();await page.getByRole('alert').waitFor();checks.push({name:'invalid-pin-stays-locked',passed:page.url().endsWith('/today')});await page.getByRole('button',{name:'Vazgeç',exact:true}).click();await page.getByText('Sıradaki adımım',{exact:true}).waitFor();
 completions=completions.slice(0,2);await page.reload();await ready();
 await page.setViewportSize({width:320,height:844});await page.screenshot({path:dir+'/small-phone.png'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 const targets=await page.locator('[role="button"]').evaluateAll(xs=>xs.map(x=>({label:x.getAttribute('aria-label')||x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})).filter(x=>x.w>0&&(x.w<47.5||x.h<47.5)));
 checks.push({name:'320px-no-overflow',passed:!overflow});
 await page.setViewportSize({width:430,height:932});
 for(const [label,target] of [['Prova','prova'],['Koleksiyon','collection'],['Odamı düzenle','room-preview'],['Haftam ve takvimim','week'],['Takvimim','calendar']]){
  await page.getByRole('button',{name:label,exact:true}).last().click();await page.waitForURL('**/parent/child-mode/'+target);checks.push({name:'navigation-'+target,passed:true});await page.goto(url);await ready();
 }
 mode='empty';await page.reload();await page.getByText('Bugün için henüz görev yok',{exact:true}).waitFor();await page.screenshot({path:dir+'/empty.png'});
 mode='loading';await page.reload();await page.getByText('Günün hazırlanıyor…',{exact:true}).waitFor();await page.screenshot({path:dir+'/loading.png'});await ready();
 mode='error';await page.reload();await page.getByRole('button',{name:'Yeniden dene',exact:true}).waitFor({timeout:30000});await page.screenshot({path:dir+'/error.png'});mode='normal';await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await ready();checks.push({name:'error-retry',passed:true});
 await page.setViewportSize({width:1024,height:768});await page.screenshot({path:dir+'/tablet-4x3.png'});
 await page.setViewportSize({width:932,height:430});await page.screenshot({path:dir+'/phone-landscape.png'});checks.push({name:'landscape-phone-overflow',passed:!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))});
 completions=completions.slice(0,2);await page.evaluate(({id})=>{const session=JSON.parse(localStorage.getItem('sb-127-auth-token'));const parts=session.access_token.split('.');const claims=JSON.parse(atob(parts[1]));claims.gina={family_id:id,child_id:id,device_id:id,role:'device',admin:false};parts[1]=btoa(JSON.stringify(claims));session.access_token=parts.join('.');localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.removeItem('gina-child-mode:'+id);localStorage.setItem('gina-fixture-device','yes');},{id});
 await page.goto('http://localhost:8081/child/today');await ready();if(!page.url().endsWith('/child/today'))throw Error('Child route redirected');checks.push({name:'paired-child-route',passed:true});await page.getByRole('button',{name:'Başla',exact:true}).click();await page.getByRole('button',{name:'Yaptım',exact:true}).click();await page.getByRole('button',{name:'Yaptım',exact:true}).waitFor({state:'detached'});if('p_acting_child_id' in rpcCalls.at(-1))throw Error('Paired device must use claim identity');checks.push({name:'paired-child-completion',passed:true});
 const missing=await page.locator('img').evaluateAll(xs=>xs.filter(x=>!x.naturalWidth).length);
 await context.close();return {checks,errors,smallTargets:targets,missingImages:missing,rpcCalls,backend:'isolated HTTP and websocket fixtures; no database writes'};
}
