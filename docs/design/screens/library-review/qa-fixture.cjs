// Synthetic local QA only. Every Supabase request is intercepted in this context.
const fs = require('node:fs');
module.exports = async (page, {width=1440,height=1100}={}) => {
 const root='/Users/enes/.codex/worktrees/gina-prova-clarity/gina';
 const file=JSON.parse(fs.readFileSync('/tmp/gina-library-review-request.json','utf8'));
 const b=file.p_bundle, id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=id(7101),packageId=id(7102);
 const state={access:true,mode:'ready',lose:false,delay:0,calls:[],reviews:[],receipts:{},packages:[]};
 const makeDetail=(b,pid,answers)=>({id:pid,package_key:b.package_key,revision:b.revision,title:b.title,grade:b.grade,subject:b.subject,status:'draft',content_hash:'a'.repeat(64),...(answers?{provenance:b.provenance}:{}),sources:b.sources.map(s=>{const a=b.assets.find(a=>a.key===s.asset_key);return {key:s.key,title:s.title,body:s.body,alt:s.alt,sha256:a?.sha256??null,width:a?.width??null,height:a?.height??null,minimum_reading_width:s.minimum_reading_width,png_base64:a?.base64??null,...(answers?{provenance:s.provenance}:{})};}),questions:b.questions.map((q,i)=>({key:q.key,revision:q.revision,position:i+1,source_key:q.source_key,student:q.student,...(answers?{teacher:q.teacher,metadata:q.metadata}:{})}))});
 state.packages.push({id:packageId,bundle:b});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://localhost:3102')return route.continue();
  if(!url.hostname.endsWith('.supabase.co'))return route.abort();
  const path=url.pathname,body=route.request().postData()?route.request().postDataJSON():{};let data=[],status=200;
  if(path.endsWith('/__library_fixture')){if(body.stale){state.reviews=[{request_id:id(7201),package_id:packageId,question_key:b.questions[0].key,question_revision:1,review_revision:1,outcome:'suitable',note:'Başka editörün kayıtlı notu',created_at:'2026-11-03T12:00:00Z'}];}Object.assign(state,body);data={...state,file};}
  else if(path.endsWith('/my_operation_roles'))data=[];
  else if(path.includes('/rpc/')&&!state.access){status=403;data={code:'42501',message:'forbidden'};}
  else if(path.includes('/rpc/')&&state.mode==='error'){status=503;data={message:'unavailable'};}
  else if(path.endsWith('/admin_learning_library'))data={quotas:[],rewards:[],collections:[],items:[],submissions:[]};
  else if(path.endsWith('/admin_list_library_draft_packages'))data=state.mode==='empty'?[]:state.packages.map(p=>({id:p.id,package_key:p.bundle.package_key,revision:p.bundle.revision,title:p.bundle.title,grade:p.bundle.grade,subject:p.bundle.subject,status:'draft',created_at:'2026-11-03T12:00:00Z',question_count:p.bundle.questions.length,source_count:p.bundle.sources.length}));
  else if(path.endsWith('/admin_get_library_import')){state.calls.push({path,body});const p=state.packages.find(p=>p.id===body.p_id);data=p?makeDetail(p.bundle,p.id,body.p_include_answers):null;}
  else if(path.endsWith('/admin_get_library_reviews'))data=state.reviews.filter(r=>r.package_id===body.p_package_id);
  else if(path.endsWith('/admin_review_library_question')){
   state.calls.push({path,body});const old=state.reviews.find(r=>r.package_id===body.p_package_id&&r.question_key===body.p_question_key);
   if(state.receipts[body.p_request_id])data=state.receipts[body.p_request_id];
   else if((old?.review_revision??0)!==body.p_expected_review_revision){status=400;data={code:'P0001',message:'library_review_changed'};}
   else {data={request_id:body.p_request_id,package_id:body.p_package_id,question_key:body.p_question_key,question_revision:body.p_question_revision,review_revision:body.p_expected_review_revision+1,outcome:body.p_outcome,note:body.p_note,created_at:'2026-11-03T12:00:00Z'};state.reviews=[...state.reviews.filter(r=>r!==old),data];state.receipts[body.p_request_id]=data;}
   if(state.lose){state.lose=false;await route.abort();return;}
  }
  else if(path.endsWith('/admin_import_library_bundle')){state.calls.push({path,body});if(state.receipts[body.p_request_id])data=state.receipts[body.p_request_id];else{let p=state.packages.find(p=>p.bundle.package_key===body.p_bundle.package_key&&p.bundle.revision===body.p_bundle.revision);const created=!p;if(!p){p={id:id(7102+state.packages.length),bundle:body.p_bundle};state.packages.push(p);}data={id:p.id,content_hash:'a'.repeat(64),status:'draft',revision:p.bundle.revision,created};state.receipts[body.p_request_id]=data;}if(state.lose){state.lose=false;await route.abort();return;}}
  else if(path.endsWith('/auth/v1/user'))data={id:user};
  else if(!path.endsWith('/auth/v1/logout')){status=400;data={message:'unexpected fixture request'};}
  if(state.delay&&path.includes('/rpc/'))await new Promise(r=>setTimeout(r,state.delay));
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{admin:true,role:'none'}}))+'.synthetic';if(!localStorage.getItem('sb-ginaqa-auth-token'))localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,email:'yonetim-ornek@gina.local',app_metadata:{},user_metadata:{},aud:'authenticated'}}));},{user});
 await page.setViewportSize({width,height});await page.goto('http://localhost:3102/library');
 await page.getByRole('button',{name:'Taslak paketler',exact:true}).click();
 await page.getByRole('heading',{name:'Taslak paketler',exact:true}).waitFor();
 return {state,file,packageId,root};
};
