// Isolated synthetic operator. Never contacts production families or sends mail.
module.exports=async(page,{width=1440,height=1000,mode='ready',delay=0}={})=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(80),now='2026-11-03T07:20:00+00:00';
 const state={delay,roles:['support'],mode,lose:false,calls:[],receipts:{},filters:[]};
 const tickets=[{id:id(10),kind:'support',category:'device',subject:'Tableti eşleştiremiyorum',status:'open',revision:3,created_at:now,updated_at:now},{id:id(11),kind:'support',category:'learning',subject:'Prova sonucunu göremiyorum',status:'in_progress',revision:1,created_at:now,updated_at:now},{id:id(12),kind:'idea',category:'learning',subject:'Birlikte okuma hedefi',status:'open',revision:1,created_at:now,updated_at:now}];
 let sequence=5;
 const messages={ [id(10)]:[{sequence:1,author_role:'parent',visibility:'family',body:'Tablette kod açıldı. Telefonumda nereye yazmalıyım?',created_at:now},{sequence:2,author_role:'support',visibility:'family',body:'Diğer bölümünden Cihazlar’a girip altı haneli kodu yazabilirsin.',created_at:now},{sequence:3,author_role:'support',visibility:'internal',body:'Eşleştirme adımı kontrol edilecek.',created_at:now}],[id(11)]:[{sequence:4,author_role:'parent',visibility:'family',body:'Tamamlanan Prova sonucunu nereden görebilirim?',created_at:now}],[id(12)]:[{sequence:5,author_role:'parent',visibility:'family',body:'Birlikte kitap okuma hedefi ekleyebilir miyiz?',created_at:now}]};
 await page.route('https://ginaqa.supabase.co/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname,body=req.postData()?req.postDataJSON():{};let data=[],status=200;
 if(state.delay && path.includes('/rpc/') && !path.endsWith('/my_operation_roles'))await new Promise(resolve=>setTimeout(resolve,state.delay));
 if(path.endsWith('/__operator_fixture')){if(body.change){tickets[0].revision++;messages[tickets[0].id].push({sequence:++sequence,author_role:'parent',visibility:'family',body:'Yeni mesaj: kodun süresi dolmuş.',created_at:now});}Object.assign(state,body);data={...state,tickets,messages};}
 else if(path.endsWith('/my_operation_roles')){if(state.roleError){status=503;data={message:'role temporarily unavailable'};}else data=state.roles;}
 else if(path.includes('/rpc/')&&!state.roles.includes('support')){status=403;data={code:'42501',message:'forbidden'};}
 else if(path.includes('/rpc/')&&state.mode==='error'){status=503;data={message:'fixture unavailable'};}
 else if(path.endsWith('/list_operator_help_tickets')){state.filters.push(body);data=state.mode==='empty'?[]:tickets.filter(t=>t.kind===body.p_kind&&(!body.p_status||body.p_status==='all'||body.p_status===t.status||(body.p_status==='completed'&&['closed','resolved'].includes(t.status)))&&(!body.p_category||body.p_category===t.category));}
 else if(path.endsWith('/get_help_ticket')){const t=tickets.find(t=>t.id===body.p_ticket_id);data={...t,messages:messages[t.id]};}
 else if(path.endsWith('/reply_help_ticket')){state.calls.push(body);const t=tickets.find(t=>t.id===body.p_ticket_id);if(state.receipts[body.p_request_id])data=state.receipts[body.p_request_id];else if(t.revision!==body.p_revision){status=400;data={code:'P0001',message:'help_changed'};}else{t.revision++;t.status=body.p_status||t.status;messages[t.id].push({sequence:++sequence,author_role:'support',visibility:body.p_internal?'internal':'family',body:body.p_body,created_at:now});data={id:t.id,revision:t.revision,status:t.status};state.receipts[body.p_request_id]=data;}if(state.lose){state.lose=false;await route.abort();return;}}
 else if(path.endsWith('/auth/v1/user'))data={id:user};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user})=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{role:'none',admin:false}}))+'.synthetic';localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,email:'destek-ornek@gina.local',app_metadata:{},user_metadata:{},aud:'authenticated'}}));},{user});
 await page.setViewportSize({width,height});await page.goto('http://localhost:3102/support');await page.getByRole('heading',{name:'Destek merkezi',exact:true}).waitFor();
 return state;
};
