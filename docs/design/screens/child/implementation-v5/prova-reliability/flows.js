// Fully intercepted fixture. No request reaches the user's Supabase database.
async page => {
 const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:390,height:844}});page=await context.newPage();
 const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/child/implementation-v5/prova-reliability';
 const id='11111111-1111-4111-8111-111111111111';
 const saved={q1:{question_id:'q1',answer_key:'B',answer_text:null},q2:{question_id:'q2',answer_key:null,answer_text:'Önceki açıklamam.'}};
 let failSave=false, failFinish=false, expired=false, finishCount=0;
 const errors=[],requests=[];
 await page.addInitScript(({id})=>{const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:id,device_id:id,role:'device',admin:false}}))+'.fixture-only';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,is_anonymous:true}}));},{id});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const req=route.request(),name=new URL(req.url()).pathname.split('/').pop();requests.push(name);let body=null,status=200;
  if(name==='start_exam_attempt')body={id:'attempt-1',status:'in_progress',deadline_at:expired?new Date(Date.now()-1000).toISOString():null};
  if(name==='get_attempt_questions')body=[{id:'q1',kind:'multiple_choice',stem:'12 kalemden 4 kalem verirsen kaç kalemin kalır?',choices:[{key:'A',text:'6'},{key:'B',text:'8'},{key:'C',text:'10'},{key:'D',text:'16'}]},{id:'q2',kind:'open_ended',stem:'Nasıl düşündüğünü anlat.',choices:null}];
  if(name==='get_saved_exam_answers')body=Object.values(saved);
  if(name==='submit_exam_answer'){const p=req.postDataJSON();if(failSave){status=500;body={message:'fixture_save_failed'};}else saved[p.p_question_id]={question_id:p.p_question_id,answer_key:p.p_answer_key??null,answer_text:p.p_answer_text??null};}
  if(name==='finish_exam_attempt'){finishCount++;if(failFinish){status=500;body={message:'fixture_finish_failed'};}else body={id:'attempt-1',status:'submitted',mc_total:1,mc_correct:0};}
  if(name==='families')body={timezone:'Europe/Istanbul'};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
 });
 await page.routeWebSocket('**/realtime/**',s=>s.close());
 const result={};
 await page.goto('http://localhost:8082/child/prova/exam-1',{waitUntil:'domcontentloaded'});
 await page.getByRole('radio',{name:'B, 8',exact:true}).waitFor();result.savedChoiceRestored=await page.getByRole('radio',{name:'B, 8',exact:true}).isChecked();
 await page.getByRole('radio',{name:'D, 16',exact:true}).click();
 await page.getByText('Cevapların kaydedildi.',{exact:true}).waitFor();result.autoSave=saved.q1.answer_key==='D';
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('radio',{name:'D, 16',exact:true}).waitFor();result.survivesReload=await page.getByRole('radio',{name:'D, 16',exact:true}).isChecked();
 await page.screenshot({path:dir+'/question-phone.png'});
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:dir+'/question-tablet.png'});
 await page.getByRole('button',{name:'Sonraki',exact:true}).click();
 const answer=page.getByRole('textbox',{name:'Cevabın',exact:true});await answer.waitFor();result.savedTextRestored=await answer.inputValue()==='Önceki açıklamam.';
 failSave=true;await answer.fill('Güncel açıklamam.');
 await page.getByText('Cevabın henüz kaydedilemedi. Yeniden deneyebilirsin.',{exact:true}).waitFor();
 await page.getByRole('button',{name:"Prova'ya dön",exact:true}).click();
 await page.getByText('Bu cevabın henüz kaydedilmedi.',{exact:true}).waitFor();result.unsavedNavigationBlocked=true;
 await page.screenshot({path:dir+'/save-error-tablet.png'});
 await page.getByRole('button',{name:'Burada kal',exact:true}).click();failSave=false;
 await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();
 await page.getByText('Cevapların kaydedildi.',{exact:true}).waitFor();result.retrySaved=saved.q2.answer_text==='Güncel açıklamam.';
 expired=true;failFinish=true;await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Yeniden dene',exact:true}).waitFor();await page.waitForTimeout(2300);result.timeUpFailsOnce=finishCount===1;
 failFinish=false;await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.getByText('Şıklı: 0 / 1 doğru',{exact:true}).waitFor();result.finishRetry=finishCount===2;
 await page.screenshot({path:dir+'/result-tablet.png'});
 await context.close();return {result,errors,allBackendTrafficMocked:true,interceptedRequests:requests.length};
}
