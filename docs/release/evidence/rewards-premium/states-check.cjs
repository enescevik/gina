async page => {
 const assert={equal(a,b){if(a!==b)throw Error('Expected '+JSON.stringify(b)+' got '+JSON.stringify(a));},deepEqual(a,b){this.equal(JSON.stringify(a),JSON.stringify(b));}};
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:390,height:844},reducedMotion:'reduce'});page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/release/evidence/rewards-premium';const id='11111111-1111-4111-8111-111111111111';
 let rewards=[{id:'r1',title:'Ailece sinema',icon:'reward-movie-night',cost_stars:20,active:true},{id:'r2',title:'Yeni kitap',icon:'reward-book',cost_stars:30,active:true},{id:'r3',title:'Birlikte oyun',icon:'reward-game-with-parent',cost_stars:10,active:true}];
 const request=(rid,reward,child,status)=>({id:rid,status,cost_snapshot:reward.cost_stars,requested_at:'2026-11-02T07:00:00Z',family_rewards:reward,children:{name:child,avatar:child==='Ece'?'avatar-reference-girl':'avatar-reference-boy'}});
 let requests=[request('q1',rewards[0],'Ece','requested'),request('q2',rewards[1],'Can','approved')];
 let releaseLoad;const loadGate=new Promise(resolve=>releaseLoad=resolve);let holdLoad=true,failRequests=false;
 let failAction=false,failToggle=false,failSave=false,failLoad=false,stale=false;const calls=[],writes=[],errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({id})=>{const exp=1900000000;const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,email:'fixture@gina.local'}}));},{id});
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let body=[],status=200;
  if(name==='family_rewards'){
   if(req.method()==='POST'){const values=req.postDataJSON();writes.push(values);if(failSave){status=503;body={message:'fixture_offline'};}else rewards.push({...values,id:'r4',active:true});}
   else if(req.method()==='PATCH'){if(failToggle){status=503;body={message:'fixture_offline'};}else {const row=rewards.find(r=>r.id===url.searchParams.get('id')?.slice(3));Object.assign(row,req.postDataJSON());body={id:row.id};}}
   else if(failLoad){status=503;body={message:'fixture_offline'};}else body=rewards;
  }
  if(name==='reward_requests'){if(holdLoad)await loadGate;if(failRequests){status=503;body={message:'offline'};}else body=requests.filter(r=>['requested','approved'].includes(r.status));}
  if(['decide_reward_request','deliver_reward_request','cancel_reward_request'].includes(name)){
   const args=req.postDataJSON();calls.push({name,args});const row=requests.find(r=>r.id===args.p_request_id);
   if(failAction){status=400;body={message:'insufficient_stars',code:'P0001'};}
   else {row.status=stale?'declined':name==='decide_reward_request'?(args.p_approve?'approved':'declined'):name==='deliver_reward_request'?'delivered':'cancelled';body=row;}
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });await page.routeWebSocket('**/realtime/**',s=>s.close());

 await page.goto('http://localhost:8086/parent/rewards');await page.getByLabel('Ödüller yükleniyor',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:dir+'/loading-phone.png'});holdLoad=false;releaseLoad();await page.getByText('Ailece sinema',{exact:true}).waitFor();checks.push('loading state');
 await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByTestId('request-q2').getByRole('button',{name:'İptal ve iade',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/requests-small-phone.png'});checks.push('320px request actions reachable');
 failRequests=true;await page.reload();await page.getByText('Ödüller yüklenemedi.',{exact:false}).waitFor();await page.screenshot({path:dir+'/load-error-phone.png'});await page.getByRole('button',{name:'Katalog',exact:true}).click();await page.getByText('Ailece sinema',{exact:true}).waitFor();checks.push('requests outage does not hide catalog');
 failRequests=false;requests=[];rewards=[];await page.reload();await page.getByText('Bekleyen istek yok.',{exact:true}).waitFor();await page.getByRole('button',{name:'Ödül kataloğunu gör',exact:true}).click();await page.getByText('İlk ödülünüzü birlikte seçin',{exact:true}).waitFor();await page.screenshot({path:dir+'/empty-catalog-phone.png'});await page.getByRole('button',{name:'Yeni ödül',exact:true}).click();await page.getByLabel('Ödül adı',{exact:true}).fill('Deneme ödülü');await page.getByLabel('Yıldız bedeli',{exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:dir+'/form-small-phone.png'});checks.push('empty catalog guides creation; 320px form fits');
 assert.deepEqual(errors,[]);await page.getByRole('button',{name:'Vazgeç',exact:true}).first().click();await page.getByRole('button',{name:'Taslağı bırak',exact:true}).click();await context.close();return {checks,errors,allBackendTrafficMocked:true};
}