module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3),planId=id(9);
 const stamp='2026-11-03T12:00:00.000Z';
 const plan={id:planId,child_id:child,family_id:family,subject:'Matematik',grade:5,status:'draft',updated_at:stamp,attempt_id:null,children:{name:'Emre'},families:{timezone:'Europe/Istanbul'},weak_topics:[{topic:'Üçgenin çevresi',pct:50}],plan:{ozet:'Kısa çizim ve karşılaştırma etkinlikleriyle çevre konusunu birlikte tekrar edebilirsiniz.',gunler:[{gun:1,konu:'Üçgenin çevresini keşfedelim',etkinlik:'Üç farklı üçgen çizip kenarlarını ölçün. Çevrelerini nasıl bulduğunuzu birbirinize anlatın.',sure_dk:15},{gun:2,konu:'Evde şekil avı',etkinlik:'Kitap ve masanın çevresini tahmin edip ölçün. Tahminlerinizi ölçümlerle karşılaştırın.',sure_dk:20},{gun:3,konu:'Kendi sorumu yazıyorum',etkinlik:'Bir üçgen sorusu oluşturup birlikte çözün.',sure_dk:15}],gorev_onerileri:[]}};
 const state={requests:[],events:[],links:[],receipts:new Map(),lost:true,plan};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/events'))data=state.events;
  else if(path.endsWith('/study_plans'))data=plan;
  else if(path.endsWith('/study_plan_calendar_items'))data=state.links;
  else if(path.endsWith('/rpc/apply_study_plan_calendar')){
   state.requests.push(body);
   if(!state.receipts.has(body.p_request_id)){
    const result=body.p_items.map((item,i)=>{
     const event={id:id(100+i),child_id:child,title:item.title,notes:item.notes,type:'activity',starts_at:item.starts_at,ends_at:new Date(Date.parse(item.starts_at)+item.minutes*60000).toISOString(),all_day:false,rrule:null,edit_revision:1};
     state.events.push(event);state.links.push({day:item.day,event_id:event.id,events:event});return {day:item.day,event_id:event.id};
    });
    state.receipts.set(body.p_request_id,result);plan.updated_at='2026-11-03T13:00:00.000Z';plan.status='approved';
   }
   data=state.receipts.get(body.p_request_id);
   if(state.lost){state.lost=false;return route.abort('failed');}
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
 await page.goto('http://localhost:8098/parent/prova/plan/'+planId);
 return state;
};
