async (page) => {
 const ctx=await page.context().browser().newContext({viewport:{width:1280,height:900},locale:"tr-TR"});
 try{
  const p=await ctx.newPage();const errors=[];p.on("pageerror",e=>errors.push(String(e)));
  await p.goto("http://127.0.0.1:8772/docs/design/screens/child/cat-motion-v5/index.html",{waitUntil:"domcontentloaded"});
  await p.waitForFunction(()=>Array.from(document.querySelectorAll("video")).every(v=>v.readyState>=2));
  await p.getByRole("button",{name:"İkisini oynat",exact:true}).click();
  await p.waitForFunction(()=>Array.from(document.querySelectorAll("video")).every(v=>v.currentTime>.5));
  await p.getByRole("button",{name:"Duraklat",exact:true}).click();
  await p.locator("#sleep").evaluate(v=>new Promise(resolve=>{v.addEventListener("seeked",resolve,{once:true});v.currentTime=3}));
  await p.locator("#stretch").evaluate(v=>new Promise(resolve=>{v.addEventListener("seeked",resolve,{once:true});v.currentTime=4}));
  await p.screenshot({path:"/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/cat-motion-v5/review-desktop.png",fullPage:true});
  const desktop=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,missingImages:Array.from(document.images).filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),videos:Array.from(document.querySelectorAll("video")).map(v=>({src:v.getAttribute("src"),width:v.videoWidth,height:v.videoHeight,duration:v.duration,paused:v.paused,time:v.currentTime,error:v.error?.message}))}));
  await p.getByRole("button",{name:"Koyu zemin",exact:true}).click();
  const dark=await p.locator(".stage.dark").count();
  await p.getByRole("button",{name:"Şeffaflık kontrolü",exact:true}).click();
  const checker=await p.locator(".stage.checker").count();
  await p.getByRole("button",{name:"Krem zemin",exact:true}).click();
  await p.setViewportSize({width:390,height:844});
  await p.screenshot({path:"/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/cat-motion-v5/review-phone.png",fullPage:true});
  const phone=await p.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
  return {desktop,phone,dark,checker,errors};
 }finally{await ctx.close()}
}
