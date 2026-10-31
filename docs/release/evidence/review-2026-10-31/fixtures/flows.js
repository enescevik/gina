// Regression tests use intercepted fixtures only; no demo database writes.
async page => {
 const browser=page.context().browser(),dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/review-2026-10-31/fixtures';
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';const result={},errors=[];
 const session=(id=a,role='parent')=>{const exp=Math.floor(Date.now()/1000)+86400;return {access_token:btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:role==='device'?id:null,device_id:role==='device'?id:null,role,admin:false}}))+'.fixture',refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'fixture@test.local',is_anonymous:role==='device'}};};
 async function setup(role,handle){const c=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'});const p=await c.newPage();await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session(a,role));await p.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),u=new URL(req.url());const res=await handle(u.pathname.split('/').pop(),req,u);await route.fulfill({status:res?.status??200,contentType:'application/json',body:JSON.stringify(res?.body??[])});});await p.routeWebSocket('**/realtime/**',s=>s.close());p.on('pageerror',e=>errors.push(e.message));return {c,p};}
 let children=[{id:a,name:'Ece',grade:2,avatar:'avatar-reference-girl'},{id:b,name:'Can',grade:5,avatar:'avatar-reference-boy'}],deletes=0;
 let {c,p}=await setup('parent',async(name,req)=>{
  if(name==='families')return {body:{name:'Aile',invite_code:'AB12CD34'}};
  if(name==='children'){if(req.method()==='DELETE'){deletes++;children=children.filter(x=>x.id!==a);return {body:[{id:a}]};}return {body:children};}return {body:[]};
 });
 await p.goto('http://localhost:8081/parent/menu');await p.getByRole('button',{name:'Ece profilini sil',exact:true}).click();await p.getByText('Ece profilini ve bu çocuğa ait',{exact:false}).waitFor();result.deleteRequiresSecondConfirmation=deletes===0;
 await p.getByRole('button',{name:'Vazgeç',exact:true}).click();result.cancelDoesNotDelete=deletes===0;
 await p.getByRole('button',{name:'Ece profilini sil',exact:true}).click();await p.getByRole('button',{name:'Ece profilini sil',exact:true}).click();await p.getByRole('button',{name:'Ece profilini sil',exact:true}).waitFor({state:'hidden'});result.onlySelectedChildRemoved=deletes===1&&await p.getByRole('button',{name:'Can profilini sil',exact:true}).isVisible();await c.close();
 ({c,p}=await setup('device',async(name)=>({body:name==='families'?{timezone:'Europe/Istanbul'}:name==='children'?{id:a,name:'Ece',avatar:'avatar-reference-girl'}:[]})));
 await p.goto('http://localhost:8081/child/pin?childId='+a+'&name=Ece');const pin=p.getByLabel('Çocuk PIN’i',{exact:true});await pin.fill('ab12');result.pinFiltersLetters=await pin.inputValue()==='12';result.shortPinBlocked=await p.getByRole('button',{name:'Tamam',exact:true}).isDisabled();await p.screenshot({path:dir+'/pin-dark-reduced-phone.png'});await c.close();
 let score=null,feedback=null;
 const q={id:'q1',kind:'open_ended',stem:'Isı ve sıcaklık arasındaki farkı açıkla.',subject:'Fen Bilimleri',grade:5,topic:'Isı',expected_answer:'Isı enerji aktarımıdır.',solution:null};
 ({c,p}=await setup('parent',async(name)=>{
  if(name==='exam_attempts')return {body:{id:'attempt',status:'submitted',score_pct:score,mc_total:0,mc_correct:0,open_total:1,open_graded:score===null?0:1,children:{name:'Can'},exams:{id:'exam',title:'Fen provası',subject:'Fen Bilimleri',grade:5,question_ids:['q1']}}};
  if(name==='question_bank')return {body:[q]};if(name==='exam_answers')return {body:[{question_id:'q1',answer_key:null,answer_text:'Isı enerjinin aktarımıdır.',score,feedback,graded_by:score===null?null:'ai',ai_score:score}]};
  if(name==='get_prova_entitlement')return {body:{ai_grading:true,study_plan:true}};
  if(name==='prova-grade'){score=80;feedback='İyi bir başlangıç.';return {body:{ok:true,graded:1}};}return {body:[]};
 }));
 await p.goto('http://localhost:8081/parent/prova/attempt/attempt');const field=p.getByLabel('Puan (0-100)',{exact:true});await field.waitFor();result.initialScoreEmpty=await field.inputValue()==='';await p.getByRole('button',{name:'AI ile puanla',exact:true}).click();await p.waitForFunction(()=>document.querySelector('input[aria-label="Puan (0-100)"]')?.value==='80');result.aiResultUpdatesEditor=await field.inputValue()==='80'&&await p.getByLabel('Kısa geri bildirim (isteğe bağlı)',{exact:true}).inputValue()==='İyi bir başlangıç.';await field.scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/ai-score-refreshed-phone.png'});await c.close();

 let activeId=a;
 ({c,p}=await setup('parent',async(name,req,u)=>{
  if(name==='token'&&u.searchParams.get('grant_type')==='password'){activeId=b;return {body:session(b)};}
  if(name==='logout')return {body:{}};
  if(name==='families')return {body:{name:'Test ailesi',timezone:'Europe/Istanbul',invite_code:'AB12CD34'}};
  if(name==='family_members')return {body:{display_name:'Veli'}};
  if(name==='children')return {body:[{id:activeId,name:activeId===a?'Ece':'Can',grade:2,avatar:'avatar-reference-girl'}]};
  return {body:[]};
 }));
 await p.goto('http://localhost:8081/parent/menu');await p.getByRole('button',{name:'Ece profilini sil',exact:true}).waitFor();
 await p.getByRole('button',{name:'Çıkış yap',exact:true}).click();await p.getByRole('textbox',{name:'E-posta',exact:true}).fill('second@fixture.test');await p.getByLabel('Şifre',{exact:true}).fill('fixture-password');await p.getByRole('button',{name:'Giriş yap',exact:true}).click();
 await p.getByRole('button',{name:'Can',exact:true}).waitFor();result.accountSwitchClearsOldChild=!(await p.getByText('Ece',{exact:true}).count());await c.close();
 let exits=0;
 ({c,p}=await setup('device',async(name)=>{
  if(name==='children')return {body:{id:a,name:'Ece',avatar:'avatar-reference-girl'}};
  if(name==='families')return {body:{timezone:'Europe/Istanbul'}};
  if(name==='child_goals'||name==='child_room_preferences')return {body:null};
  if(name==='child_logout'){exits++;return {status:500,body:{message:'fixture_logout_failed'}};}
  return {body:[]};
 }));
 await p.goto('http://localhost:8081/child/today');await p.getByRole('button',{name:'Profil değiştir',exact:true}).click();await p.getByRole('alert').waitFor();result.failedProfileExitVisible=exits===1&&p.url().includes('/child/today');result.phoneCollectionReachable=await p.getByRole('button',{name:'Koleksiyonum',exact:true}).count()===1;await c.close();
 return {result,errors,allBackendTrafficMocked:true};
}
