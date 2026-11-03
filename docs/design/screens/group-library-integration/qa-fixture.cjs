// Synthetic local QA only; no live service or published content is modified.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),pkg=id(2),state={calls:[],groups:[],lost:true};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON?.()??{};let data=[];
  if(path.endsWith('/admin_group_exams'))data={enabled:false,quotas:[{plan:'free',monthly:0},{plan:'plus',monthly:1},{plan:'pro',monthly:4}],groups:state.groups};
  else if(path.endsWith('/admin_learning_library'))data={collections:[],items:[]};
  else if(path.endsWith('/admin_group_package_catalog'))data=[{id:pkg,title:'Geometrik keşifler',grade:5,subject:'Matematik',version:2,curriculum:'İncelenmiş pilot · 2026–2027',plans:['plus','pro'],units:[{key:'source:triangles',title:'Üçgenleri birlikte inceleyelim',count:3,eligible:true,has_media:true},{key:'question:angles',title:'Açıları tanıyalım',count:1,eligible:true,has_media:false},{key:'source:explain',title:'Çözümünü çizerek anlat',count:2,eligible:false,has_media:true}]}];
  else if(path.endsWith('/admin_create_package_group_exam')){
   state.calls.push(body);
   if(!state.groups.some(g=>g.id===body.p_id))state.groups.push({id:body.p_id,title:body.p_title,grade:5,subject:'Matematik',curriculum_version:'Pilot',starts_at:body.p_start,ends_at:body.p_end,duration_minutes:body.p_minutes,status:'published',version_hash:'abcdef0123456789',participants:0});
   if(state.lost){state.lost=false;return route.abort();}data=body.p_id;
  }
  else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{admin:true,role:'none'}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:user,email:'editor@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{}}}));
 },{user});
 await page.setViewportSize({width:1440,height:1100});
 await page.goto('http://localhost:3108/groups');
 await page.getByRole('heading',{name:'Yeni ortak prova',exact:true}).waitFor();
 return {state,pkg};
};
