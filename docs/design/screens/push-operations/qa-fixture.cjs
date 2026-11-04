// Synthetic release operator only; no real provider or family data.
module.exports=async function(page){
 const user='00000000-0000-4000-8000-000000008401';
 const state={calls:[],receipts:{},lost:true,revoked:false,rows:[
 {id:42,kind:'cohort_results',status:'skipped_unconfigured',attempts:1,created_at:new Date(Date.now()-3600000).toISOString(),next_attempt_at:new Date().toISOString(),revision:0,retryable:true,receipts:{sent:1,unconfigured:1},recoveries:[]},
 {id:41,kind:'exam_finished',status:'failed',attempts:5,created_at:new Date(Date.now()-7200000).toISOString(),next_attempt_at:new Date().toISOString(),revision:0,retryable:true,receipts:{sent:1,retry:1},recoveries:[]},
 {id:40,kind:'task_approved',status:'failed',attempts:5,created_at:new Date(Date.now()-26*3600000).toISOString(),next_attempt_at:new Date().toISOString(),revision:2,retryable:false,receipts:{failed:1},recoveries:[{revision:1,reason:'Hizmet ayarı kontrol edildi; başarısız cihaz yeniden denendi.',created_at:new Date(Date.now()-25*3600000).toISOString()}]}
 ]};
 await page.route('https://ginaqa.supabase.co/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};state.calls.push({path,body});let data=[],status=200;
 if(path.endsWith('/my_operation_roles'))data=state.revoked?[]:['release'];
 else if(path.endsWith('/release_push_operations')){if(state.revoked){status=403;data={code:'42501',message:'forbidden'};}else data={summary:{pending:2,sending:0,failed:2,skipped_unconfigured:1},rows:state.rows.filter(r=>(!body.p_before||r.id<body.p_before)&&(body.p_status==='all'||(body.p_status==='attention'&&['failed','skipped_unconfigured'].includes(r.status))||r.status===body.p_status)).slice(0,body.p_limit??20)};}
 else if(path.endsWith('/release_retry_push')){if(state.revoked){status=403;data={code:'42501',message:'forbidden'};}else{data=state.receipts[body.p_request];if(!data){const row=state.rows.find(r=>r.id===body.p_outbox_id);if(!row||row.revision!==body.p_revision){status=409;data={code:'P0001',message:'push_recovery_changed'};}else{row.revision++;row.status='pending';row.retryable=false;row.attempts=0;row.receipts={sent:row.receipts.sent??0};row.recoveries.push({revision:row.revision,reason:body.p_reason,created_at:new Date().toISOString()});data={request:body.p_request,id:row.id,revision:row.revision,status:'pending'};state.receipts[body.p_request]=data;if(state.lost){state.lost=false;return route.abort('failed');}}}}}
 else if(path.endsWith('/auth/v1/user'))data={id:user};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{role:'none',admin:false}}))+'.synthetic';localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:user,email:'release-qa@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{}}}));},{user});
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://localhost:3108/notifications');return state;
};
