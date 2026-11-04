// Synthetic UI acceptance only; all service requests are intercepted.
const fs=require('node:fs'),path=require('node:path');
module.exports=async(page,{admin=false}={})=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=id(admin?9:1),family=id(2),qid=id(3),cid=id(4);
 const png=fs.readFileSync(path.resolve(__dirname,'../../../learning/library-pilot/grade-5-math/assets/rectangles.png')).toString('base64');
 const snapshot={title:'Bahçenin çevresini keşfedelim',body:'Okul bahçesinin planını incele. Sorularda hangi kenarların kullanıldığını açıklayarak ilerle.',subject:'Matematik',grade:5,grouped:true,images:[{id:id(5),alt:'İki dikdörtgenin kenar uzunlukları gösteriliyor.',width:1000,height:600}],questions:[{key:'q1',grade:5,subject:'Matematik',topic:'Çevre',kind:'open_ended',difficulty:'orta',stem:'Kenarları 7 ve 4 metre olan bahçenin çevresi kaç metredir?',choices:null,correct_key:null,expected_answer:'22 metre',solution:'7 + 4 + 7 + 4 = 22 metre.',explanation:'Karşılıklı kenarların uzunlukları eşittir.'},{key:'q2',grade:5,subject:'Matematik',topic:'Çevre',kind:'open_ended',difficulty:'orta',stem:'Bahçenin kısa kenarı 2 metre uzatılırsa çevresi nasıl değişir?',choices:null,correct_key:null,expected_answer:'4 metre artar.',solution:'İki kısa kenar da 2 metre uzar: 2 + 2 = 4.',explanation:'Yalnız bir kenarın değil, karşısındaki kenarın da değiştiğini düşün.'}]};
 const state={access:true,submit:[],decisions:[],loseSubmit:true,loseDecision:true,rows:admin?[{id:cid,status:'pending',question_id:qid,title:snapshot.title,subject:'Matematik',grade:5,question_count:2,created_at:'2026-11-04T09:00:00Z',review_note:null,package_id:null}]:[],receipts:{}};
 await page.context().route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname,b=req.postDataJSON?.()??{};let result=[];
  if(p.endsWith('/my_operation_roles'))result=[];
  else if(p.includes('/rpc/')&&!state.access)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'forbidden'})});
  else if(p.endsWith('/families'))result={timezone:'Europe/Istanbul'};
  else if(p.endsWith('/preview_question_contribution'))result=snapshot;
  else if(p.endsWith('/learning-source'))result={url:'data:image/png;base64,'+png};
  else if(p.endsWith('/contribution-submit')){
   state.submit.push(b);let row=state.rows.find(x=>x.id===b.id);if(!row){row={id:b.id,status:'pending',question_id:qid,title:snapshot.title,subject:'Matematik',grade:5,question_count:2,created_at:'2026-11-04T09:00:00Z',review_note:null,package_id:null};state.rows.push(row);}if(state.loseSubmit){state.loseSubmit=false;return route.abort('connectionreset');}result={id:row.id,status:row.status};
  }else if(p.endsWith('/list_question_contributions')||p.endsWith('/admin_list_contribution_sets'))result=state.rows;
  else if(p.endsWith('/withdraw_question_contribution')){state.rows.find(r=>r.id===b.p_id).status='withdrawn';result=null;}
  else if(p.endsWith('/admin_get_contribution_set')){const row=state.rows.find(x=>x.id===b.p_id);result={id:row.id,status:row.status,package_id:row.package_id,review_note:row.review_note,snapshot:{...snapshot,images:undefined,image_alts:snapshot.images.map(i=>i.alt)},media:{base64:png,sha256:'a'.repeat(64),width:1000,height:600}};}
  else if(p.endsWith('/admin_decide_contribution_set')){
   state.decisions.push(b);let r=state.receipts[b.p_request_id];if(!r){const row=state.rows.find(x=>x.id===b.p_id);row.status=b.p_approve?'approved':'rejected';row.review_note=b.p_note;row.package_id=b.p_approve?id(8):null;r=state.receipts[b.p_request_id]={id:b.p_id,status:row.status,package_id:row.package_id,credited_questions:b.p_approve?2:0};}if(state.loseDecision){state.loseDecision=false;return route.abort('connectionreset');}result=r;
  }
  else if(p.endsWith('/admin_learning_library'))result={quotas:[],rewards:[],collections:[],items:[],submissions:[]};
  else if(p.endsWith('/get_learning_library'))result={limit:5,remaining:5,bonus:0,contributions:[],grants:[],rewards:[],collections:[]};
  else if(p.endsWith('/auth/v1/user'))result={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.addInitScript(({user,family,admin})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{admin,role:'parent',family_id:family,device_id:null,child_id:null}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,email:'review@example.invalid',app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family,admin});
 await page.setViewportSize(admin?{width:1440,height:1100}:{width:390,height:844});
 await page.goto(admin?'http://localhost:3108/library?tab=review':'http://localhost:8098/parent/prova/share?questionId='+qid);
 if(admin)await page.getByRole('button',{name:'Katkılar',exact:true}).click();
 return state;
};
