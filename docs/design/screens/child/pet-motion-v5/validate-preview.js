async (page) => {
 const ctx=await page.context().browser().newContext({viewport:{width:1280,height:900},locale:'tr-TR'});
 try {
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:8772/docs/design/screens/child/pet-motion-v5/index.html',{waitUntil:'domcontentloaded'});
  const results=[];
  for(const [species,label] of [['dog','Köpek'],['monkey','Maymun'],['lion','Aslan yavrusu']]){
   await p.locator('[data-pet="'+species+'"]').click();
   await p.waitForFunction(()=>['sleep','stretch','room-video'].every(id=>document.getElementById(id).readyState>=2));
   await p.getByRole('button',{name:'İkisini oynat',exact:true}).click();
   await p.waitForFunction(()=>['sleep','stretch','room-video'].every(id=>document.getElementById(id).currentTime>.4));
   await p.getByRole('button',{name:'Duraklat',exact:true}).click();
   for(const [id,time]of [['sleep',3],['stretch',5]])await p.locator('#'+id).evaluate((v,t)=>new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=t}),time);
   await p.evaluate(()=>document.querySelectorAll('.stage video').forEach(v=>v.controls=false));
   await p.waitForFunction(()=>['sleep','stretch'].every(id=>document.getElementById(id).readyState>=3&&!document.getElementById(id).seeking));
   await p.waitForTimeout(300);
   await p.locator('.clips').screenshot({path:'/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/pet-motion-v5/'+species+'-review-cream.png'});
   await p.getByRole('button',{name:'Koyu zemin',exact:true}).click();
   await p.locator('.clips').screenshot({path:'/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/pet-motion-v5/'+species+'-review-dark.png'});
   await p.getByRole('button',{name:'Şeffaflık kontrolü',exact:true}).click();
   const checker=await p.locator('.stage.checker').count();
   await p.getByRole('button',{name:'Krem zemin',exact:true}).click();
   await p.locator('#room-clip').selectOption('stretch');
   await p.waitForFunction(()=>document.getElementById('room-video').readyState>=2);
   await p.locator('#room-video').evaluate(v=>new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=5}));
   await p.locator('.room').screenshot({path:'/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/pet-motion-v5/'+species+'-review-room.png'});
   const desktop=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),videos:['sleep','stretch','room-video'].map(id=>{const v=document.getElementById(id);return {src:v.getAttribute('src'),width:v.videoWidth,height:v.videoHeight,duration:v.duration,time:v.currentTime,paused:v.paused,error:v.error?.message}})}));
   await p.setViewportSize({width:390,height:844});
   const phone=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
   if(species==='monkey')await p.screenshot({path:'/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/pet-motion-v5/review-phone.png',fullPage:true});
   results.push({species,label,desktop,phone,checker});
   await p.setViewportSize({width:1280,height:900});
   await p.locator('#room-clip').selectOption('sleep');
  }
  return {results,errors};
 }finally{await ctx.close()}
}
