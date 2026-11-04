// Synthetic parent home only. No real family, storage or AI requests.
module.exports=async(page)=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=id(8901),family=id(8902),child=id(8903),sibling=id(8904);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const state={calls:[],empty:false,children:[{id:child,name:'Ece',grade:2,avatar:'avatar-reference-girl'},{id:sibling,name:'Can',grade:5,avatar:'avatar-reference-boy'}]};
 const tasks=['Kitap okuma','Dişlerini fırçala','Odanı topla'].map((title,i)=>({id:id(8910+i),child_id:child,title,icon:['read-book','brush-teeth','tidy-room'][i],days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
 const completions=tasks.map((task,i)=>({id:id(8920+i),child_id:child,template_id:task.id,due_date:today,status:['approved','done','returned'][i],completed_at:new Date().toISOString(),task_templates:{title:task.title,icon:task.icon,stars:2},children:{name:'Ece'}}));
 completions.push({id:id(8925),child_id:sibling,template_id:id(8919),due_date:today,status:'approved'});
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();state.calls.push({name,method:req.method()});
  let data=[];
  if(name==='families')data={timezone:'Europe/Istanbul'};
  else if(name==='children')data=state.children;
  else if(name==='task_templates')data=tasks;
  else if(name==='task_completions')data=state.empty?[]:url.searchParams.get('status')==='eq.done'?completions.filter(c=>c.status==='done'):completions;
  else if(name==='family_members')data={display_name:'Deniz'};
  else if(name==='child_goals')data=null;
  else if(name==='user')data={id:user};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',admin:false,child_id:null,device_id:null}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated',is_anonymous:false}}));
 },{user,family});
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8098/parent');return state;
};
