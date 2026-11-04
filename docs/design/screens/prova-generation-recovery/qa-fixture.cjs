module.exports=async function(page){
const uid='00000000-0000-4000-8000-000000003501',family='10000000-0000-4000-8000-000000003501',child='20000000-0000-4000-8000-000000003501',gid='60000000-0000-4000-8000-000000003501';
const q=(n,stem,subject='Matematik')=>({id:`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,family_id:family,grade:5,subject,topic:'Çevre',kind:'open_ended',difficulty:'orta',stem,expected_answer:'28 metre',solution:'2 × (8 + 6) = 28',explanation:'Dört kenarın uzunlukları toplanır.',choices:null,correct_key:null,source_urls:[],provenance:{},times_asked:0,created_at:'2026-11-03T07:00:00Z'});
const qs=[q(3501,'Dikdörtgenin çevresini nasıl bulursun?'),q(3502,'Güneş neden bir ışık kaynağıdır?','Fen'),q(3503,'Bahçenin çevresi kaç metredir?'),q(3504,'Bahçenin alanı kaç metrekaredir?')];
qs[1].kind='multiple_choice';qs[1].choices=[{key:'A',text:'Kendi ışığını üretir.'},{key:'B',text:'Ay’dan ışık alır.'},{key:'C',text:'Dünya’dan ışık alır.'},{key:'D',text:'Yalnız ışığı yansıtır.'}];qs[1].correct_key='A';
const group={id:gid,title:'Okul bahçesi',body:'Dikdörtgen okul bahçesinin uzun kenarı 8 metre, kısa kenarı 6 metredir.',grade:5,subject:'Matematik',version:1,series_id:gid,question_source_members:qs.slice(2).map((q,i)=>({question_id:q.id,position:i+1,prompt:q.stem}))};
const did='80000000-0000-4000-8000-000000003501';
const draft={id:did,version:1,content:{childId:child,grade:5,title:'Isı çalışması',purpose:'written',format:'school',subjects:['Fen'],topics:['Isı'],target:3,minutes:15,difficulty:'orta',kind:'open_ended',note:'',step:2,blocks:[]},exam_id:null,submitted_at:null};
const state={drafts:{[did]:draft},calls:[],saveFail:false,lose:true,providerCalls:0,jobs:{},cancelled:[],missing:false};
await page.route('https://ginaqa.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url()),body=req.postData()?req.postDataJSON():{};state.calls.push({path:url.pathname,method:req.method(),body});let data=[];let status=200;
const fail=(message)=>{status=409;return {message,code:'P0001'};};
if(url.pathname.endsWith('/__fixture')){if(body.saveFail!==undefined)state.saveFail=body.saveFail;data=state;}
else if(url.pathname.endsWith('/rpc/get_prova_drafts'))data=Object.values(state.drafts).filter(d=>!body.p_id||d.id===body.p_id);
else if(url.pathname.endsWith('/rpc/save_prova_draft')){const prev=state.drafts[body.p_id];if(state.saveFail)data=fail('prova_draft_changed');else if(prev&&prev.version!==body.p_version)data=fail('prova_draft_changed');else{data={id:body.p_id,version:(prev?.version??0)+1,content:body.p_content,exam_id:null,submitted_at:null};state.drafts[body.p_id]=data;}}
else if(url.pathname.endsWith('/rpc/submit_prova_draft')){state.drafts[body.p_id].submitted_at=new Date().toISOString();data=body.p_id;}
else if(url.pathname.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
else if(url.pathname.endsWith('/current_question_bank'))data=qs.map(q=>({subject:q.subject,topic:q.topic}));
else if(url.pathname.endsWith('/standalone_question_bank'))data=qs.slice(0,2);
else if(url.pathname.endsWith('/question_source_groups'))data=[group];
else if(url.pathname.endsWith('/question_bank')){const ids=url.searchParams.get('id')??'';data=qs.filter(q=>ids.includes(q.id));}
else if(url.pathname.endsWith('/rpc/get_question_group_policy'))data=true;
else if(url.pathname.endsWith('/rpc/get_prova_entitlement'))data={ai_generate_remaining:50,ai_generate_limit:100};
else if(url.pathname.endsWith('/functions/v1/prova-generate')){
 if(state.cancelled.includes(body.request_id)){status=409;data={error:'generation_cancelled'};}
 else if(body.recover_only){data=state.jobs[body.request_id];if(!data){status=409;data={error:'generation_not_started'};}}
 else if(state.missing){return route.abort('failed');}
 else{state.providerCalls++;data={ok:true,remaining:47,model:'QA',prompt_version:'qa-v1',questions:[q(3510,'Isı aktarımını bir örnekle açıkla.','Fen'),q(3511,'Sıcaklık ve ısı arasındaki farkı açıkla.','Fen'),q(3512,'Sıcak suya bırakılan metal kaşık neden ısınır?','Fen')]};data.questions.forEach((q,i)=>{q.topic='Isı';q.expected_answer=['Sıcak çorbadan daha soğuk olan kaşığa enerji aktarılması bir ısı aktarımı örneğidir.','Isı sıcaklık farkı nedeniyle aktarılan enerjidir. Sıcaklık, maddenin ne kadar sıcak veya soğuk olduğunu belirtir.','Sıcak sudan daha soğuk metal kaşığa ısı aktarılır.'][i];q.solution=q.expected_answer;q.explanation=null;});state.jobs[body.request_id]=data;for(const q of data.questions)if(!qs.some(v=>v.id===q.id))qs.push(q);if(state.lose){state.lose=false;return route.abort('failed');}}
}
else if(url.pathname.endsWith('/rpc/cancel_unstarted_generation')){if(state.jobs[body.p_id])data=fail('generation_cannot_cancel');else{state.cancelled.push(body.p_id);data={request_id:body.p_id,status:'cancelled'};}}
else if(url.pathname.endsWith('/auth/v1/user'))data={id:uid,email:'synthetic@example.invalid'};
await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
});
const token=(await page.evaluate(v=>btoa(JSON.stringify(v)),{alg:'none'}))+'.'+(await page.evaluate(v=>btoa(JSON.stringify(v)),{sub:uid,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';
await page.addInitScript(({token,uid})=>{localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-only',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:uid,email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},aud:'authenticated'}}));},{token,uid});
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8098/parent/prova/builder?draftId='+did);return state;
};
