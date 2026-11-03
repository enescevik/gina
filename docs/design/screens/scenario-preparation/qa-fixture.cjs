module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3);
 const state={blueprints:[],blueprintSaves:[],loseSave:true};
 await page.context().route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON?.()??{};let data=[];
  if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
  else if(path.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-curly'}];
  else if(path.endsWith('/school_timetables'))data={revision:1,lessons:[{id:'math',title:'Matematik',day:1,start:'09:00',end:'09:40'},{id:'science',title:'Fen',day:1,start:'10:00',end:'10:40'}],settings:{}};
  else if(path.endsWith('/rpc/save_family_blueprint')){
    state.blueprintSaves.push(body);let item=state.blueprints.find(x=>x.request===body.p_request_id);
    if(!item){item={id:id(100+state.blueprints.length),...body.p_input,request:body.p_request_id};state.blueprints.push(item);}
    if(state.loseSave){state.loseSave=false;return route.abort('failed');}data=item.id;
  }
  else if(path.endsWith('/exam_blueprints'))data=state.blueprints;
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
 await page.goto('http://localhost:8098/parent/prova/blueprint');
 return state;
};
