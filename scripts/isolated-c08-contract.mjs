// C08 (S06/U09/Q02) — gerçek yerel Auth/REST/Storage/Edge/DB + deterministik sağlayıcı sınırı (ücretli AI yok).
// Kapsam: get_ai_usage tek okuması, 1/5/6 dosya, toplam bayt (yönetim değişikliği istemci=sunucu), bozuk belge,
// kota önizlemesi, 429/5xx/zaman aşımı/yanıt kaybı/bozuk JSON/çift istek → tek hak ve belirsizde ikinci ücretli
// çağrı yok, sağlayıcı devre kesicisi, AI puanı öneri → veli onayı kesin.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

export async function testC08({parent,child,childId,admin,base,must,assert,attempt,openQuestion}) {
  const stats=async()=>{const r=await fetch(base+'/functions/v1/__qa-provider-stats');return r.json();};
  const fault=async f=>{const r=await fetch(base+'/functions/v1/__qa-provider-fault',{method:'POST',body:JSON.stringify({fault:f})});assert('c08_fault_'+f+'_armed',r.ok);};
  const rpc=(client,name,args)=>must(client.rpc(name,args),name);
  const body=async res=>{try{return await res.error.context.json();}catch{return null;}};
  const session=(await parent.auth.getSession()).data.session;
  const familyId=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url')).gina.family_id;
  // Önceki kabul adımları paketi düşürdü; bu blok kendi sentetik Pro hakkıyla çalışır. Dakika sınırı testleri
  // birbirini etkilemesin diye yalnız bu tek kullanımlık DB'de deneme sayacı temizlenir (üretim sınırı değişmez).
  await must(admin.from('entitlement_overrides').insert({family_id:familyId,plan:'pro',reason:'c08 isolated',ends_at:new Date(Date.now()+3600000).toISOString()}),'c08_pro_override');
  const calm=()=>must(admin.from('ai_request_attempts').delete().eq('family_id',familyId),'c08_reset_minute_window');
  const healthReset=()=>must(admin.from('ai_provider_health').update({failures:0,open_until:null}).neq('provider',''),'c08_health_reset');

  // 1. Kullanım tek okuması --------------------------------------------------------------------------------
  const usage=await rpc(parent,'get_ai_usage',{});
  const feature=f=>usage.features.find(x=>x.feature===f);
  assert('c08_usage_daily_tips_not_offered',feature('daily_tips')?.offered===false&&feature('daily_tips')?.available===false);
  assert('c08_usage_pro_features_available',['weekly_summary','photo_calendar','document_analysis','open_ended_grading','study_plan'].every(f=>feature(f)?.available===true));
  assert('c08_usage_media_default_five',usage.media.max_files===5);
  const policy=await rpc(parent,'get_learning_source_policy',{});
  assert('c08_usage_and_picker_same_limits',policy.max_files===usage.media.max_files&&policy.max_total_bytes===usage.media.max_total_bytes);
  assert('c08_child_cannot_read_usage',!!(await child.rpc('get_ai_usage',{})).error);
  assert('c08_usage_hides_model_names',!/claude|anthropic|openai|gemini/i.test(JSON.stringify(usage)));

  // 2. Dosyalar: 1 / 5 / 6, toplam bayt, bozuk belge ---------------------------------------------------------
  const fixture=readFileSync(new URL('../supabase/functions/ai-preflight/fixture.ts',import.meta.url),'utf8').match(/"([A-Za-z0-9+/=]{100,})"/)[1];
  const png=Buffer.from(fixture,'base64');
  const upload=async(bytes,label)=>{
    // Kaynak ayırma dakikada 5 ile sınırlı (gerçek kural, değişmez); bu tek kullanımlık DB'de önceki kayıtlar
    // bir dakika geriye alınır ki 6+1 dosyalık senaryo beklemeden kurulabilsin.
    await must(admin.from('learning_sources').update({created_at:new Date(Date.now()-120000).toISOString()}).eq('family_id',familyId),'c08_source_window_'+label);
    const id=randomUUID();
    const reserved=await must(parent.functions.invoke('learning-source',{body:{action:'reserve',id,kind:'document',name:`c08-${label}.png`,mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),consent:true}}),'c08_reserve_'+label);
    await must(parent.storage.from(reserved.bucket).uploadToSignedUrl(reserved.path,reserved.token,bytes,{contentType:'image/png',cacheControl:'0'}),'c08_upload_'+label);
    return {id,finalized:await parent.functions.invoke('learning-source',{body:{action:'finalize',id}})};
  };
  const ids=[];
  for(let i=0;i<6;i++){const u=await upload(png,'f'+i);assert('c08_file_'+i+'_ready',!u.finalized.error);ids.push(u.id);}
  const corrupt=Buffer.from(png);corrupt.fill(0,8,64);
  const broken=await upload(corrupt,'corrupt');
  const brokenBody=broken.finalized.error?await body(broken.finalized):null;
  assert('c08_corrupt_document_rejected_with_contract',!!broken.finalized.error&&typeof brokenBody?.code==='string'&&brokenBody.error===brokenBody.code&&typeof brokenBody.category==='string');
  const one=await parent.rpc('register_learning_source_set',{p_ids:[ids[0]]});
  assert('c08_one_file_set_accepted',!one.error&&one.data===ids[0]);
  const five=await parent.rpc('register_learning_source_set',{p_ids:ids.slice(1,6)});
  assert('c08_five_file_set_accepted',!five.error&&five.data===ids[1]);
  const six=await parent.rpc('register_learning_source_set',{p_ids:[...ids.slice(1,6),broken.id]});
  assert('c08_six_files_rejected_source_file_limit',six.error?.message==='source_file_limit');
  // Yönetim dosya sayısını 3'e indirir: seçici ve sunucu aynı anda 3 görür.
  await must(admin.from('app_settings').update({value:3}).eq('key','sources.max_files'),'c08_admin_max_files_3');
  const p3=await rpc(parent,'get_learning_source_policy',{}),u3=await rpc(parent,'get_ai_usage',{});
  assert('c08_admin_change_client_and_server_same',p3.max_files===3&&u3.media.max_files===3);
  await must(admin.from('app_settings').update({value:5}).eq('key','sources.max_files'),'c08_admin_max_files_5');

  // 5 dosyalı set gerçek Edge ile tek analiz hakkı; ücret/kota önizlemesi düşüşü tam 1.
  await calm();await healthReset();
  const before=(await rpc(parent,'get_ai_usage',{})).operations.find(o=>o.action==='import');
  const s0=await stats();
  const setBody={child_id:childId,source_id:ids[1],locale:'tr',ai_consent:true,instructions:'C08 beş dosya.'};
  const fiveRun=await parent.functions.invoke('timetable-import',{body:setBody});
  assert('c08_five_file_analysis_succeeds',!fiveRun.error&&Array.isArray(fiveRun.data?.draft?.lessons));
  const after=(await rpc(parent,'get_ai_usage',{})).operations.find(o=>o.action==='import');
  assert('c08_quota_preview_decrements_once',after.used===before.used+1&&after.remaining===before.remaining-1);
  assert('c08_five_files_one_provider_call',(await stats()).messages===s0.messages+1);
  // Toplam bayt: yönetim pakette medya baytını tek dosyaya indirir → kullanım ekranı ve Edge aynı tavanı uygular.
  const narrow=png.length+1;
  // Politika satırı yalnız tam yöneticiye açık (RLS ai_policy_admin): sentetik veli geçici yönetici yapılır.
  const userId=(await parent.auth.getUser()).data.user.id;
  await must(admin.from('admins').upsert({user_id:userId}),'c08_temp_admin');
  await must(parent.auth.refreshSession(),'c08_admin_refresh');
  const setBytes=v=>must(parent.from('ai_operation_policies').update({max_media_bytes:v}).eq('action','import').eq('plan_code','pro').select('max_media_bytes'),'c08_admin_bytes_'+v);
  assert('c08_admin_narrow_bytes_saved',(await setBytes(narrow))[0]?.max_media_bytes===narrow);
  const uN=await rpc(parent,'get_ai_usage',{});
  assert('c08_usage_shows_narrowed_total_bytes',uN.media.max_total_bytes===narrow);
  await calm();
  const s1=await stats();
  const big=await parent.functions.invoke('timetable-import',{body:{...setBody,instructions:'C08 toplam bayt.'}});
  const bigBody=big.error?await body(big):null;
  assert('c08_total_bytes_rejected_before_provider',bigBody?.code==='source_size_or_type'&&bigBody.category==='validation'&&(await stats()).messages===s1.messages);
  await setBytes(20971520);
  await must(admin.from('admins').delete().eq('user_id',userId),'c08_temp_admin_removed');
  await must(parent.auth.refreshSession(),'c08_admin_refresh_back');

  // 3. Hata matrisi: gerçek Edge → deterministik sağlayıcı ---------------------------------------------------
  const single={child_id:childId,source_id:ids[0],locale:'tr',ai_consent:true};
  const cases=[['429','generation_failed','failed'],['503','ai_result_uncertain','uncertain'],['timeout','ai_result_uncertain','uncertain'],['lost','ai_result_uncertain','uncertain'],['badjson','ai_result_uncertain','uncertain']];
  for(const [f,code,status] of cases){
    await calm();await healthReset();
    const request={...single,instructions:'C08 hata '+f};
    await fault(f);
    const s=await stats();
    const res=await parent.functions.invoke('timetable-import',{body:request});
    const b=res.error?await body(res):null;
    assert('c08_'+f+'_contract_'+code,b?.code===code&&b.error===code&&b.retryable===false);
    assert('c08_'+f+'_single_paid_call',(await stats()).messages===s.messages+1);
    const jobs=await must(admin.from('ai_operation_jobs').select('status,provider').eq('family_id',familyId).eq('action','import').order('updated_at',{ascending:false}).limit(1),'c08_'+f+'_job');
    assert('c08_'+f+'_job_'+status+'_provider_recorded',jobs[0]?.status===status&&jobs[0]?.provider==='anthropic');
    if(status==='uncertain'){
      await calm();
      const replay=await parent.functions.invoke('timetable-import',{body:request});
      const rb=replay.error?await body(replay):null;
      assert('c08_'+f+'_replay_no_second_paid_call',rb?.code==='ai_result_uncertain'&&(await stats()).messages===s.messages+1);
    }
  }
  // Devre kesici: 3 belirsiz sonuç → sağlayıcı duraklar; sonraki istek sağlayıcıya gitmez, kullanım ekranı 'paused'.
  await healthReset();
  for(const f of ['503','timeout','lost']){await calm();await fault(f);await parent.functions.invoke('timetable-import',{body:{...single,instructions:'C08 kesici '+f}});}
  await calm();
  const sB=await stats();
  const paused=await parent.functions.invoke('timetable-import',{body:{...single,instructions:'C08 kesici sonrası'}});
  const pb=paused.error?await body(paused):null;
  assert('c08_breaker_opens_without_provider_call',pb?.code==='ai_temporarily_unavailable'&&pb.retryable===true&&(await stats()).messages===sB.messages);
  assert('c08_usage_reports_paused',(await rpc(parent,'get_ai_usage',{})).paused===true);
  await healthReset();
  // Çift istek (yarış): aynı girdi → tek ücretli iş, aynı sonuç ya da generation_in_progress.
  await calm();
  const sD=await stats();
  const twin={...single,instructions:'C08 çift istek'};
  const [x,y]=await Promise.all([parent.functions.invoke('timetable-import',{body:twin}),parent.functions.invoke('timetable-import',{body:twin})]);
  const codes=[x,y].map(r=>r.error?'error':'ok');
  const xb=x.error?await body(x):null,yb=y.error?await body(y):null;
  assert('c08_double_request_one_paid_call',(await stats()).messages===sD.messages+1);
  assert('c08_double_request_one_result_or_in_progress',codes.includes('ok')&&[xb,yb].every(b=>!b||b.code==='generation_in_progress'));

  // 4. AI puanı öneri → veli onayı kesin (gerçek prova-grade Edge) -----------------------------------------
  await calm();
  const gradeRes=await parent.functions.invoke('prova-grade',{body:{attempt_id:attempt}});
  if(gradeRes.error){const gb=await body(gradeRes);assert('c08_prova_grade_edge_'+String(gb?.code??'unknown'),false);}
  const graded=gradeRes.data;
  assert('c08_grade_response_not_final',graded.ok===true&&graded.final===false&&graded.suggested===1);
  const row=await must(admin.from('exam_answers').select('score,ai_score,graded_by').eq('attempt_id',attempt).eq('question_id',openQuestion).single(),'c08_answer_after_ai');
  assert('c08_ai_score_is_suggestion_only',row.score===null&&row.ai_score===70&&row.graded_by===null);
  const summary=await rpc(parent,'get_attempt_summary',{p_attempt_id:attempt});
  const item=summary.open_answers.find(a=>a.question_id===openQuestion);
  assert('c08_summary_marks_ai_suggestion',item.ai_suggested===true&&item.state==='pending'&&summary.review_state==='pending_review');
  const childView=await rpc(child,'get_attempt_summary',{p_attempt_id:attempt});
  assert('c08_child_summary_has_no_ai_suggestion',!('open_answers' in childView)&&!JSON.stringify(childView).includes('ai_score'));
  assert('c08_stale_suggestion_rejected',(await parent.rpc('accept_ai_grade',{p_attempt_id:attempt,p_question_id:openQuestion,p_expected:60})).error?.message==='ai_suggestion_changed');
  assert('c08_child_cannot_accept',!!(await child.rpc('accept_ai_grade',{p_attempt_id:attempt,p_question_id:openQuestion,p_expected:70})).error);
  const accepted=await rpc(parent,'accept_ai_grade',{p_attempt_id:attempt,p_question_id:openQuestion,p_expected:70});
  const again=await rpc(parent,'accept_ai_grade',{p_attempt_id:attempt,p_question_id:openQuestion,p_expected:70});
  const finalRow=await must(admin.from('exam_answers').select('score,graded_by,review_revision').eq('attempt_id',attempt).eq('question_id',openQuestion).single(),'c08_answer_after_parent');
  assert('c08_parent_confirmation_makes_final',finalRow.score===70&&finalRow.graded_by==='parent'&&accepted.status==='graded');
  assert('c08_double_confirmation_idempotent',again.status==='graded'&&finalRow.review_revision===1);
  await calm();
  await parent.functions.invoke('prova-grade',{body:{attempt_id:attempt}});
  const kept=await must(admin.from('exam_answers').select('score,graded_by').eq('attempt_id',attempt).eq('question_id',openQuestion).single(),'c08_answer_after_regrade');
  assert('c08_regrade_never_overwrites_parent',kept.score===70&&kept.graded_by==='parent');

  // 5. Arayüz kabulü için onay bekleyen ikinci bir AI önerisi (yalnız --ui-hold fixture'ında kullanılır).
  const uiQuestion=randomUUID(),uiExam=randomUUID();
  await must(admin.from('question_bank').insert({id:uiQuestion,family_id:familyId,grade:5,subject:'Fen',topic:'Işık',kind:'open_ended',difficulty:'orta',stem:'C08: Ay neden ışık kaynağı değildir?',expected_answer:'Güneşten aldığı ışığı yansıtır.'}),'c08_ui_question');
  await must(admin.from('exams').insert({id:uiExam,family_id:familyId,child_id:childId,title:'C08 AI önerisi',subject:'Fen',grade:5,question_ids:[uiQuestion],status:'assigned'}),'c08_ui_exam');
  const uiStarted=await rpc(child,'start_exam_attempt',{p_exam_id:uiExam}),uiAttempt=Array.isArray(uiStarted)?uiStarted[0].id:uiStarted.id;
  await rpc(child,'submit_exam_answer_v3',{p_request_id:randomUUID(),p_attempt_id:uiAttempt,p_question_id:uiQuestion,p_expected_revision:0,p_answer_text:'Işığı yansıtır.'});
  await rpc(child,'finish_exam_attempt',{p_attempt_id:uiAttempt});
  await calm();
  const uiGrade=await parent.functions.invoke('prova-grade',{body:{attempt_id:uiAttempt}});
  assert('c08_ui_suggestion_prepared',!uiGrade.error&&uiGrade.data?.suggested===1);
  // Arayüzde 'AI önerisi al' (prova-review) düğmesi görünür olsun; yerel Edge'de uç yok → 401 senaryosu yalnız istemci yolunu sınar.
  await must(admin.from('app_settings').upsert({key:'review_ai.enabled',value:true}),'c08_review_ai_enabled');
  return {c08AttemptId:uiAttempt,c08QuestionId:uiQuestion};
}
