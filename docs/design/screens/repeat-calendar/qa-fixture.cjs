// Real Expo components, intercepted synthetic API only. No model or real family writes.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=id(8501),family=id(8502),child=id(8503),attempt=id(8504);
 const source={attempt_id:attempt,child_id:child,child_name:'Emre',grade:5,timezone:'Europe/Istanbul',hash:'a'.repeat(64),scheduled:null,questions:[{id:id(8510),position:2,stem:'Kenar uzunlukları 6, 8 ve 10 cm olan üçgenin çevresini bulup çözümünü açıkla.',subject:'Matematik',topic:'Üçgenin çevresi',state:'partial'},{id:id(8511),position:4,stem:'İki eş parçaya ayrılan pastanın bir parçasını hangi kesir gösterir?',subject:'Matematik',topic:'Kesirler',state:'wrong'}]};
 const state={source,requests:[],events:[],receipts:{},lost:true};
 await page.route('https://ginaqa.supabase.co/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
 if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
 else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
 else if(path.endsWith('/events'))data=state.events;
 else if(path.endsWith('/rpc/get_repeat_calendar'))data=source;
 else if(path.endsWith('/rpc/apply_repeat_calendar')){
  state.requests.push(body);data=state.receipts[body.p_request_id];
  if(!data){const items=body.p_items.map((r,i)=>{const e={id:id(8600+i),child_id:child,title:r.title,notes:r.notes,type:'activity',starts_at:r.starts_at,ends_at:new Date(Date.parse(r.starts_at)+r.minutes*60000).toISOString(),all_day:false,rrule:null,edit_revision:1};state.events.push(e);return{day:r.day,event_id:e.id};});data={request:body.p_request_id,attempt_id:attempt,items};state.receipts[body.p_request_id]=data;source.scheduled={question_ids:body.p_question_ids,questions:source.questions.filter(q=>body.p_question_ids.includes(q.id)),items:items.map((r,i)=>({step:r.day,event_id:r.event_id,title:state.events[i].title,starts_at:state.events[i].starts_at,ends_at:state.events[i].ends_at}))};}
  if(state.lost){state.lost=false;return route.abort('failed');}
 }
 else if(path.endsWith('/rpc/get_repeat_calendar_event'))data=source.scheduled?{attempt_id:attempt,question_ids:source.scheduled.question_ids}:null;
 else if(path.endsWith('/auth/v1/user'))data={id:user};
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{
 Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
 const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';
 localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family});await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8098/parent/prova/repeat/'+attempt);return state;
};
