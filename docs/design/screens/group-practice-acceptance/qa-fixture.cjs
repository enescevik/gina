module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3),group=id(4),exam=id(5);
 const state={entries:[],requests:[],ready:false,resultReads:0,first:true};
 const g={id:group,title:'Birlikte Matematik',subject:'Matematik',grade:5,curriculum:'İncelenmiş pilot',version:'qa-1',starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),minutes:20,questions:3,included:true,status:'published'};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5}];
  else if(path.endsWith('/rpc/get_group_exams'))data={enabled:true,monthly:1,used:state.entries.length,groups:[g],entries:state.entries};
  else if(path.endsWith('/rpc/enroll_group_exam')){
   state.requests.push(body);
   if(state.first){state.first=false;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'group_not_open',code:'P0001'})});}
   if(!state.entries.length)state.entries.push({group_id:group,child_id:child,exam_id:exam,alias:'Kâşif 28',ranking:false});
   return route.abort('failed');
  }
  else if(path.endsWith('/rpc/get_group_result')){state.resultReads++;data=state.ready?{ready:true,participated:true,cancelled:false,correct:2,total:3,attempt_id:id(6),topics:[{topic:'Üçgenler',correct:2,total:3,unanswered:0}],ranking:[]}:{ready:false,ends_at:g.ends_at};}
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
 await page.goto('http://localhost:8098/parent/prova/groups');
 return state;
};
