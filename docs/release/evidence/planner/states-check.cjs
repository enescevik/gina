async page=>{
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:390,height:844},reducedMotion:'reduce'});page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/planner';
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const profiles=[{id,name:'Ece',avatar:'avatar-reference-girl'},{id:other,name:'Can',avatar:'avatar-reference-boy'}];
 let plan={revision:1,settings:{start:'09:00',duration:40,break:10},lessons:[{id:'one',day:1,title:'Matematik',start:'09:00',end:'09:40'},{id:'two',day:1,title:'Türkçe',start:'09:50',end:'10:30'},{id:'three',day:1,title:'Hayat Bilgisi',start:'10:40',end:'11:20'}]};
 const eventRows=()=>[...plan.lessons.map(l=>({id:l.id,child_id:id,title:l.title,type:'school',starts_at:`2026-11-02T${l.start}:00+03:00`,ends_at:`2026-11-02T${l.end}:00+03:00`,rrule:'FREQ=WEEKLY;BYDAY='+['MO','TU','WE','TH','FR','SA','SU'][l.day-1],all_day:false,location:null,timetable_entry_key:l.id,children:{name:'Ece'}})),{id:'swim',child_id:id,title:'Yüzme',type:'activity',starts_at:'2026-11-02T16:00:00+03:00',ends_at:'2026-11-02T17:00:00+03:00',rrule:null,all_day:false,location:null,children:{name:'Ece'}}];
 let scenario='ready';let role='parent',fail=false,conflict=false;const calls=[],errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'));
 await page.addInitScript(({id})=>{const exp=1900000000;const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'fixture@gina.local'}}));},{id});
 await page.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let body=[],status=200;
 if(name==='families')body={timezone:'Europe/Istanbul',name:'Test'};
 if(name==='children')body=role==='parent'?profiles:[profiles[0]];
 if(name==='events')body=eventRows();if(name==='school_timetables')body=plan;
 if(name==='save_school_timetable'){const payload=req.postDataJSON();calls.push(payload);if(fail||conflict){status=409;body={message:conflict?'timetable_conflict':'fixture_network_error'};}else{plan={revision:plan.revision+1,lessons:payload.p_lessons,settings:payload.p_settings};body=plan.revision;}}
 if(scenario==='error'&&name==='events'){status=503;body={message:'fixture_offline'};}if(scenario==='no-child'&&name==='children')body=[];if(scenario==='no-child'&&name==='events')body=[];
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });await page.routeWebSocket('**/realtime/**',s=>s.close());

 await page.goto('http://localhost:8086/parent/calendar',{waitUntil:'networkidle'});await page.getByText('Matematik',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'3 Kasım Salı',exact:true}).click();await page.getByText('Bugün için alan var',{exact:true}).waitFor();await page.screenshot({path:dir+'/empty-phone.png'});checks.push('empty day shown');
 scenario='error';await page.reload({waitUntil:'networkidle'});await page.getByText('Plan yüklenemedi.',{exact:false}).waitFor({timeout:20000});await page.screenshot({path:dir+'/error-phone.png'});checks.push('error and retry shown');
 scenario='ready';await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.getByText('Matematik',{exact:true}).first().waitFor();checks.push('retry recovers');
 scenario='no-child';await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Çocuk ekle',exact:true}).waitFor();await page.screenshot({path:dir+'/no-child-phone.png'});checks.push('prominent child creation action');
 const small=await page.locator('[role="button"],[role="link"]').evaluateAll(xs=>xs.map(x=>({label:x.getAttribute('aria-label')||x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})).filter(x=>x.w>0&&(x.w<47.5||x.h<47.5)));
 await context.close();return {checks,smallTargets:small,errors,allBackendTrafficMocked:true};
}
