// Synthetic browser fixture only. No real account or database writes.
module.exports=async p=>{
 const user='00000000-0000-4000-8000-000000007301',id='00000000-0000-4000-8000-000000007302';
 const state={access:true,fail:false,lose:false,media:0,suitable:20,fingerprint:'a'.repeat(64),publication:null,receipts:{},calls:[],writes:0};
 await p.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.origin==='http://localhost:3102')return route.continue();if(!u.hostname.endsWith('.supabase.co'))return route.abort();
 const path=u.pathname,b=route.request().postData()?route.request().postDataJSON():{};let data={},status=200;
 if(path==='/__publication_fixture'){Object.assign(state,b);data=state;}
 else if(path.endsWith('/my_operation_roles'))data=[];
 else if(!state.access&&path.includes('/rpc/')){status=403;data={code:'42501',message:'forbidden'};}
 else if(state.fail&&path.includes('/rpc/')){status=503;data={message:'unavailable'};}
 else if(path.endsWith('/admin_library_publication'))data={package_id:id,title:'Geometrik şekiller',grade:5,subject:'Matematik',revision:1,checks:{question_count:20,suitable_count:state.suitable,source_count:8,missing_media:state.media,review_fingerprint:state.fingerprint},publication:state.publication,review_current:state.publication?.review_fingerprint===state.fingerprint,delivery_enabled:false};
 else if(path.endsWith('/library-media')){state.media=0;data={package_id:id,validated:8,validator:'png-rgb-v1'};}
 else if(path.endsWith('/admin_set_library_publication')){
 state.calls.push(b);
 if(state.receipts[b.p_request_id])data=state.receipts[b.p_request_id];
 else if(b.p_expected_version!==(state.publication?.version??0)){status=400;data={code:'P0001',message:'library_publication_changed'};}
 else if(b.p_status==='published'&&b.p_review_fingerprint!==state.fingerprint){status=400;data={code:'P0001',message:'library_publication_review_changed'};}
 else{state.publication={package_id:id,version:b.p_expected_version+1,title:b.p_title,description:b.p_description.trim(),plans:b.p_plans,curriculum_label:b.p_curriculum_label,review_fingerprint:state.fingerprint,status:b.p_status,updated_at:'2026-11-03T14:00:00Z'};data=state.publication;state.receipts[b.p_request_id]=data;state.writes++;}
 if(state.lose){state.lose=false;return route.abort();}
 }else if(path.includes('/auth/v1/logout'))data={};else{status=400;data={message:'unexpected request'};}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await p.addInitScript(({user})=>{const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{admin:true,role:'none'}}))+'.synthetic';if(!localStorage.getItem('sb-ginaqa-auth-token'))localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:user,email:'yayin-ornek@gina.local',app_metadata:{},user_metadata:{},aud:'authenticated'}}));},{user});
 await p.setViewportSize({width:1440,height:1100});await p.goto('http://localhost:3102/library-publication?packageId='+id);await p.getByRole('heading',{name:'Geometrik şekiller',exact:true}).waitFor();return {state,id};
};
