// Local, synthetic parent/child packing acceptance. No live database calls.
module.exports=async(page,childMode=false)=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=id(8701),family=id(8702),child=id(8703);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const state={source:{child_id:child,day:today,today,timezone:'Europe/Istanbul',editable:true,revision:0,program_revision:1,saved_program_revision:null,items:[],lessons:[{id:'math',title:'Matematik',start:'09:00',end:'09:40'},{id:'science',title:'Fen Bilimleri',start:'09:50',end:'10:30'}]},requests:[],receipts:{},lost:true};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(path.endsWith('/rpc/get_school_bag'))data={...state.source,day:body.p_day};
  else if(path.endsWith('/rpc/save_school_bag')){
   state.requests.push(body);data=state.receipts[body.p_request_id];
   if(!data){
    const message=body.p_program_revision!==state.source.program_revision?'bag_program_changed':body.p_revision!==state.source.revision?'bag_changed':null;
    if(message)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'P0001',message})});
    state.source={...state.source,revision:body.p_revision+1,saved_program_revision:body.p_program_revision,items:body.p_items};
    data={request:body.p_request_id,child_id:child,day:body.p_day,revision:state.source.revision};state.receipts[body.p_request_id]=data;
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
