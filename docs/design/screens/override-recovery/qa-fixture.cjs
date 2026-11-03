// Synthetic QA only: all service requests are intercepted before navigation.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),state={calls:[],grants:[],audits:[],receipts:{},lost:{grant:false,expire:false}};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,body=route.request().postDataJSON?.()??{};let data=[];
  if(path==='/__qa') data=state;
  else if(path.endsWith('/my_operation_roles'))data=['finance','support','content','release'];
  else if(path.endsWith('/admin_search_families'))data=[{id:family,name:'Yılmaz Ailesi'}];
  else if(path.endsWith('/admin_list_overrides'))data=state.grants;
  else if(path.endsWith('/audit_log'))data=state.audits;
  else if(path.endsWith('/admin_save_override')){
   state.calls.push(body);const p=body.p_command,key=body.p_request_id;
   if(!state.receipts[key]){
    let target;
    if(p.action==='grant'){
     target=id(100+state.grants.length);
     state.grants.push({id:target,family_id:family,family_name:'Yılmaz Ailesi',plan:p.plan,reason:p.reason,starts_at:p.starts_at,ends_at:p.ends_at,revoked_at:null,created_at:new Date().toISOString()});
    }else {target=p.override_id;state.grants.find(g=>g.id===target).revoked_at=new Date().toISOString();}
    state.audits.push({id:id(200+state.audits.length),action:p.action==='grant'?'entitlement_overrides.insert':'entitlement_overrides.expire',reason:p.reason,actor_id:user,created_at:new Date().toISOString()});
    state.receipts[key]={request_id:key,action:p.action,override_id:target,family_id:family};
   }
   if(!state.lost[p.action]){state.lost[p.action]=true;return route.abort('connectionreset');}
   data=state.receipts[key];
  }else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{admin:true,role:'none'}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:user,email:'admin@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{}}}));
 },{user});
 await page.setViewportSize({width:1440,height:1100});
 await page.goto('http://localhost:3108/overrides?family='+family);
 await page.getByRole('heading',{name:'Geçici haklar',exact:true}).waitFor();
 return {family};
};
