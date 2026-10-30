// Fully intercepted fixtures. No network request reaches the development database.
async page => {
 const browser=page.context().browser(),dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/account/implementation-v5';
 const id='11111111-1111-4111-8111-111111111111';const result={},errors=[];
 const token=(role='parent')=>{const exp=Math.floor(Date.now()/1000)+86400;return {access_token:btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:role==='parent'?id:null,child_id:null,device_id:null,role,admin:false}}))+'.fixture',refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'parent@fixture.test',is_anonymous:role==='none'}};};
 async function setup(role,handle,extra={}){
  const c=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:844}});const p=await c.newPage();
  await p.addInitScript(({session,extra})=>{if(session)localStorage.setItem('sb-127-auth-token',JSON.stringify(session));for(const [k,v] of Object.entries(extra))localStorage.setItem(k,JSON.stringify(v));},{session:role?token(role):null,extra});
  await p.route('http://127.0.0.1:54321/**',async route=>{const req=route.request();const u=new URL(req.url());const response=await handle(u.pathname.split('/').pop(),req,u);await route.fulfill({status:response?.status??200,contentType:'application/json',body:JSON.stringify(response?.body??null)});});
  await p.routeWebSocket('**/realtime/**',s=>s.close());p.on('pageerror',e=>errors.push(e.message));return {c,p};
 }
 let signupCount=0,resetCount=0;
 let {c,p}=await setup(null,async(name)=>{
  if(name==='signup'){signupCount++;await new Promise(r=>setTimeout(r,250));return {body:{user:{id,email:'parent@fixture.test'}}};}
  if(name==='recover'){resetCount++;return {body:{}};}return {body:null};
 });
 await p.goto('http://localhost:8082/sign-in');await p.getByRole('button',{name:'Kayıt ol',exact:true}).click();
 await p.getByRole('textbox',{name:'E-posta',exact:true}).fill('invalid');await p.getByLabel('Şifre',{exact:true}).fill('long-password');
 result.invalidEmailBlocked=await p.getByRole('button',{name:'Kayıt ol',exact:true}).isDisabled();
 await p.getByRole('textbox',{name:'E-posta',exact:true}).fill('parent@fixture.test');result.adultRequired=await p.getByRole('button',{name:'Kayıt ol',exact:true}).isDisabled();
 await p.getByRole('switch').click();await p.getByRole('button',{name:'Kayıt ol',exact:true}).click();
 result.otherAuthActionDisabled=await p.getByRole('button',{name:'Giriş yap',exact:true}).isDisabled();
 await p.getByText('E-postanı kontrol et.',{exact:false}).waitFor();result.confirmationStaysOnSignIn=signupCount===1&&p.url().includes('sign-in');await p.screenshot({path:dir+'/sign-up-confirmation-phone.png'});
 await p.getByRole('button',{name:'Giriş yap',exact:true}).click();await p.getByRole('button',{name:'Şifremi unuttum',exact:true}).click();await p.getByRole('button',{name:'Yenileme bağlantısı gönder',exact:true}).click();await p.getByText('Bu adresle bir hesap varsa',{exact:false}).waitFor();result.resetRequested=resetCount===1;await c.close();
 let updates=0;({c,p}=await setup(null,async(name,req)=>{
  if(name==='token')return {body:token()};if(name==='user'){if(req.method()==='PUT')updates++;return {body:token().user};}return {body:[]};
 },{'sb-127-auth-token-code-verifier':'fixture/recovery'}));
 await p.goto('http://localhost:8082/reset-password?code=fixture-code');await p.getByLabel('Yeni şifreyi tekrar yaz',{exact:true}).waitFor();
 await p.getByLabel('Şifre',{exact:true}).fill('new-password');await p.getByLabel('Yeni şifreyi tekrar yaz',{exact:true}).fill('mismatch');result.passwordMismatchBlocked=await p.getByRole('button',{name:'Kaydet',exact:true}).isDisabled();
 await p.getByLabel('Yeni şifreyi tekrar yaz',{exact:true}).fill('new-password');await p.getByRole('button',{name:'Kaydet',exact:true}).click();await p.getByText('Şifren yenilendi.',{exact:false}).waitFor();result.recoverySaves=updates===1;await p.screenshot({path:dir+'/password-updated-phone.png'});await c.close();
 let prefWrites=0,failPrefs=true;const prefs={approvals:true,exams:true,weekly_summary:true};
 ({c,p}=await setup('parent',async(name,req)=>{if(name==='push_preferences'){if(req.method()==='POST'){prefWrites++;await new Promise(r=>setTimeout(r,250));if(failPrefs)return {status:500,body:{message:'fixture-failure'}};Object.assign(prefs,req.postDataJSON());}return {body:prefs};}return {body:[]};}));
 await p.goto('http://localhost:8082/parent/notifications');const first=p.getByRole('switch').first();await first.waitFor();await first.click();result.allTogglesDisabledWhileSaving=await p.getByRole('switch').nth(1).isDisabled();
 await p.getByRole('alert').waitFor();result.failedToggleNotPretendSaved=await first.isChecked();await p.screenshot({path:dir+'/notifications-save-error-phone.png'});failPrefs=false;await first.click();await p.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='false');result.toggleRetry= !await first.isChecked()&&prefWrites===2;await c.close();
 let deleteCount=0;({c,p}=await setup('parent',async(name,req)=>{
  if(name==='families')return {body:{name:'Aile',invite_code:'AB12CD34'}};if(name==='children'||name==='devices')return {body:[]};
  if(name==='delete-account'){deleteCount++;await new Promise(r=>setTimeout(r,250));return {status:403,body:{error:'reauthentication_failed'}};}return {body:null};
 }));
 await p.goto('http://localhost:8082/parent/menu');await p.getByRole('button',{name:'Hesabımı sil',exact:true}).click();
 result.deleteInitiallyBlocked=await p.getByRole('button',{name:'Hesabımı kalıcı olarak sil',exact:true}).isDisabled();await p.getByLabel('Şifre',{exact:true}).fill('wrong-password');await p.getByRole('switch').click();await p.getByRole('button',{name:'Hesabımı kalıcı olarak sil',exact:true}).click();
 await p.getByText('Hesap silinemedi.',{exact:false}).waitFor();result.deleteFailureKeepsSession=deleteCount===1&&p.url().includes('/parent/menu');await p.screenshot({path:dir+'/delete-error-phone.png'});await c.close();
 let shareCount=0;({c,p}=await setup('parent',async(name)=>{if(name==='children')return {body:[{id,name:'Ece',avatar:'avatar-reference-girl'}]};if(name==='create_child_share'){shareCount++;return {body:[{token:'fixture-share-token'}]};}return {body:[]};}));
 await p.goto('http://localhost:8082/parent/share');await p.getByLabel('Kiminle paylaşıyorsun?',{exact:true}).fill('Öğretmeni');await p.getByRole('button',{name:'Bağlantı oluştur',exact:true}).click();await p.getByText('http://localhost:8082/s/fixture-share-token',{exact:true}).waitFor();result.shareUsesAbsoluteUrl=shareCount===1;await p.screenshot({path:dir+'/share-created-phone.png'});await c.close();
 return {result,errors,allBackendTrafficMocked:true};
}
