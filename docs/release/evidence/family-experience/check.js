// Isolated fixtures. No real database or provider call is made.
async page=>{
 const browser=page.context().browser();const root='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/family-experience';
 const id='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';const rows=[],errors=[],flows=[];
 const kids=[{id,name:'Ece',avatar:'avatar-reference-girl',grade:2,allowed:true,pin_set:true,needs_pin:false},{id:second,name:'Can',avatar:'avatar-reference-boy',grade:5,allowed:true,pin_set:true,needs_pin:true}];
 const fixture={children:kids,families:{id,name:'Çevik Ailesi',invite_code:'AB12CD34'},devices:[{id,name:'Çocukların tableti',paired_at:'2026-11-01',active_child_id:null,revoked_at:null}],get_child_device_access:{id,name:'Çocukların tableti',access_mode:'selected',pin_policy:'none',children:kids},list_my_families:[{id,name:'Çevik Ailesi',children:2,active:true}],preview_family_invite:{id:second,name:'Deniz’in ailesi',children:1,already_member:false},get_prova_entitlement:{plan:'pro',scenarios:true,ai_generate_limit:100,ai_generate_used:5},exam_blueprints:[],settings:{external:{apple:true,google:true}},get_family_entitlement:[{plan:'pro',source:'override'}],parent_pin_set:true};
 const scenarios=[['login','/sign-in','none','Ebeveyn girişi'],['device','/parent/device-access?deviceId='+id,'parent','Bu cihazı kim kullanacak?'],['families','/parent/families','parent','Aile seçimi ve eş daveti'],['ai','/parent/prova/generate','parent','Birlikte Prova hazırlayalım'],['pair','/device/pair','anonymous','Eşleştirme kodu oluştur'],['profiles','/child','device','Ece'],['pin','/child/pin?childId='+second+'&name=Can','device','Can']];
 for(const [size,width,height] of [['phone',390,844],['tablet',1280,800]])for(const [slug,path,role,expected] of scenarios){
  const c=await browser.newContext({locale:'tr-TR',viewport:{width,height},reducedMotion:'reduce'});const p=await c.newPage();const calls=[];
  p.on('pageerror',e=>errors.push({slug,size,message:e.message}));
  let activeChild=null;
  function session(){const exp=Math.floor(Date.now()/1000)+86400;return {access_token:Buffer.from('{"alg":"HS256"}').toString('base64')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp,gina:{admin:false,role:role==='parent'?'parent':role==='device'?'device':'none',family_id:role==='parent'||role==='device'?id:null,device_id:role==='device'?id:null,child_id:activeChild}})).toString('base64')+'.fixture',refresh_token:'fixture',expires_in:86400,expires_at:exp,token_type:'bearer',user:{id,email:'parent@fixture.test',is_anonymous:role==='anonymous'||role==='device'}};}
  if(role!=='none')await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session());
  await p.route('http://127.0.0.1:54321/**',async r=>{
   const req=r.request(),name=new URL(req.url()).pathname.split('/').pop();let body=fixture[name]??null;
   if(req.method()==='POST'){calls.push({name,body:req.postDataJSON()});if(name==='child_pin_login')activeChild=req.postDataJSON().p_child_id;}
   if(name==='devices'&&req.headers()['accept']?.includes('vnd.pgrst.object'))body=fixture.devices[0];
   if(name==='token')body=session();
   if(name==='request_pairing')body='482916';
   if(name==='child_pin_login')body=slug==='pin'?false:true;
   if(name==='join_family')body=second;
   if(name==='prova-generate')body={ok:true,remaining:90,model:'fixture',questions:[{id,topic:'Toplama',kind:'open_ended',difficulty:'orta',stem:'3 + 4 kaç eder?',expected_answer:'7',solution:'Üçün üzerine dört ekleriz.',choices:null,source_urls:[],explanation:'Toplama, miktarları birleştirir.'}]};
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await p.routeWebSocket('**/realtime/**',s=>s.close());
  await p.goto('http://localhost:8093'+path,{waitUntil:'networkidle'});await p.getByText(expected,{exact:false}).first().waitFor({timeout:12000}).catch(async()=>{await p.reload({waitUntil:'networkidle'});await p.getByText(expected,{exact:false}).first().waitFor();});
  await p.waitForFunction(()=>Array.from(document.images).every(x=>x.complete));
  await p.screenshot({path:root+'/'+slug+'-'+size+'.png'});
  if(slug==='device'){
   await p.getByRole('radio',{name:'Kişisel cihaz',exact:true}).click();await p.getByRole('button',{name:'Kaydet',exact:true}).click();await p.getByText('Tercihler kaydedildi.',{exact:false}).waitFor();
   const call=calls.find(x=>x.name==='configure_child_device');if(call?.body.p_child_ids.length!==1||call.body.p_pin_required!==false)throw new Error('Device choice not persisted');flows.push(size+': personal device, explicit PIN-free persisted');
  }
  if(slug==='families'){
   await p.getByRole('textbox').fill('AB12CD34');await p.getByRole('button',{name:'Önce aileyi göster'}).click();await p.getByText('Deniz’in ailesi',{exact:true}).waitFor();
   if(calls.some(x=>x.name==='join_family'))throw new Error('Family joined without confirmation');
   await p.getByRole('button',{name:'Bu aileyle devam et'}).scrollIntoViewIfNeeded();await p.screenshot({path:root+'/family-choice-'+size+'.png'});flows.push(size+': family preview does not join before confirmation');
  }
  if(slug==='ai'){
   await p.getByRole('button',{name:'Ece',exact:true}).click();await p.getByRole('button',{name:'Devam et',exact:true}).click();
   const boxes=p.getByRole('textbox');await boxes.nth(0).fill('Matematik');await boxes.nth(2).fill('Toplama');
   await p.getByRole('button',{name:'Devam et',exact:true}).click();await p.getByRole('button',{name:'Soruları üret',exact:false}).click();
   await p.getByText('3 + 4 kaç eder?',{exact:true}).waitFor();const assign=p.getByRole('button',{name:'Prova’yı çocuğuma gönder'});if(await assign.isEnabled())throw new Error('Review gate missing');
   await p.getByRole('switch',{name:'Seçtiğim soruları ve cevaplarını kontrol ettim.'}).click();await assign.scrollIntoViewIfNeeded();await p.screenshot({path:root+'/ai-review-'+size+'.png'});await assign.click();await p.getByText('Prova hazır!',{exact:true}).first().waitFor();
   if(!calls.some(x=>x.name==='exams'))throw new Error('AI exam not assigned');flows.push(size+': guided generation, review gate, complete exam assigned');
  }
  if(slug==='pin'){await p.getByLabel('Çocuk PIN’i',{exact:true}).fill('0000');await p.getByRole('button',{name:'Dünyama gir',exact:true}).click();await p.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(x=>x.type==='password'&&x.value===''));if(!calls.some(x=>x.name==='child_pin_login'))throw new Error('PIN did not submit');flows.push(size+': wrong PIN clears secret input');}
  if(slug==='pair'){await p.getByRole('button',{name:'Eşleştirme kodu oluştur',exact:true}).click();await p.getByText('482916',{exact:true}).waitFor();await p.screenshot({path:root+'/pair-waiting-'+size+'.png'});flows.push(size+': animated pairing state');}
  const narrow=await p.locator('[role=radio]').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().width<120).map(x=>x.textContent));
  rows.push({slug,size,narrowOptions:narrow,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),broken:await p.locator('img').evaluateAll(xs=>xs.filter(x=>!x.naturalWidth).length)});
  await c.close();
 }
 return {rows,errors,flows,backend:'fully mocked'};
}
