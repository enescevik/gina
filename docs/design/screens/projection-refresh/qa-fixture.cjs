// Synthetic REST and WebSocket only; no production/local database or AI call.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const [user,family,child,device,exam,task]=[9401,9402,9403,9404,9405,9406].map(id);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const state={assigned:false,approved:false,completed:false,calls:[],channels:new Map(),errors:[]};
 page.on('pageerror',e=>state.errors.push(e.message));
 await page.routeWebSocket('wss://ginaqa.supabase.co/**',ws=>{
  const topics=new Set();ws.onClose(()=>{for(const topic of topics)if(state.channels.get(topic)?.ws===ws)state.channels.delete(topic);});
  ws.onMessage(raw=>{
   const data=JSON.parse(String(raw)),array=Array.isArray(data);const m=array?{join_ref:data[0],ref:data[1],topic:data[2],event:data[3],payload:data[4]}:data;
   const send=(event,payload,ref=m.ref)=>ws.send(JSON.stringify(array?[m.join_ref,ref,m.topic,event,payload]:{join_ref:m.join_ref,ref,topic:m.topic,event,payload}));
   if(m.event==='phx_join'){
    const bindings=(m.payload.config?.postgres_changes??[]).map((b,i)=>({...b,id:i+1}));
    topics.add(m.topic);state.channels.set(m.topic,{bindings,send,ws});send('phx_reply',{status:'ok',response:{postgres_changes:bindings}});
   } else if(m.event==='phx_leave'){state.channels.delete(m.topic);send('phx_reply',{status:'ok',response:{}});}
   else if(m.event==='heartbeat')send('phx_reply',{status:'ok',response:{}});
  });
 });
 state.emit=table=>{for(const c of state.channels.values())for(const b of c.bindings)if(b.table===table)c.send('postgres_changes',{ids:[b.id],data:{schema:'public',table,type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:[],record:{id:exam,child_id:child,family_id:family},old_record:{},errors:[]}},null);};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();state.calls.push({name,method:req.method()});let data=[];const headers={'access-control-allow-origin':'*','access-control-expose-headers':'content-range'};
  if(name==='devices')data={id:device,active_child_id:child,revoked_at:null};
  else if(name==='families')data={timezone:'Europe/Istanbul'};
  else if(name==='children')data={id:child,name:'Ece',grade:5,avatar:'avatar-reference-girl'};
  else if(name==='exams'){
   const rows=state.assigned?[{id:exam,title:'Görsellerle Matematik',status:state.completed?'completed':'assigned',timed:false,duration_minutes:null,question_ids:[id(9410)],exam_attempts:state.completed?[{status:'completed',mc_total:1,mc_correct:1}]:[]}]:[];
   data=rows;headers['content-range']=`0-0/${state.assigned&&!state.completed?1:0}`;
  } else if(name==='task_templates')data=[{id:task,child_id:child,title:'Kitap okuma',icon:'read-book',stars:2,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:0}];
  else if(name==='task_completions')data=[{id:id(9411),template_id:task,child_id:child,due_date:today,status:state.approved?'approved':'done'}];
  else if(name==='star_events')data=state.approved?[{delta:2,created_at:new Date().toISOString()}]:[];
  else if(name==='child_goals')data=null;
  else if(name==='user')data={id:user};
  await route.fulfill({status:200,contentType:'application/json',headers,body:req.method()==='HEAD'?'':JSON.stringify(data)});
 });
 await page.addInitScript(({user,family,child,device})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'device',child_id:child,device_id:device,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family,child,device});
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8098/child/prova');return state;
};
