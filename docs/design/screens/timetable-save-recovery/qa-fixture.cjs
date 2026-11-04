// Real Expo UI; all network data is synthetic. Never connects to a real family.
module.exports = async (page, childMode=false) => {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(8601),family=id(8602),child=id(8603);
 const state={server:{revision:3,lessons:[{id:'math',day:1,title:'Matematik',start:'09:00',end:'09:40'}],settings:{start:'09:00',duration:40,break:10}},requests:[],receipts:{},lost:true,reject:false};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,body=request.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',avatar:'avatar-boy-01',grade:5}];
  else if(path.endsWith('/school_timetables'))data=state.server;
  else if(path.endsWith('/rpc/save_school_timetable_request')){
   state.requests.push(body);
   if(state.reject)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'timetable_conflict'})});
   data=state.receipts[body.p_request_id];
   if(!data){
    if(body.p_revision!==state.server.revision)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'timetable_conflict'})});
    state.server={revision:body.p_revision+1,lessons:body.p_lessons,settings:body.p_settings};
    data={request:body.p_request_id,child_id:child,revision:state.server.revision};state.receipts[body.p_request_id]=data;
   }
   if(state.lost){state.lost=false;return route.abort('failed');}
  }
  else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family,child,childMode})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});
  Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:childMode?'device':'parent',device_id:childMode?user:null,child_id:childMode?child:null,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family,child,childMode});
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:8098/'+(childMode?'child':'parent')+'/calendar');
 return state;
};
