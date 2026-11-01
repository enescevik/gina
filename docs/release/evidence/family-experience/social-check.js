async page => {
 const browser=page.context().browser();const c=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await c.newPage();const calls=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
 const id='11111111-1111-4111-8111-111111111111';let verified=false;
 function session(){const exp=Math.floor(Date.now()/1000)+86400;return {access_token:Buffer.from('{"alg":"HS256"}').toString('base64')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp,amr:verified?[{method:'otp',timestamp:exp-86400}]:[{method:'oauth',timestamp:exp-86400}],gina:{admin:false,role:'parent',family_id:id,device_id:null,child_id:null}})).toString('base64')+'.fixture',refresh_token:'fixture',expires_in:86400,expires_at:exp,token_type:'bearer',user:{id,email:'parent@fixture.test',is_anonymous:false,identities:[{provider:'google',id},...(verified?[{provider:'email',id}]:[])]}};}
 await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session());
 await p.route('http://127.0.0.1:54321/**',async r=>{
  const req=r.request(),name=new URL(req.url()).pathname.split('/').pop();let body=[];
  if(req.method()==='POST')calls.push({name,body:req.postDataJSON()});
  if(name==='families')body={id,name:'Çevik Ailesi',invite_code:'AB12CD34'};
  if(name==='parent_pin_set')body=true;
  if(name==='get_family_entitlement')body=[{plan:'pro'}];
  if(name==='settings')body={external:{google:true}};
  if(name==='otp')body={};
  if(name==='verify'){verified=true;body=session();}
  if(name==='token')body=session();
  if(name==='delete-account')body={ok:true};
  if(name==='logout')body={};
  await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await p.routeWebSocket('**/realtime/**',s=>s.close());
 await p.goto('http://localhost:8093/parent/menu?section=account',{waitUntil:'networkidle'});
 await p.getByRole('button',{name:'Hesabımı sil',exact:true}).click();
 const remove=p.getByRole('button',{name:'Hesabımı kalıcı olarak sil',exact:true});if(await remove.isEnabled())throw Error('Delete enabled without reauth');
 await p.getByRole('button',{name:'E-postama doğrulama kodu gönder',exact:true}).click();
 await p.getByRole('textbox',{name:'E-posta doğrulama kodu',exact:true}).fill('123456');
 await p.getByRole('button',{name:'Kimliğimi doğrula',exact:true}).click();
 await p.getByText('Kimliğiniz doğrulandı. İşleminize devam edebilirsiniz.',{exact:true}).waitFor();
 if(await remove.isEnabled())throw Error('Delete enabled without explicit acknowledgement');
 await p.getByRole('switch',{name:'Bu işlemin geri alınamayacağını anladım.',exact:true}).click();
 await remove.scrollIntoViewIfNeeded();await p.screenshot({path:'/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/family-experience/social-verification-phone.png'});
 await remove.click();await p.getByText('Ebeveyn girişi',{exact:false}).first().waitFor();
 const del=calls.find(x=>x.name==='delete-account');if(del?.body.reauthentication!=='email_otp'||!del.body.confirm)throw Error('wrong reauth method');
 const otp=calls.find(x=>x.name==='otp');if(otp?.body.email!=='parent@fixture.test'||otp.body.create_user!==false)throw Error('unbound email');
 await c.close();return {errors,passed:['delete disabled before reauthentication','OTP uses current account only','method remains stable after identity update','explicit deletion acknowledgement required','mock deletion signs out'],backend:'fully mocked; no email sent or real account removed'};
}
