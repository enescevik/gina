// Synthetic auth/data only. Use Metro with the ginaqa URL, never a live family.
module.exports = async page => {
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const user=id(1),family=id(2),child=id(3),device=id(4);
  await page.unrouteAll({behavior:'ignoreErrors'});
  await page.route('https://ginaqa.supabase.co/**', async route=>{
    const path=new URL(route.request().url()).pathname;
    let data=[];
    if(path.endsWith('/devices'))data={id:device,active_child_id:child,revoked_at:null};
    else if(path.endsWith('/families'))data={timezone:'Europe/Istanbul'};
    else if(path.endsWith('/children'))data={id:child,name:'Emre',avatar:'avatar-boy-01'};
    else if(path.endsWith('/task_templates'))data=[{id:id(5),title:'Kitabımdan bir bölüm okuyorum',icon:'reading',stars:10,days_of_week:[0,1,2,3,4,5,6],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:0},{id:id(6),title:'Çantamı hazırlıyorum',icon:'school-bag',stars:5,days_of_week:[0,1,2,3,4,5,6],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:1}];
    else if(path.endsWith('/child_goals'))data=null;
    else if(path.endsWith('/auth/v1/user'))data={id:user};
    await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:JSON.stringify(data)});
  });
  await page.addInitScript(({user,family,child,device})=>{
    Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});
    Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
    const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'device',device_id:device,child_id:child,admin:false}}))+'.synthetic';
    localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
  },{user,family,child,device});
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://localhost:8098/child/today');
  await page.getByText('Kitabımdan bir bölüm okuyorum',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Başla',exact:true}).click();
  await page.getByRole('button',{name:'Odak süresi seç',exact:true}).click();
};
