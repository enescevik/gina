// Isolated, intercepted fixture browser: no request reaches the demo database.
async page => {
  const context=await page.context().browser().newContext({locale:'tr-TR',viewport:{width:390,height:844}});
  page=await context.newPage();
  const dir='/Users/enes/.codex/worktrees/gina-avatars/gina/docs/design/screens/parent-prova/implementation-v5';
  const id='11111111-1111-4111-8111-111111111111', can='22222222-2222-4222-8222-222222222222';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
  const children=[{id,name:'Ece',avatar:'avatar-reference-girl',grade:2},{id:can,name:'Can',avatar:'avatar-reference-boy',grade:5}];
  const tasks=['Dişlerini fırçala','20 dakika kitap oku','Odanı düzenle'].map((title,i)=>({id:'task-'+i,child_id:id,title,icon:['brush-teeth','read-book','tidy-room'][i],stars:i+1,days_of_week:[1,2,3,4,5,6,7],starts_on:'2026-01-01',ends_on:null,active:true,sort_order:i}));
  const questions=Array.from({length:5},(_,i)=>({id:'question-'+i,subject:'Fen Bilimleri',grade:5,topic:'Isı ve Sıcaklık',kind:i===4?'open_ended':'multiple_choice',difficulty:'orta',stem:i===4?'Isı ve sıcaklık arasındaki farkı açıkla.':'Sıcaklığı ölçmek için hangi araç kullanılır?',choices:i===4?null:[{key:'A',text:'Termometre'},{key:'B',text:'Cetvel'},{key:'C',text:'Terazi'},{key:'D',text:'Kronometre'}],correct_key:i===4?null:'A',expected_answer:'Isı bir enerji aktarımıdır; sıcaklık bir ölçüdür.',solution:'Sıcaklığı termometre ölçer.'}));
  const exam={id:'exam-1',title:'Fen · Kendimi deniyorum',subject:'Fen Bilimleri',grade:5,kind:'practice',status:'assigned',timed:true,duration_minutes:15,question_ids:questions.map(q=>q.id),children:children[1],exam_attempts:[{id:'attempt-1',status:'graded',mc_total:4,mc_correct:3,finished_at:today+'T10:00:00Z'}]};
  const plan={id:'plan-1',subject:'Fen Bilimleri',grade:5,status:'draft',weak_topics:[{topic:'Isı ve Sıcaklık',pct:60}],plan:{ozet:'Küçük tekrarlarla bilgilerini güçlendirelim.',gunler:[{gun:1,konu:'Isı ve Sıcaklık',etkinlik:'Günlük hayattan üç örnek bul.',sure_dk:15},{gun:2,konu:'Sıcaklık ölçümü',etkinlik:'Termometreyi birlikte inceleyin.',sure_dk:10}],gorev_onerileri:['Birlikte bir deney yapın.']},created_at:today+'T10:00:00Z',children:children[1]};
  const fixtures={children,families:{id,name:'Çevik Ailesi',timezone:'Europe/Istanbul'},
    exam_blueprints:[{id:'blueprint-1',name:'Senaryo 1',subject:'Fen Bilimleri',grade:5,rows:[{topic:'Isı ve Sıcaklık',count:5}]}],
    question_bank:questions,exams:[exam],exam_attempts:{id:'attempt-1',status:'submitted',mc_total:4,mc_correct:3,open_total:1,open_graded:0,score_pct:75,ai_feedback:null,finished_at:today+'T10:00:00Z',children:children[1],exams:exam},
    exam_answers:questions.map((q,i)=>({question_id:q.id,answer_key:i===4?null:'A',answer_text:i===4?'Isı enerji aktarımıdır.':null,is_correct:i===4?null:true,score:i===4?null:100,feedback:null,graded_by:null,ai_score:null,ai_details:null})),
    get_prova_entitlement:{plan:'pro',ai_generate_limit:100,ai_generate_used:3,ai_grade:true,ai_plan:true},study_plans:[plan],pick_level_questions:questions,
    child_topic_mastery:[{subject:'Fen Bilimleri',grade:5,topic:'Isı ve Sıcaklık',total:5,correct:3,pending:1,accuracy:60,score:60,level_total:1,last_at:today+'T10:00:00Z'}],
  };
  await page.addInitScript(({id})=>{const exp=Math.floor(Date.now()/1000)+86400;const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:id,exp,role:'authenticated',gina:{family_id:id,child_id:null,device_id:null,role:'parent',admin:false}}))+'.fixture-only';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:exp,expires_in:86400,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',is_anonymous:false}}));},{id});
  let releaseSave; const saveGate=new Promise(resolve=>releaseSave=resolve);
  const requests=[],errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();requests.push({path:url.pathname,method:req.method()});if(req.method()==="POST"){writes.push({name,body:req.postDataJSON()});await saveGate;} let body=fixtures[name]??[];
    if(name==='study_plans' && url.searchParams.has('id'))body=plan;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'content-range':'0-4/5','access-control-expose-headers':'content-range'}});
  });
  await page.routeWebSocket('**/realtime/**',s=>s.close());
  const result={};
  await page.goto('http://localhost:8082/parent/prova/question',{waitUntil:'domcontentloaded'});
  await page.getByRole('textbox',{name:'Ders',exact:true}).fill('Fen Bilimleri');
  await page.getByRole('textbox',{name:'Konu',exact:true}).fill('Isı ve Sıcaklık');
  await page.getByRole('textbox',{name:'Soru',exact:true}).fill('Sıcaklığı ne ölçer?');
  await page.getByRole('textbox',{name:'Sınıf',exact:true}).fill('0');
  for(const key of ['A','B','C','D']) await page.getByRole('textbox',{name:key+' seçeneği',exact:true}).fill(key==='B'?'Termometre':'Diğer seçenek '+key);
  await page.getByRole('button',{name:'B seçeneğini doğru cevap yap',exact:true}).click();
  await page.getByRole('button',{name:'Kaydet ve yeni soru',exact:true}).click();
  await page.getByRole('alert').waitFor();result.invalidGradeBlocked=writes.length===0;
  await page.getByRole('textbox',{name:'Sınıf',exact:true}).fill('5');
  await page.getByRole('button',{name:'Kaydet ve yeni soru',exact:true}).click();
  await page.waitForTimeout(100);
  result.otherSaveDisabled=await page.getByRole('button',{name:'Kaydet',exact:true}).isDisabled();
  result.oneWrite=writes.length===1;result.correctAnswer=writes[0]?.body.correct_key==='B';releaseSave();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('textarea')).some(x=>x.value===''));
  await context.close();return {result,errors,allBackendTrafficMocked:true};
}
