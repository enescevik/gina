// Synthetic responses only. No production accounts, messages or FAQ publishing.
module.exports=async(page,{width=390,height=844,mode='ready',delay=0}={})=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),now='2026-11-03T09:00:00+00:00';
 const state={mode,delay,lose:false,calls:[],receipts:{}};
 const tickets=[{id:id(10),kind:'support',category:'device',subject:'Tableti eşleştiremiyorum',status:'waiting_parent',revision:2,created_at:now,updated_at:now},{id:id(11),kind:'idea',category:'other',subject:'Birlikte okuma hedefi',status:'open',revision:1,created_at:now,updated_at:now}];
 const messages={ [id(10)]:[{sequence:1,author_role:'parent',visibility:'family',body:'Çocuğumun tabletinde eşleştirme kodu açıldı. Telefonumda bu kodu nereye yazacağım?',created_at:now},{sequence:2,author_role:'support',visibility:'family',body:'Diğer → Cihazlar bölümünü açıp tabletteki altı haneli kodu yazabilirsin. Ardından bu cihazı kullanacak çocukları seç. Takıldığın adımı birlikte kontrol edebiliriz.',created_at:now}], [id(11)]:[{sequence:3,author_role:'parent',visibility:'family',body:'Birlikte okuduğumuz kitapları ailece takip edebilsek güzel olur.',created_at:now}]};
 let sequence=3;
 await page.route('https://ginaqa.supabase.co/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname,body=req.postData()?req.postDataJSON():{};let data=[],status=200;
 if(state.delay && path.includes('/rpc/')) await new Promise(resolve=>setTimeout(resolve,state.delay));
 if(path.endsWith('/__help_fixture')){Object.assign(state,body);data={...state,tickets,messages};}
 else if(path.includes('/rpc/') && state.mode==='error'){data={message:'synthetic outage'};status=503;}
 else if(path.endsWith('/get_help_articles'))data=state.mode==='empty'?[]:['Cihazı nasıl eşleştiririm?','Çocuk PIN’i ne işe yarar?','AI haklarımı nerede görürüm?'].map((title,i)=>({id:id(20+i),slug:'example-'+i,locale:'tr',platform:'all',revision:1,published_revision:1,title,body:'Bu yalnız görsel kontrol için hazırlanmış örnek yardım içeriğidir. Gerçek yardım yazısı olarak yayımlanmamıştır.',reviewed_at:now}));
 else if(path.endsWith('/list_help_tickets'))data=state.mode==='empty'?[]:tickets;
 else if(path.endsWith('/get_help_ticket')){const t=tickets.find(t=>t.id===body.p_ticket_id);data={...t,messages:messages[t.id]};}
 else if(path.endsWith('/create_help_ticket') || path.endsWith('/reply_help_ticket')){
   state.calls.push(body);
   if(state.receipts[body.p_request_id])data=state.receipts[body.p_request_id];
   else if(path.endsWith('/create_help_ticket')){const t={id:id(100+tickets.length),kind:body.p_kind,category:body.p_category,subject:body.p_subject,status:'open',revision:1,created_at:now,updated_at:now};tickets.unshift(t);messages[t.id]=[{sequence:++sequence,author_role:'parent',visibility:'family',body:body.p_body,created_at:now}];data={id:t.id,revision:1,status:t.status};state.receipts[body.p_request_id]=data;}
   else {const t=tickets.find(t=>t.id===body.p_ticket_id);if(t.revision!==body.p_revision){status=400;data={code:'P0001',message:'help_changed'};}else{t.revision++;t.status=body.p_status||'open';messages[t.id].push({sequence:++sequence,author_role:'parent',visibility:'family',body:body.p_body,created_at:now});data={id:t.id,revision:t.revision,status:t.status};state.receipts[body.p_request_id]=data;}}
   if(state.lose){state.lose=false;await route.abort();return;}
 }
 else if(path.endsWith('/auth/v1/user'))data={id:user};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{
 const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';
 localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family});
 await page.setViewportSize({width,height});
 await page.goto('http://localhost:8096/parent/help');
 await page.getByText('Birlikte çözelim',{exact:true}).waitFor();
 return state;
};
