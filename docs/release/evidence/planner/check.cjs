async page=>{
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:390,height:844},reducedMotion:'reduce'});page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/planner';
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const profiles=[{id,name:'Ece',avatar:'avatar-reference-girl'},{id:other,name:'Can',avatar:'avatar-reference-boy'}];
 let plan={revision:1,settings:{start:'09:00',duration:40,break:10},lessons:[{id:'one',day:1,title:'Matematik',start:'09:00',end:'09:40'},{id:'two',day:1,title:'Türkçe',start:'09:50',end:'10:30'},{id:'three',day:1,title:'Hayat Bilgisi',start:'10:40',end:'11:20'}]};
 const eventRows=()=>[...plan.lessons.map(l=>({id:l.id,child_id:id,title:l.title,type:'school',starts_at:`2026-11-02T${l.start}:00+03:00`,ends_at:`2026-11-02T${l.end}:00+03:00`,rrule:'FREQ=WEEKLY;BYDAY='+['MO','TU','WE','TH','FR','SA','SU'][l.day-1],all_day:false,location:null,timetable_entry_key:l.id,children:{name:'Ece'}})),{id:'swim',child_id:id,title:'Yüzme',type:'activity',starts_at:'2026-11-02T16:00:00+03:00',ends_at:'2026-11-02T17:00:00+03:00',rrule:null,all_day:false,location:null,children:{name:'Ece'}}];
 let role='parent',fail=false,conflict=false;const calls=[],errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'));
 await page.addInitScript(({id})=>{const exp=1900000000;const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'fixture@gina.local'}}));},{id});
 await page.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let body=[],status=200;
 if(name==='families')body={timezone:'Europe/Istanbul',name:'Test'};
 if(name==='children')body=role==='parent'?profiles:[profiles[0]];
 if(name==='events')body=eventRows();if(name==='school_timetables')body=plan;
 if(name==='save_school_timetable'){const payload=req.postDataJSON();calls.push(payload);if(fail||conflict){status=409;body={message:conflict?'timetable_conflict':'fixture_network_error'};}else{plan={revision:plan.revision+1,lessons:payload.p_lessons,settings:payload.p_settings};body=plan.revision;}}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });await page.routeWebSocket('**/realtime/**',s=>s.close());
 await page.goto('http://localhost:8086/parent/calendar',{waitUntil:'networkidle'});await page.getByText('Matematik',{exact:true}).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete));
 await page.screenshot({path:dir+'/calendar-phone.png'});
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(250);await page.screenshot({path:dir+'/calendar-tablet.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.getByRole('button',{name:'Ders programı',exact:true}).click();await page.getByText('Ece’nin haftası',{exact:true}).waitFor();await page.screenshot({path:dir+'/program-phone.png'});
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(250);await page.screenshot({path:dir+'/program-tablet.png'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
 await page.getByRole('button',{name:'Ders ekle',exact:true}).click();await page.getByLabel('Ders adı',{exact:true}).fill('Fen Bilimleri');await page.getByLabel('Başlangıç (SS:DD)',{exact:true}).fill('09:10');await page.getByLabel('Bitiş (SS:DD)',{exact:true}).fill('09:30');await page.getByRole('button',{name:'Dersi programa ekle',exact:true}).click();await page.getByText('Aynı gün iki dersin saati çakışıyor.',{exact:false}).waitFor();checks.push('overlap blocked');
 await page.getByLabel('Başlangıç (SS:DD)',{exact:true}).fill('11:30');await page.getByLabel('Bitiş (SS:DD)',{exact:true}).fill('12:10');await page.getByRole('button',{name:'Dersi programa ekle',exact:true}).click();
 await page.getByRole('button',{name:'Günü kopyala',exact:true}).click();await page.getByRole('button',{name:'Salı',exact:true}).click();await page.getByRole('button',{name:'Seçili günlere kopyala',exact:true}).click();
 fail=true;await page.getByRole('button',{name:'Programı kaydet',exact:true}).click();await page.getByText('Değişiklikler kaydedilemedi.',{exact:false}).waitFor();checks.push('failed save preserves draft');fail=false;
 conflict=true;await page.getByRole('button',{name:'Programı kaydet',exact:true}).click();await page.getByText('Bu program başka bir cihazda değiştirildi.',{exact:false}).waitFor();checks.push('conflict preserves draft');conflict=false;
 await page.getByRole('button',{name:'Programı kaydet',exact:true}).click();await page.getByText('Kaydedildi',{exact:true}).waitFor();checks.push('save succeeds and copy persisted: '+(plan.lessons.filter(l=>l.day===2).length===4));
 await page.getByRole('button',{name:'Ders ekle',exact:true}).click();await page.getByLabel('Ders adı',{exact:true}).fill('İngilizce');await page.getByRole('button',{name:'Dersi programa ekle',exact:true}).click();await page.getByRole('button',{name:'Geri',exact:true}).click();await page.getByText('Kaydedilmemiş değişiklikler',{exact:true}).waitFor();checks.push('unsaved exit guarded');await page.getByRole('button',{name:'Taslağı bırak',exact:true}).click();await page.getByText('Aile takvimi',{exact:true}).waitFor();checks.push('return to calendar');
 await page.getByRole('button',{name:'Etkinlik ekle',exact:true}).click();await page.screenshot({path:dir+'/event-editor-phone.png'});await page.getByRole('button',{name:'Vazgeç',exact:true}).click();
 await page.setViewportSize({width:320,height:844});await page.waitForTimeout(250);await page.screenshot({path:dir+'/calendar-small-phone.png'});checks.push('320 overflow: '+await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 const missing=await page.locator('img').evaluateAll(xs=>xs.filter(x=>!x.naturalWidth).length);
 await context.close();return {checks,errors,missing,rpcCalls:calls.map(c=>({child:c.p_child_id,revision:c.p_revision,lessons:c.p_lessons.length})),allBackendTrafficMocked:true};
}
