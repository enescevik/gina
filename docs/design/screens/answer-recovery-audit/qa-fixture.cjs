// Synthetic only: no family data, real Supabase, AI or storage writes.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const [user,family,child,device,exam,attempt,q1,q2]=[9501,9502,9503,9504,9505,9506,9507,9508].map(id);
 const questions=[{id:q1,kind:'multiple_choice',stem:'6 + 8 + 10 işleminin sonucu kaçtır?',choices:[{key:'A',text:'24'},{key:'B',text:'26'}],correct_key:'A',expected_answer:null,solution:null},{id:q2,kind:'open_ended',stem:'Üçgenin çevresini nasıl bulduğunu anlat.',choices:null,correct_key:null,expected_answer:'Üç kenarın uzunlukları toplanır.',solution:'6 + 8 + 10 = 24 cm'}];
 const state={exam,attempt,q1,q2,answers:{},receipts:{},calls:[],errors:[],fail:false,loseReply:false,finished:false,reviewRevision:0,reviewFeedback:'',reviewReceipts:{}};
 page.on('pageerror',e=>state.errors.push(e.message));
 await page.routeWebSocket('wss://ginaqa.supabase.co/**',()=>{});
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop(),body=req.postData()?req.postDataJSON():{};
  state.calls.push({name,method:req.method(),body});let data=[],status=200;
  const row={id:attempt,exam_id:exam,child_id:child,family_id:family,status:state.finished?'completed':'in_progress',deadline_at:null,mc_total:1,mc_correct:1};
  if(name==='start_exam_attempt')data=row;
  else if(name==='get_attempt_questions')data=questions;
  else if(name==='get_saved_exam_answers_v3')data=Object.values(state.answers);
  else if(name==='submit_exam_answer_v3'){
   if(state.fail){status=503;data={message:'offline'};}
   else if(state.receipts[body.p_request_id])data=state.receipts[body.p_request_id];
   else if((state.answers[body.p_question_id]?.revision??0)!==body.p_expected_revision){status=409;data={message:'answer_changed',code:'P0001'};}
   else {data=body.p_expected_revision+1;state.receipts[body.p_request_id]=data;state.answers[body.p_question_id]={question_id:body.p_question_id,answer_key:body.p_answer_key??null,answer_text:body.p_answer_text??null,answer_document:body.p_answer_document??null,revision:data,is_correct:body.p_answer_key==='A',score:null};
    if(state.loseReply){state.loseReply=false;state.fail=true;return route.abort('connectionfailed');}
   }
  } else if(name==='finish_exam_attempt'){state.finished=true;data={...row,status:'completed'};}
  else if(name==='exam_attempts')data={...row,children:{name:'Ece'},exams:{question_ids:[q1,q2]}};
  else if(name==='question_bank')data=questions;
  else if(name==='exam_answers')data=Object.values(state.answers);
  else if(name==='get_answer_review')data={score:null,feedback:state.reviewFeedback,document:null,revision:state.reviewRevision,answer_hash:'synthetic-answer-hash'};
  else if(name==='get_review_ai_policy')data={enabled:false,remaining:0};
  else if(name==='save_answer_review'){
   if(state.reviewReceipts[body.p_request_id])data=state.reviewReceipts[body.p_request_id];
   else if(body.p_revision!==state.reviewRevision){status=409;data={message:'review_changed',code:'P0001'};}
   else{state.reviewRevision++;state.reviewFeedback=body.p_feedback;data=state.reviewReceipts[body.p_request_id]={revision:state.reviewRevision};}
  }
  else if(name==='get_child_answer_reviews')data=state.reviewRevision?[{question_id:q2,position:2,feedback:state.reviewFeedback,score:90,document:null,answer_document:null,answer_text:state.answers[q2]?.answer_text}]:[];
  else if(name==='devices')data={id:device,active_child_id:child,revoked_at:null};
  else if(name==='children')data={id:child,name:'Ece',grade:5,avatar:'avatar-reference-girl'};
  else if(name==='families')data={id:family,name:'Deneme ailesi',timezone:'Europe/Istanbul'};
  else if(name==='exams')data={id:exam,title:'Matematik',question_ids:[q1,q2],children:{name:'Ece'}};
  else if(name==='user')data={id:user};
  await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family,child,device})=>{
  Object.defineProperty(navigator,'language',{get:()=> 'tr-TR',configurable:true});Object.defineProperty(navigator,'languages',{get:()=> ['tr-TR'],configurable:true});
  const role=location.pathname.startsWith('/parent')?'parent':'device';
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role,child_id:role==='device'?child:null,device_id:role==='device'?device:null,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family,child,device});
 state.scope=`gina.answer-journal.v1:${user}:${family}:${child}:${attempt}:`;
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8098/child/prova/'+exam);return state;
};
