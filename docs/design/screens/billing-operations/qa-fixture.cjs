// Local synthetic QA only. Intercepts every service request; never reads live family data.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),state={roles:['finance'],failed:false,calls:[]};
 const data={families:[{id:family,name:'Yılmaz Ailesi',plan:'pro',source:'comp',expires_at:'2026-11-18T09:00:00Z'},{id:id(3),name:'Kaya Ailesi',plan:'free',source:'free',expires_at:null}],
  detail:{id:family,name:'Yılmaz Ailesi',effective:{plan:'pro',source:'comp',expires_at:'2026-11-18T09:00:00Z'},subscriptions:[{id:id(4),platform:'apple',plan:'plus',product_id:'gina_plus_monthly',status:'active',expires_at:'2026-11-25T09:00:00Z',auto_renewing:false,updated_at:'2026-11-04T09:12:00Z'}],overrides:[{id:id(5),plan:'pro',reason:'Destek görüşmesi sonrası 14 günlük kullanım hakkı.',starts_at:'2026-11-04T09:00:00Z',ends_at:'2026-11-18T09:00:00Z',revoked_at:null}]},
  notifications:[{id:id(6),platform:'apple',received_at:'2026-11-04T09:10:00Z',attempts:2,processed_at:null,status:'failed',error_code:'processing_failed',family_id:family,family_name:'Yılmaz Ailesi'},{id:id(7),platform:'google',received_at:'2026-11-04T08:00:00Z',attempts:1,processed_at:null,status:'failed',error_code:'family_not_found',family_id:null,family_name:null}],
  summary:{unprocessed:2,active_store_families:1,active_overrides:1,as_of:'2026-11-04T09:15:00Z'}};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,body=route.request().postDataJSON?.()??{};let result=[];
  if(path==='/__qa'){
   if(url.searchParams.has('revoke'))state.roles=[];
   if(url.searchParams.has('fail'))state.failed=true;
   if(url.searchParams.has('restore')){state.roles=['finance'];state.failed=false;}
   result=state;
  }else if(path.endsWith('/my_operation_roles'))result=state.roles;
  else if(path.endsWith('/finance_workspace')){
   state.calls.push(body);
   if(!state.roles.length||state.failed)return route.fulfill({status:state.failed?500:403,contentType:'application/json',body:JSON.stringify({message:'unavailable'})});
   result={...data,families:data.families.filter(f=>!body.p_query||f.name.toLocaleLowerCase('tr').includes(body.p_query.toLocaleLowerCase('tr'))),detail:body.p_family_id?data.detail:null,notifications:body.p_family_id?data.notifications.filter(n=>n.family_id===body.p_family_id):data.notifications};
  }else if(path.endsWith('/auth/v1/user'))result={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.addInitScript(({user})=>{
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{admin:false,role:'none'}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:user,email:'finance@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{}}}));
 },{user});
 await page.setViewportSize({width:1440,height:1100});
 await page.goto('http://localhost:3108/billing');
 await page.getByRole('heading',{name:'Aileyi bul',exact:true}).waitFor();
 return {state,family};
};
