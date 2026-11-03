// Synthetic editorial content only. No production requests, accounts or publications.
module.exports=async(page,{width=1440,height=1000,mode='ready',delay=0}={})=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(81),now='2026-11-03T07:20:00+00:00';
 const version=(revision,title,body,reviewed_at=null)=>({revision,title,body,reviewed_at});
 const old=version(1,'Çocuk PIN’i ne işe yarar?','Çocuk PIN’i, çocuğun kendi profilini açması içindir.',now);
 const articles=[{id:id(10),slug:'child-pin',locale:'tr',platform:'all',revision:2,published_revision:1,published:old,draft:version(2,old.title,'Çocuk PIN’i, çocuğun kendi profilini açması içindir. Cihaz eşleştirme kodu ise ayrı bir telefonu veya tableti aileye bağlar. Bu iki kod aynı değildir.')},{id:id(11),slug:'device-pairing',locale:'tr',platform:'ios',revision:1,published_revision:1,draft:version(1,'Cihazı nasıl eşleştiririm?','Cihazlar bölümünden eşleştirme adımlarını izleyin.',now)},{id:id(12),slug:'usage',locale:'tr',platform:'all',revision:1,published_revision:null,published:null,draft:version(1,'AI haklarımı nerede görürüm?','Paketler bölümünden kalan kullanım hakkınızı görebilirsiniz.')}];articles[1].published={...articles[1].draft};
 const state={delay,roles:['content'],mode,lose:false,calls:[],receipts:{},filters:[]};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
 const path=new URL(route.request().url()).pathname,body=route.request().postData()?route.request().postDataJSON():{};let data=[],status=200;
 if(state.delay&&path.includes('/rpc/')&&!path.endsWith('/my_operation_roles'))await new Promise(r=>setTimeout(r,state.delay));
 if(path.endsWith('/__article_fixture')){if(body.change){articles[0].revision++;articles[0].draft=version(articles[0].revision,'Başka editörün başlığı','Sunucuda başka editörün kaydettiği yanıt.');}Object.assign(state,body);data={...state,articles};}
 else if(path.endsWith('/my_operation_roles')){if(state.roleError){status=503;data={message:'roles unavailable'};}else data=state.roles;}
 else if(path.includes('/rpc/')&&!state.roles.includes('content')){status=403;data={code:'42501',message:'forbidden'};}
 else if(path.includes('/rpc/')&&state.mode==='error'){status=503;data={message:'unavailable'};}
 else if(path.endsWith('/list_help_editor_articles')){state.filters.push(body);data=state.mode==='empty'?[]:articles.filter(a=>a.locale===body.p_locale&&(!body.p_platform||a.platform===body.p_platform)).map(a=>({...a,title:a.draft.title,reviewed_at:a.draft.reviewed_at}));}
 else if(path.endsWith('/get_help_editor_article')){data=articles.find(a=>a.id===body.p_id);if(!data){status=400;data={code:'P0001',message:'article_not_found'};}}
 else if(path.endsWith('/save_help_article')||path.endsWith('/review_help_article')){state.calls.push(body);let a=articles.find(a=>a.id===body.p_id);if(state.receipts[body.p_request_id])data=state.receipts[body.p_request_id];else if((a?.revision??0)!==body.p_revision){status=400;data={code:'P0001',message:'help_changed'};}else if(path.endsWith('/save_help_article')){if(!a){a={id:body.p_id,slug:body.p_slug,locale:body.p_locale,platform:body.p_platform,published_revision:null,published:null};articles.push(a);}a.revision=body.p_revision+1;a.draft=version(a.revision,body.p_title,body.p_body);data={id:a.id,revision:a.revision};}else{const action=body.p_action;if(action==='review')a.draft.reviewed_at=now;if(action==='publish'){if(!a.draft.reviewed_at){status=400;data={code:'P0001',message:'article_review_required'};}else {a.published={...a.draft};a.published_revision=a.revision;}}if(action==='archive'){a.published=null;a.published_revision=null;}if(status===200)data={id:a.id,revision:a.revision,action};}if(status===200)state.receipts[body.p_request_id]=data;if(state.lose){state.lose=false;await route.abort();return;}}
 else if(path.endsWith('/auth/v1/user'))data={id:user};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{role:'none',admin:false}}))+'.synthetic';if(!localStorage.getItem('sb-ginaqa-auth-token'))localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,email:'icerik-ornek@gina.local',app_metadata:{},user_metadata:{},aud:'authenticated'}}));},{user});
 await page.setViewportSize({width,height});await page.goto('http://localhost:3102/help-articles');await page.getByRole('heading',{name:'Yardım yazıları',exact:true}).waitFor();
 return state;
};
