module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3);
 const state={requests:[],tasks:[],rewards:[],lost:true,aiCalls:0};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/task_templates'))data=state.tasks;
  else if(path.endsWith('/family_rewards'))data=state.rewards;
  else if(path.endsWith('/rpc/get_setup_ai_entitlement'))data={enabled:true,allowed:true,remaining:10,limit:10};
  else if(path.endsWith('/rpc/save_setup_batch')){
   state.requests.push(body);
   const rows=body.p_kind==='task'?state.tasks:state.rewards;
   for(let i=0;i<body.p_items.length;i++){
    const x=body.p_items[i],key=body.p_request_id+':'+i;
    if(!rows.some(r=>r.request===key)) rows.push({id:id(50+state.tasks.length+state.rewards.length),request:key,title:x.title,icon:x.icon,stars:x.stars,cost_stars:x.stars,days_of_week:x.days,starts_on:x.starts_on,active:true});
   }
   if(state.lost){state.lost=false;return route.abort('failed');}
   data=rows.map(r=>r.id);
  }
  else if(path.includes('/functions/v1/setup-suggestions')){state.aiCalls++;data={suggestions:[{title:'Birlikte kitap seçimi',icon:'reward-book',stars:20,reason:'Birlikte karar verin.'},{title:'Ailece oyun saati',icon:'reward-game-with-parent',stars:15,reason:'Birlikte zaman geçirin.'},{title:'Parkta bir öğleden sonra',icon:'reward-park-trip',stars:10,reason:'Açık havada vakit geçirin.'}]};}
  else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});
  Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family});
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:8098/parent/tasks?create=1');
 return state;
};
