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
   if((mode==='error'&&name==='children')||(mode==='goal-error'&&name==='child_goals')){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture failure'})});return;}
   if(name==='review_task') {const body=req.postDataJSON();rpcCalls.push(body);if(failReview){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'fixture review failure'})});return;} const item=completions.find(x=>x.id===body.p_completion_id);item.status=body.p_approve?'approved':'returned';await route.fulfill({status:200,contentType:'application/json',body:'null'});return;}
   let body=({children:mode==='empty'?[]:children,families:{timezone:'Europe/Istanbul'},family_members:{display_name:mode==='long'?'Deniz İrem Uzunisimli':'Deniz'},task_templates:tasks,task_completions:completions,star_events:[{child_id:id,delta:18},{child_id:can,delta:12}],events,event_exceptions:[],child_goals:u.searchParams.get('child_id')==='eq.'+can?{id:'goal2',family_rewards:{title:'Yeni kitap',icon:'reward-book',cost_stars:20}}:{id:'goal1',family_rewards:{title:'Ailece sinema',icon:'reward-movie-night',cost_stars:30}}})[name]??[];
   if(name==='task_completions'&&u.searchParams.get('status')==='eq.done')body=completions.filter(x=>x.status==='done');
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.routeWebSocket('**/realtime/**',s=>s.close());
 const ready=async()=>{await page.getByRole('button',{name:'Ece profilini göster',exact:true}).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));};
 completions.push(...[0,1].map(n=>({...completions[2],id:'extra-'+n,template_id:'extra-template-'+n})));
 await page.goto('http://localhost:8087/parent');await ready();
 if(await page.getByRole('button',{name:'Onayla',exact:true}).count()!==2)throw Error('Initial approval count');
 await page.getByRole('button',{name:'Tüm onayları göster (3)',exact:true}).click();
 if(await page.getByRole('button',{name:'Onayla',exact:true}).count()!==3)throw Error('Expanded approvals missing');
 await page.getByRole('button',{name:'Daha az göster',exact:true}).click();
 if(await page.getByRole('button',{name:'Onayla',exact:true}).count()!==2)throw Error('Collapse failed');
 checks.push({name:'approval expansion preserves access to every item',passed:true});
 await page.getByRole('button',{name:'Haftaya bakış',exact:true}).click();
 await page.getByRole('button',{name:'3 Kasım Salı',exact:true}).click();await page.getByTestId('home-plan').getByText('3 Kasım Salı',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Haftayı gizle',exact:true}).click();await page.getByTestId('home-plan').getByText('Günün planı',{exact:true}).waitFor();checks.push({name:'week selection and return to today',passed:true});
 mode='goal-error';await page.reload();await ready();await page.getByText('Hedef bilgisi yüklenemedi.',{exact:true}).first().waitFor({timeout:20000});mode='normal';await page.getByRole('button',{name:'Yeniden dene',exact:true}).first().click();await page.getByText('Ece · Ailece sinema',{exact:true}).waitFor();checks.push({name:'goal error and retry',passed:true});
 mode='long';children[0].name='Ece Naz Uzunisimli';children[1].name='Can Deniz Uzunisimli';events[0].title='Matematik — kesirler, problem çözme ve haftalık tekrar çalışması';
 await page.setViewportSize({width:320,height:844});await page.reload();await page.getByText('Merhaba, Deniz İrem Uzunisimli',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:dir+'/long-content-phone.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Long text overflow');checks.push({name:'long names and task/event titles at 320px',passed:true});
 mode='normal';completions.length=0;tasks.length=0;events.length=0;await page.reload();await page.getByTestId('home-plan').getByText('Seçili gün için plan yok.',{exact:true}).waitFor();await page.getByText('Onay bekleyen görev yok.',{exact:true}).waitFor();await page.getByTestId('home-tasks').getByText('Bugün için görev yok. İlk adımı birlikte planlayın.',{exact:true}).waitFor();checks.push({name:'empty day, no approvals and no tasks',passed:true});
 if(errors.length)throw Error(JSON.stringify(errors));await context.close();return {checks,errors,allBackendTrafficMocked:true};
}
