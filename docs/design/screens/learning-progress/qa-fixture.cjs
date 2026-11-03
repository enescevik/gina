// Synthetic API for real application component QA. No live family data or writes.
module.exports=async page=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const user=id(1),family=id(2),child=id(3),attempt=id(6);
 const state={mode:'ready',delay:0,calls:[]};
 const today=new Date();today.setUTCHours(12,0,0,0);
 const day=n=>{const d=new Date(today);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
 const samples=Array.from({length:27},(_,i)=>({attempt_id:i>=24?id(8):attempt,question_id:id(100+i%24),grade:5,subject:'Matematik',topic:i<16?'Kesirleri karşılaştırma':'Geometrik şekiller',curriculum:null,
  state:['correct','partial','wrong','blank','pending','correct','correct'][i%7],finished_at:day(i)+'T12:00:00Z'}));
 samples.push({attempt_id:id(9),question_id:id(190),grade:6,subject:'Fen',topic:'Kuvvet',curriculum:null,state:'correct',finished_at:day(15)+'T12:00:00Z'});
 const counts=rows=>Object.fromEntries(['correct','partial','wrong','blank','pending'].map(s=>[s,rows.filter(r=>r.state===s).length]));
 function report(body){
  const from=day((body.p_days??30)-1),through=day(0);
  const rows=state.mode==='empty'?[]:samples.filter(r=>r.finished_at.slice(0,10)>=from&&(!body.p_grade||r.grade===body.p_grade)&&(!body.p_subject||r.subject===body.p_subject));
  const unique=new Set(rows.map(r=>r.question_id)).size;
  const summary={...counts(rows),total:rows.length,unique_questions:unique,repeats:rows.length-unique,attempts:new Set(rows.map(r=>r.attempt_id)).size};
  const topics=[];
  for(const key of [...new Set(rows.map(r=>JSON.stringify([r.grade,r.subject,r.topic,r.curriculum])))]){
   const [grade,subject,topic,curriculum]=JSON.parse(key),list=rows.filter(r=>JSON.stringify([r.grade,r.subject,r.topic,r.curriculum])===key);
   const c=counts(list);topics.push({grade,subject,topic,curriculum,...c,total:list.length,unique_questions:new Set(list.map(r=>r.question_id)).size,last_at:list[0].finished_at,limited_observation:list.length-c.pending<5,
    evidence:[...list].sort((a,b)=>['pending','wrong','partial','blank','correct'].indexOf(a.state)-['pending','wrong','partial','blank','correct'].indexOf(b.state)).slice(0,5).map(({attempt_id,question_id,state,finished_at})=>({attempt_id,question_id,state,finished_at}))});
  }
  const weeks=[],start=new Date(from+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  for(let d=new Date(start);d<=today;d.setUTCDate(d.getUTCDate()+7)){
   const week_start=d.toISOString().slice(0,10),end=new Date(d);end.setUTCDate(end.getUTCDate()+7);
   const list=rows.filter(r=>r.finished_at.slice(0,10)>=week_start&&r.finished_at.slice(0,10)<end.toISOString().slice(0,10));weeks.push({week_start,total:list.length,...counts(list)});
  }
  return {version:1,from,through,timezone:'Europe/Istanbul',summary,weeks,topics};
 }
 await page.route('https://ginaqa.supabase.co/**',async route=>{
  const r=route.request(),url=new URL(r.url()),body=r.postData()?r.postDataJSON():{};let data=[],status=200;
  if(url.pathname.endsWith('/__progress_fixture')){Object.assign(state,body);data=state;}
  else if(url.pathname.endsWith('/rpc/learning_progress')){
   state.calls.push(body);if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
   if(state.mode==='error'){status=503;data={message:'fixture unavailable'};}else data=report(body);
  }
  else if(url.pathname.endsWith('/children'))data=[{id:child,name:'Emre',grade:5,avatar:'avatar-boy-01'}];
  else if(url.pathname.endsWith('/exam_attempts'))data={id:attempt,status:'submitted',children:{name:'Emre'},exams:{question_ids:samples.filter(r=>r.attempt_id===attempt).map(r=>r.question_id)}};
  else if(url.pathname.endsWith('/question_bank'))data=samples.filter(r=>r.attempt_id===attempt).map((r,i)=>({id:r.question_id,stem:`Örnek soru ${i+1}: Üçgenin çevresini nasıl buluruz?`,kind:'open_ended',choices:null,correct_key:null,expected_answer:'24 cm',solution:'Kenarları toplarız.'}));
  else if(url.pathname.endsWith('/exam_answers'))data=samples.filter(r=>r.attempt_id===attempt).map(r=>({question_id:r.question_id,answer_document:null,answer_text:'6 + 8 + 10 = 24 cm',answer_key:null,is_correct:null,score:null}));
  else if(url.pathname.endsWith('/rpc/get_answer_review'))data={revision:0,answer_hash:'fixture-hash',document:null,feedback:null,score:null,ai:null};
  else if(url.pathname.endsWith('/rpc/get_review_ai_policy'))data={enabled:false,remaining:0};
  else if(url.pathname.endsWith('/auth/v1/user'))data={id:user};
  await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,family})=>{
  const token=btoa('{"alg":"none"}')+'.'+btoa(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+86400,gina:{family_id:family,role:'parent',device_id:null,child_id:null,admin:false}}))+'.synthetic';
  localStorage.setItem('sb-ginaqa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:{id:user,app_metadata:{},user_metadata:{},aud:'authenticated'}}));
 },{user,family});
 await page.setViewportSize({width:1280,height:800});
 page.once('dialog',dialog=>dialog.accept());
 await page.goto('http://localhost:8096/parent/prova/progress');
 await page.getByText('Çalışmaların görünümü',{exact:true}).waitFor();
 return {child,attempt};
};
