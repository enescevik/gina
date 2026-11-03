// Synthetic browser-only API. Never writes to Supabase or uses a real account.
module.exports=async page=>{
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [user,family,child,device,exam,attempt,qid]=[1,2,3,4,5,6,7].map(id);
const state={fail:true,answer:null,receipts:{},calls:[],conflict:false};
await page.route('https://ginaqa.supabase.co/**',async route=>{
 const r=route.request(),url=new URL(r.url()),body=r.postData()?r.postDataJSON():{};let data=[],status=200;
 if(url.pathname.endsWith('/__journal_fixture')){Object.assign(state,body);data=state;}
 else if(url.pathname.endsWith('/rpc/start_exam_attempt')) data={id:attempt,exam_id:exam,child_id:child,family_id:family,status:'in_progress',deadline_at:null};
 else if(url.pathname.endsWith('/rpc/get_attempt_questions')) data=[{id:qid,kind:'open_ended',stem:'Üçgenin çevresi nasıl bulunur? Çözümünü göster.',choices:null}];
 else if(url.pathname.endsWith('/rpc/get_saved_exam_answers_v3')) data=state.answer?[state.answer]:[];
 else if(url.pathname.endsWith('/rpc/submit_exam_answer_v3')){
  state.calls.push(body);
  if(state.conflict){status=409;data={message:'answer_changed',code:'P0001'};}
  else if(state.fail){status=503;data={message:'network unavailable'};}
  else if(state.receipts[body.p_request_id]) data=state.receipts[body.p_request_id];
  else {data=(state.answer?.revision??0)+1;state.receipts[body.p_request_id]=data;state.answer={question_id:qid,answer_key:body.p_answer_key??null,answer_text:body.p_answer_text??null,answer_document:body.p_answer_document??null,revision:data};}
 }
 else if(url.pathname.endsWith('/devices'))data={id:device,active_child_id:child,revoked_at:null};
 else if(url.pathname.endsWith('/exams'))data={title:'Matematik'};
 else if(url.pathname.endsWith('/children'))data={id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'};
 else if(url.pathname.endsWith('/auth/v1/user'))data={id:user};
 await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
});
await page.addInitScript(({user,family,child,device})=>{
 const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'device',child_id:child,device_id:device,admin:false}}))+'.synthetic';
 localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
},{user,family,child,device});
await page.setViewportSize({width:834,height:1194});
await page.goto('http://localhost:8096/child/prova/'+exam);
return {attempt,qid,scope:`gina.answer-journal.v1:${user}:${family}:${child}:${attempt}:`};
};
