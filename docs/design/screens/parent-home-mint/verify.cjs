// Actual Expo web screen with isolated HTTP fixtures; never writes to local or production Supabase.
async page => {
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:430,height:932},reducedMotion:'reduce'});
 page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/parent-home-mint';
 const id='11111111-1111-4111-8111-111111111111',can='22222222-2222-4222-8222-222222222222';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
 const children=[{id,name:'Ece',avatar:'avatar-reference-girl',grade:2},{id:can,name:'Can',avatar:'avatar-reference-boy',grade:5}];
 const tasks=['Kitap okuma','Dişlerini fırçala','Odanı topla'].map((title,i)=>({id:'task-'+i,child_id:id,title,icon:['read-book','brush-teeth','tidy-room'][i],stars:2,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
 const completions=tasks.map((task,i)=>({id:'completion-'+i,child_id:id,template_id:task.id,due_date:today,status:i===2?'done':'approved',task_templates:{title:task.title,icon:task.icon,stars:2},children:{name:'Ece'}}));
 const events=[{id:'e1',title:'Kitap okuma',type:'activity',child_id:id,children:{name:'Ece'},starts_at:today+'T07:00:00Z',ends_at:today+'T07:30:00Z',all_day:false,rrule:null},{id:'e2',title:'Matematik tekrarı',type:'school',child_id:id,children:{name:'Ece'},starts_at:today+'T11:00:00Z',ends_at:today+'T12:00:00Z',all_day:false,rrule:null},{id:'e3',title:'Aile yürüyüşü',type:'family',child_id:null,children:null,starts_at:today+'T15:30:00Z',ends_at:today+'T16:15:00Z',all_day:false,rrule:null}];
 let mode='normal',failReview=false;const errors=[],rpcCalls=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({id})=>{const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture-only';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',is_anonymous:false}}));},{id});
 await page.route('**/auth/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id,aud:'authenticated',role:'authenticated'})}));
 await page.route('**/rest/v1/**',async route=>{
   const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
   if(mode==='loading')await new Promise(r=>setTimeout(r,1500));
   if(mode==='error'&&name==='children'){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture failure'})});return;}
   if(name==='review_task') {const body=req.postDataJSON();rpcCalls.push(body);if(failReview){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture review failure'})});return;} const item=completions.find(x=>x.id===body.p_completion_id);item.status=body.p_approve?'approved':'returned';await route.fulfill({status:200,contentType:'application/json',body:'null'});return;}
   let body=({children:mode==='empty'?[]:children,families:{timezone:'Europe/Istanbul'},family_members:{display_name:'Enes'},task_templates:tasks,task_completions:completions,star_events:[{child_id:id,delta:12},{child_id:can,delta:8}],events,event_exceptions:[],child_goals:u.searchParams.get('child_id')==='eq.'+can?null:{id:'goal1',family_rewards:{title:'Ailece sinema',icon:'reward-movie-night',cost_stars:20}}})[name]??[];
   if(name==='task_completions'&&u.searchParams.get('status')==='eq.done')body=completions.filter(x=>x.status==='done');
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.routeWebSocket('**/realtime/**',s=>s.close());
 const ready=async()=>{await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));};
 await page.goto('http://localhost:8081/parent');await ready();
 await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().click();
 await page.getByText('Ece için bugün',{exact:true}).waitFor();
 await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));
 await page.screenshot({path:dir+'/phone.png'});
 await page.getByTestId('home-tasks').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/phone-more.png'});
 await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().scrollIntoViewIfNeeded();
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:dir+'/tablet.png'});
 checks.push({name:'tablet',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 await page.getByRole('button',{name:'Can profilini göster',exact:true}).first().click();await page.getByText('Can için bugün',{exact:true}).waitFor();
 if(await page.getByTestId('home-approvals').getByText('Odanı topla').count())throw Error('Cross-child approval leak');
 checks.push({name:'child-filter',passed:true});
 await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().click();
 failReview=true;await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('alert').waitFor();checks.push({name:'review-error-visible',passed:true});
 failReview=false;await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('button',{name:'Onayla',exact:true}).waitFor({state:'detached'});checks.push({name:'approve-refresh',passed:completions[2].status==='approved'});
 completions[2].status='done';await page.reload();await ready();await page.getByRole('button',{name:'Geri gönder',exact:true}).click();await page.getByRole('button',{name:'Geri gönder',exact:true}).waitFor({state:'detached'});await page.getByTestId('home-tasks').getByText('Geri gönderildi',{exact:true}).waitFor();checks.push({name:'return-refresh',passed:true});
 await page.setViewportSize({width:430,height:932});mode='empty';await page.reload();await page.getByText('İlk adım: çocuğunu ekle',{exact:true}).waitFor();await page.screenshot({path:dir+'/empty-phone.png'});
 mode='loading';await page.reload();await page.getByText('Birazdan hazır…',{exact:true}).waitFor();await page.screenshot({path:dir+'/loading-phone.png'});await ready();
 mode='error';await page.reload();await page.getByRole('button',{name:'Yeniden dene',exact:true}).waitFor({timeout:30000});await page.screenshot({path:dir+'/error-phone.png'});mode='normal';await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await ready();checks.push({name:'error-retry',passed:true});
 completions[2].status='done';await page.reload();await ready();await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().click();
 await page.setViewportSize({width:320,height:844});await page.screenshot({path:dir+'/small-phone.png'});checks.push({name:'320px',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 const smallTargets=await page.locator('[role="button"],[role="link"]').evaluateAll(xs=>xs.map(x=>({label:x.getAttribute('aria-label')||x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})).filter(x=>x.w>0&&(x.w<47.5||x.h<47.5)));
 const missing=await page.locator('img').evaluateAll(xs=>xs.filter(x=>!x.naturalWidth).length);
 for (const [label,target] of [['Görev ekle','/parent/tasks'],['Prova hazırla','/parent/prova/exam'],['Ödül ekle','/parent/rewards'],['Takvimi aç','/parent/calendar'],['Bildirim ayarları','/parent/notifications'],['Çocuk alanına geç','/parent/child-mode']]) {
   await page.getByRole(label==='Takvimi aç'?'link':'button',{name:label,exact:true}).click();await page.waitForURL('**'+target);checks.push({name:'navigation '+target,passed:true});await page.goto('http://localhost:8081/parent');await ready();
 }
 await context.close();return {checks,errors,smallTargets,missingImages:missing,rpcCalls,backend:'all HTTP and realtime isolated; no database writes'};
}
