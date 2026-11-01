async page=>{
 const assert={equal(a,b){if(a!==b)throw Error('Expected '+JSON.stringify(b)+'; got '+JSON.stringify(a));},deepEqual(a,b){this.equal(JSON.stringify(a),JSON.stringify(b));}};const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:390,height:844},reducedMotion:'reduce'});page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/tasks-premium';const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';const profiles=[{id,name:'Ece',avatar:'avatar-reference-girl',grade:2},{id:other,name:'Can',avatar:'avatar-reference-boy',grade:5}];
 let rows=[{id:'one',child_id:id,title:'Dişlerini fırçala',icon:'brush-teeth',stars:2,days_of_week:[1,2,3,4,5,6,7],active:true},{id:'two',child_id:id,title:'20 dakika kitap oku',icon:'read-book',stars:3,days_of_week:[1,2,3,4,5],active:true},{id:'three',child_id:id,title:'Odanı düzenle',icon:'tidy-room',stars:2,days_of_week:[6,7],active:true},{id:'four',child_id:id,title:'Bitkileri sula',icon:'water-plants',stars:1,days_of_week:[6],active:false}];
 let failSave=false,failToggle=false,failLoad=false,noChildren=false;const writes=[],errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'));
 await page.addInitScript(({id})=>{const exp=1900000000;const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'fixture@gina.local'}}));},{id});
 await page.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let body=[],status=200;
 if(name==='families')body={timezone:'Europe/Istanbul',name:'Test'};if(name==='children')body=noChildren?[]:profiles;
 if(name==='task_templates'){
  if(req.method()==='POST'){const values=req.postDataJSON();writes.push(values);if(failSave){status=503;body={message:'fixture_offline'};}else rows.push({...values,id:'new-task',active:true});}
  else if(req.method()==='PATCH'){if(failToggle){status=503;body={message:'fixture_offline'};}else{const row=rows.find(r=>r.id===url.searchParams.get('id')?.slice(3));Object.assign(row,req.postDataJSON());body={id:row.id};}}
  else if(failLoad){status=503;body={message:'fixture_offline'};}else body=rows.filter(r=>r.child_id===url.searchParams.get('child_id')?.slice(3));
 }
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });await page.routeWebSocket('**/realtime/**',s=>s.close());

 failLoad=true;await page.goto('http://localhost:8086/parent/tasks');await page.getByText('Görevler yüklenemedi.',{exact:false}).waitFor();await page.screenshot({path:dir+'/load-error-phone.png'});failLoad=false;await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.getByText('Odanı düzenle',{exact:true}).waitFor();checks.push('load failure and retry');
 await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('button',{name:'Yeni görev',exact:true}).click();await page.getByLabel('Görev adı',{exact:true}).fill('Uzun bir görev adı');await page.getByRole('button',{name:'Pazar',exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:dir+'/form-small-phone.png'});checks.push('320px filled list and form no overflow');
 await page.getByRole('button',{name:'Vazgeç',exact:true}).first().click();await page.getByRole('button',{name:'Taslağı bırak',exact:true}).click();
 noChildren=true;await page.reload();await page.getByText('İlk adım: çocuğunu ekle',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Yeni görev',exact:true}).count(),0);await page.screenshot({path:dir+'/no-children-phone.png'});checks.push('no children guidance, no invalid create action');
 assert.deepEqual(errors,[]);await context.close();return {checks,errors,allBackendTrafficMocked:true};
}