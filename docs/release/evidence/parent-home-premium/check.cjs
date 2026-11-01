// Actual Expo web screen with isolated HTTP fixtures; never writes to local or production Supabase.
async page => {
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:430,height:932},reducedMotion:'reduce'});
 page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/parent-home-premium';
 const id='11111111-1111-4111-8111-111111111111',can='22222222-2222-4222-8222-222222222222';
 await page.clock.setFixedTime(new Date('2026-11-02T06:41:00Z'));
 const today='2026-11-02';
 const children=[{id,name:'Ece',avatar:'avatar-reference-girl',grade:2},{id:can,name:'Can',avatar:'avatar-reference-boy',grade:5}];
 const tasks=['Dişlerini fırçala','Odanı topla','20 dakika kitap oku'].map((title,i)=>({id:'task-'+i,child_id:id,title,icon:['brush-teeth','tidy-room','read-book'][i],stars:2,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
 const completions=tasks.map((task,i)=>({id:'completion-'+i,child_id:id,template_id:task.id,due_date:today,status:i===2?'done':i===0?'approved':'planned',task_templates:{title:task.title,icon:task.icon,stars:3},children:{name:'Ece'}}));
 tasks.push(...['Dişlerini fırçala','Çantanı hazırla','Kitap oku','Bitkileri sula'].map((title,i)=>({id:'can-task-'+i,child_id:can,title,icon:'read-book',stars:2,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i})));
 completions.push({id:'can-complete',child_id:can,template_id:'can-task-0',due_date:today,status:'approved'});
 const events=[{id:'e1',title:'Matematik',type:'school',child_id:id,children:{name:'Ece'},starts_at:today+'T06:00:00Z',ends_at:today+'T06:40:00Z',all_day:false,rrule:null},{id:'e2',title:'Yüzme',type:'activity',child_id:can,children:{name:'Can'},starts_at:today+'T13:00:00Z',ends_at:today+'T14:00:00Z',all_day:false,rrule:null}];
 let mode='normal',failReview=false;const errors=[],rpcCalls=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({id})=>{const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture-only';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',is_anonymous:false}}));},{id});
 await page.route('**/auth/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id,aud:'authenticated',role:'authenticated'})}));
 await page.route('**/rest/v1/**',async route=>{
   const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
   if(mode==='loading')await new Promise(r=>setTimeout(r,1500));
   if(mode==='error'&&name==='children'){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture failure'})});return;}
   if(name==='review_task') {const body=req.postDataJSON();rpcCalls.push(body);if(failReview){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture review failure'})});return;} const item=completions.find(x=>x.id===body.p_completion_id);item.status=body.p_approve?'approved':'returned';await route.fulfill({status:200,contentType:'application/json',body:'null'});return;}
   let body=({children:mode==='empty'?[]:children,families:{timezone:'Europe/Istanbul'},family_members:{display_name:'Deniz'},task_templates:tasks,task_completions:completions,star_events:[{child_id:id,delta:18},{child_id:can,delta:12}],events,event_exceptions:[],child_goals:u.searchParams.get('child_id')==='eq.'+can?{id:'goal2',family_rewards:{title:'Yeni kitap',icon:'reward-book',cost_stars:20}}:{id:'goal1',family_rewards:{title:'Ailece sinema',icon:'reward-movie-night',cost_stars:30}}})[name]??[];
   if(name==='task_completions'&&u.searchParams.get('status')==='eq.done')body=completions.filter(x=>x.status==='done');
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.routeWebSocket('**/realtime/**',s=>s.close());
 const ready=async()=>{await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));};
 await page.goto('http://localhost:8087/parent');await ready();
 await page.getByTestId('home-goals').getByText('Can · Yeni kitap',{exact:true}).waitFor();
 await page.screenshot({path:dir+'/phone.png'});
 await page.getByTestId('home-goals').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/phone-more.png'});
 await page.getByText('Merhaba, Deniz',{exact:true}).scrollIntoViewIfNeeded();
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(250);await page.screenshot({path:dir+'/tablet.png'});
 checks.push({name:'tablet',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 const bars=await page.getByTestId('home-progress').getByRole('progressbar').evaluateAll(xs=>xs.map(x=>({label:x.getAttribute('aria-label'),now:x.getAttribute('aria-valuenow'),max:x.getAttribute('aria-valuemax')})));
 if(JSON.stringify(bars.map(b=>[b.now,b.max]))!==JSON.stringify([['2','3'],['1','4']]))throw Error('Incorrect task progress '+JSON.stringify(bars));
 checks.push({name:'progress uses separate child counts',passed:true});
 await page.getByRole('button',{name:'Can profilini göster',exact:true}).first().click();
 if(await page.getByTestId('home-approvals').getByText('20 dakika kitap oku').count())throw Error('Cross-child approval leak');
 if(await page.getByTestId('home-goals').getByText('Ece · Ailece sinema').count())throw Error('Cross-child goal leak');
 checks.push({name:'child-filter',passed:true});
 await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().click();
 failReview=true;await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('alert').waitFor();checks.push({name:'review-error-visible',passed:true});
 failReview=false;await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('button',{name:'Onayla',exact:true}).waitFor({state:'detached'});checks.push({name:'approve-refresh',passed:completions[2].status==='approved'});
 completions[2].status='done';await page.reload();await ready();await page.getByRole('button',{name:'Geri gönder',exact:true}).click();await page.getByRole('button',{name:'Geri gönder',exact:true}).waitFor({state:'detached'});await page.getByTestId('home-tasks').getByText('Ece · Geri gönderildi',{exact:true}).waitFor();checks.push({name:'return-refresh',passed:true});
 await page.setViewportSize({width:430,height:932});mode='empty';await page.reload();await page.getByText('İlk çocuğunu ekle',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));await page.screenshot({path:dir+'/empty-phone.png'});
 await page.getByRole('button',{name:'Çocuk ekle',exact:true}).click();await page.waitForURL('**/parent/menu');checks.push({name:'first child action opens family',passed:true});
 mode='loading';await page.goto('http://localhost:8087/parent');await page.getByText('Birazdan hazır…',{exact:true}).waitFor();await page.screenshot({path:dir+'/loading-phone.png'});await ready();
 mode='error';await page.reload();await page.getByRole('button',{name:'Yeniden dene',exact:true}).waitFor({timeout:30000});await page.screenshot({path:dir+'/error-phone.png'});mode='normal';await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await ready();checks.push({name:'error-retry',passed:true});
 completions[2].status='done';await page.reload();await ready();
 await page.setViewportSize({width:320,height:844});await page.waitForTimeout(250);await page.screenshot({path:dir+'/small-phone.png'});checks.push({name:'320px',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 const smallTargets=await page.locator('[role="button"],[role="link"]').evaluateAll(xs=>xs.map(x=>({label:x.getAttribute('aria-label')||x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})).filter(x=>x.w>0&&(x.w<47.5||x.h<47.5)));
 const missing=await page.locator('img').evaluateAll(xs=>xs.filter(x=>!x.naturalWidth).length);
 for (const [label,target] of [['Görev ekle','/parent/tasks'],['Prova hazırla','/parent/prova/exam'],['Ödül ekle','/parent/rewards'],['Takvimi aç','/parent/calendar'],['Bildirim ayarları','/parent/notifications'],['Çocuk alanına geç','/parent/child-mode']]) {
   await page.getByRole(label==='Takvimi aç'?'link':'button',{name:label,exact:true}).click();await page.waitForURL('**'+target);checks.push({name:'navigation '+target,passed:true});await page.goto('http://localhost:8087/parent');await ready();
 }
 if(smallTargets.length||missing||errors.length||checks.some(c=>c.overflow||c.passed===false))throw Error(JSON.stringify({smallTargets,missing,errors,checks}));
 await context.close();return {checks,errors,smallTargets,missingImages:missing,rpcCalls,backend:'all HTTP and realtime isolated; no database writes'};
}
