// Synthetic network acceptance. Does not read or change the user's database.
module.exports=async(page,childMode=false)=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=id(8901),family=id(8902),child=id(8903);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const state={items:[],requests:[],receipts:{},lost:false,today};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/rpc/get_learning_plan_item'))data=state.items.find(x=>x.id===body.p_id)??null;
  else if(path.endsWith('/rpc/get_learning_plan'))data={today,items:state.items};
  else if(path.endsWith('/rpc/save_learning_plan')){
   state.requests.push(body);data=state.receipts[body.p_request_id];
   if(!data){
    const old=state.items.find(x=>x.id===body.p_id);
    if((old?.revision??0)!==body.p_revision)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'plan_changed'})});
    state.items=state.items.filter(x=>x.id!==body.p_id).concat({id:body.p_id,child_id:child,revision:body.p_revision+1,content:body.p_content,updated_at:new Date().toISOString(),done_at:body.p_content.done?new Date().toISOString():null,source:null});
    data={request:body.p_request_id,child_id:child,id:body.p_id,revision:body.p_revision+1};state.receipts[body.p_request_id]=data;
   }
   if(state.lost){state.lost=false;return route.abort('failed');}
  }else if(path.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family,child,childMode})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:childMode?'device':'parent',device_id:childMode?user:null,child_id:childMode?child:null,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family,child,childMode});
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8098/'+(childMode?'child':'parent')+'/calendar');return state;
};
