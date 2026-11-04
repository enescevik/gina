// Synthetic operator UI fixture: every service call is intercepted, no real data changed.
module.exports=async page=>{
 const uid='00000000-0000-4000-8000-000000005602';
 const state={rows:[],commands:[],receipts:{},lose:true,access:true};
 await page.context().route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,b=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/my_operation_roles'))data=[];
  else if(path.includes('/rpc/')&&!state.access)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'forbidden'})});
  else if(path.endsWith('/admin_learning_library'))data={collections:[],items:[],submissions:[],rewards:[],quotas:[]};
  else if(path.endsWith('/admin_list_curriculum_candidates'))data=state.rows.map(({candidate,review,reviewed_at,...r})=>r);
  else if(path.endsWith('/admin_get_curriculum_candidate'))data=state.rows.find(r=>r.id===b.p_id);
  else if(path.endsWith('/admin_import_curriculum_candidates')){
   state.commands.push(b);data=state.receipts[b.p_request_id];
   if(!data){let created=0;for(const c of b.p_bundle.candidates){if(state.rows.some(r=>r.key===c.key))continue;created++;state.rows.push({id:`00000000-0000-4000-8000-${String(state.rows.length+1).padStart(12,'0')}`,key:c.key,academic_year:c.academic_year,term:c.term,exam:c.exam,grade:c.grade,subject:c.subject,label:c.label,question_count:c.question_count,status:'draft',revision:0,content_hash:'b'.repeat(64),review_reasons:c.review_reasons,candidate:c,review:null,reviewed_at:null});}data=state.receipts[b.p_request_id]={request:b.p_request_id,action:'import',created,existing:b.p_bundle.candidates.length-created,total:b.p_bundle.candidates.length};}
   if(state.lose){state.lose=false;return route.abort('connectionreset');}
  }else if(path.endsWith('/admin_change_curriculum_candidate')){
   state.commands.push(b);data=state.receipts[b.p_request_id];
   if(!data){const r=state.rows.find(r=>r.id===b.p_id);if(r.revision!==b.p_revision)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'curriculum_revision_conflict'})});r.status={review:'reviewed',publish:'published',withdraw:'withdrawn'}[b.p_action];r.revision++;if(b.p_action==='review'){r.review=b.p_review;r.reviewed_at='2026-11-04T12:00:00Z';}data=state.receipts[b.p_request_id]={request:b.p_request_id,action:b.p_action,id:r.id,revision:r.revision,status:r.status};}if(state.lose){state.lose=false;return route.abort('connectionreset');}
  }else if(path.endsWith('/auth/v1/user'))data={id:uid};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(uid=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+86400,gina:{admin:true,role:'parent',family_id:null,device_id:null,child_id:null}}))+'.synthetic';localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:uid,email:'catalogue@example.invalid',app_metadata:{},user_metadata:{},aud:'authenticated'}}));},uid);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://localhost:3108/library?tab=curriculum');
 return state;
};
