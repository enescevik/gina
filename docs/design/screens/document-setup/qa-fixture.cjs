module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3);
 const state={requests:[],tasks:[],rewards:[],lost:false,aiCalls:0,sources:[],generationRequests:[],paid:0,generated:{},loseGeneration:true};
 await page.context().route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/task_templates'))data=state.tasks;
  else if(path.endsWith('/family_rewards'))data=state.rewards;
  else if(path.endsWith('/rpc/get_setup_ai_entitlement'))data={enabled:true,allowed:true,remaining:10,limit:10};
  else if(path.endsWith('/rpc/get_setup_sources')){data=(body.p_kind==='task'?state.tasks:state.rewards).filter(r=>body.p_ids.includes(r.id)&&r.source_id).map(r=>({item_id:r.id,source_id:r.source_id,name:'Okuma-plani.pdf',mime:'application/pdf'}));}
  else if(path.includes('/functions/v1/learning-source')){
   if(body.action==='reserve'){state.sources.push(body);data={id:body.id,ready:true};}
   else if(body.action==='view')data={url:'https://ginaqa.supabase.co/qa-source.pdf'};
   else data={ok:true};
  }
  else if(path.endsWith('/qa-source.pdf'))return route.fulfill({status:200,contentType:'text/html',body:'Synthetic private source preview'});
  else if(path.endsWith('/rpc/save_setup_batch')){
   state.requests.push(body);
   const rows=body.p_kind==='task'?state.tasks:state.rewards;
   for(let i=0;i<body.p_items.length;i++){
    const x=body.p_items[i],key=body.p_request_id+':'+i;
    if(!rows.some(r=>r.request===key)) rows.push({id:id(50+state.tasks.length+state.rewards.length),request:key,title:x.title,source_id:x.source_id,icon:x.icon,stars:x.stars,cost_stars:x.stars,days_of_week:x.days,starts_on:x.starts_on,active:true});
   }
   if(state.lost){state.lost=false;return route.abort('failed');}
   data=rows.map(r=>r.id);
  }
  else if(path.includes('/functions/v1/setup-suggestions')){
   state.aiCalls++;state.generationRequests.push(body);
   if(!state.generated[body.request_id]){state.paid++;state.generated[body.request_id]={suggestions:[{title:'Birlikte kitap okuyalım',icon:'read-book',stars:1,reason:'Belgede birlikte okuma etkinliği var.',source_id:body.source_id},{title:'Okuduklarımızı konuşalım',icon:'task-custom',stars:1,reason:'Belgedeki kısa paylaşım önerisi.',source_id:body.source_id}],document_notes:'Okuma planından iki öneri çıkardım. Günleri sen seçmelisin.'};}
   if(body.kind==='reward'){state.generated[body.request_id].suggestions=[{title:'Birlikte kitap saati',icon:'reward-book',stars:15,reason:'Belgedeki ailece okuma önerisi.',source_id:body.source_id},{title:'Ailece oyun saati',icon:'reward-game-with-parent',stars:20,reason:'Belgedeki ortak etkinlik.',source_id:body.source_id}];state.generated[body.request_id].document_notes='İki ortak zaman önerisi. Yıldızları birlikte belirleyin.';}
   if(state.loseGeneration){state.loseGeneration=false;return route.abort('failed');}
   data=state.generated[body.request_id];
  }
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
