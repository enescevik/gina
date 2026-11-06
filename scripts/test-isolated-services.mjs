import {writeFileSync,unlinkSync} from 'node:fs';
// Invoked only by test-isolated-services.py with ephemeral, loopback-only services.
import http from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { testAiServices } from './isolated-ai-contract.mjs';
import { testC08 } from './isolated-c08-contract.mjs';
import { testSources } from './isolated-source-contract.mjs';
import { testBackoffice } from './isolated-backoffice-contract.mjs';
import { observeRealtime } from './isolated-realtime-contract.mjs';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const authPort = Number(process.env.GINA_QA_AUTH_PORT), restPort = Number(process.env.GINA_QA_REST_PORT);
const storagePort=Number(process.env.GINA_QA_STORAGE_PORT||0);
const realtimePort=Number(process.env.GINA_QA_REALTIME_PORT||0);
const clients=[], sockets=new Set();
let live;
let edge,edgePort=0,pdf;
if (![authPort, restPort].every(v => Number.isInteger(v) && v > 1024 && v < 65536) || !process.env.GINA_QA_SERVICE) throw Error('isolated_runner_required');
const checks = {};
const assert = (label, pass) => { checks[label] = !!pass; if (!pass) throw Error(label); };
const must = async (operation, label) => { const r = await operation; assert(label, !r.error); return r.data; };
const proxy = http.createServer((req, res) => {
  const routes=[['/auth/v1',authPort],['/rest/v1',restPort],['/storage/v1',storagePort],['/functions/v1',edgePort]];
  const route=routes.find(([prefix,port])=>port&&(req.url===prefix||req.url.startsWith(prefix+'/')));
  if (!route) {res.writeHead(404);res.end();return;}
  const [prefix,port]=route;
  const upstream = http.request({hostname:'127.0.0.1',port,path:req.url.slice(prefix.length)||'/',method:req.method,headers:req.headers}, r => {res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
});
await new Promise(resolve => proxy.listen(0,'127.0.0.1',resolve));
// Match the official gateway's /realtime/v1 -> /socket rewrite. Forward only
// this local test route; the service still validates the real user JWT and RLS.
proxy.on('upgrade',(req,socket,head)=>{
  if(!realtimePort||!req.url.startsWith('/realtime/v1/websocket?')){socket.destroy();return;}
  sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
  const upstream=http.request({hostname:'127.0.0.1',port:realtimePort,path:'/socket'+req.url.slice('/realtime/v1'.length),method:req.method,headers:{...req.headers,host:'realtime-dev.localhost'},agent:false});
  upstream.once('upgrade',(response,peer,initial)=>{
    sockets.add(peer);peer.once('close',()=>sockets.delete(peer));
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`+response.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+a[i]+': '+a[i+1]+'\r\n','')+'\r\n');
    if(initial.length)socket.write(initial);if(head.length)peer.write(head);
    socket.on('error',()=>peer.destroy());peer.on('error',()=>socket.destroy());
    socket.once('close',()=>peer.destroy());peer.once('close',()=>socket.destroy());
    socket.pipe(peer);peer.pipe(socket);
  });
  upstream.once('response',()=>socket.destroy());upstream.once('error',()=>socket.destroy());upstream.end();
});
const base = `http://127.0.0.1:${proxy.address().port}`;
const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client = () => {const c=createClient(base,process.env.GINA_QA_ANON,options);clients.push(c);return c;};
const admin = createClient(base,process.env.GINA_QA_SERVICE,options);
const rpc = (c,name,args) => must(c.rpc(name,args),name);
const claims = session => JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
const refresh = async c => (await must(c.auth.refreshSession(),'refresh_session')).session;
try {
  if(storagePort) {
    edge=spawn(process.env.GINA_QA_DENO_PATH||'deno',['run','--cached-only','--frozen','--config','supabase/functions/deno.json','--allow-net=127.0.0.1','--allow-env=GINA_QA_ISOLATED,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SOURCE_CLEANUP_SECRET,ANTHROPIC_API_KEY','scripts/isolated-source-edge.ts'],{stdio:['ignore','pipe','ignore'],env:{...process.env,GINA_QA_ISOLATED:'1',ANTHROPIC_API_KEY:'synthetic-local-only',SUPABASE_URL:base,SUPABASE_ANON_KEY:process.env.GINA_QA_ANON,SUPABASE_SERVICE_ROLE_KEY:process.env.GINA_QA_SERVICE,SOURCE_CLEANUP_SECRET:randomBytes(24).toString('hex')}});
    const ready=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('source_edge_start_timeout')),15000);
      const lines=createInterface({input:edge.stdout});
      const fail=()=>{clearTimeout(timer);lines.close();reject(Error('source_edge_start_failed'));};
      edge.once('error',fail);edge.once('exit',fail);
      lines.on('line',line=>{try {const value=JSON.parse(line);if(Number.isInteger(value.port)&&value.port>1024&&typeof value.pdf==='string'){clearTimeout(timer);lines.close();resolve(value);}}catch{}});
    });
    edgePort=ready.port;pdf=ready.pdf;
  }
  async function parent(name) {
    const c=client(),password=randomBytes(24).toString('base64url'),email=`gina-${randomUUID()}@example.invalid`;
    await must(admin.auth.admin.createUser({email,password,email_confirm:true}),'create_synthetic_auth_user');
    await must(c.auth.signInWithPassword({email,password}),'password_sign_in');
    const family=await rpc(c,'create_family',{p_name:name,p_display_name:'Synthetic parent'});
    const session=await refresh(c);
    assert('auth_hook_issues_parent_family',claims(session).gina.family_id===family&&claims(session).gina.role==='parent');
    return {c,family,email,password};
  }
  const a=await parent('Synthetic family A'),b=await parent('Synthetic family B');
  const setup={p_request_id:randomUUID(),p_profile:{name:'Synthetic child',birth_year:2015,grade:5,gender:'unspecified',avatar:'avatar-default',interests:[]},p_tasks:[]};
  const child=await rpc(a.c,'save_child_setup',setup);
  assert('child_setup_receipt_replay',child===await rpc(a.c,'save_child_setup',setup));
  const sibling=await rpc(a.c,'save_child_setup',{...setup,p_request_id:randomUUID(),p_profile:{...setup.p_profile,name:'Synthetic sibling'}});
  await rpc(a.c,'set_child_pin',{p_child_id:child,p_pin:'1234'});
  const device=client();await must(device.auth.signInAnonymously(),'anonymous_device_sign_in');
  const code=await rpc(device,'request_pairing',{p_device_name:'Synthetic tablet'});
  const deviceId=await rpc(a.c,'pair_child_device',{p_code:code});await refresh(device);
  assert('unconfigured_device_has_no_children',(await must(device.from('children').select('id'),'read_unconfigured_children')).length===0);
  await rpc(a.c,'configure_child_device',{p_device_id:deviceId,p_name:'Synthetic tablet',p_child_ids:[child],p_pin_required:true});
  await refresh(device);
  assert('device_sees_only_allowed_child',JSON.stringify((await must(device.from('children').select('id'),'read_allowed_children')).map(v=>v.id))===JSON.stringify([child]));
  assert('wrong_child_pin_denied',await rpc(device,'child_pin_login',{p_child_id:child,p_pin:'0000'})===false);
  assert('correct_child_pin_accepted',await rpc(device,'child_pin_login',{p_child_id:child,p_pin:'1234'})===true);
  const childSession=await refresh(device);
  assert('auth_hook_issues_active_child',claims(childSession).gina.child_id===child&&claims(childSession).gina.role==='device');
  const denied=await device.rpc('child_pin_login',{p_child_id:sibling,p_pin:'1234'});
  assert('unassigned_sibling_denied',!!denied.error);
  assert('foreign_family_children_hidden',(await must(b.c.from('children').select('id'),'read_foreign_children')).length===0);
  if(realtimePort) live=await observeRealtime({parent:a.c,other:b.c,child:device,assert});
  // Paid capabilities are explicit synthetic entitlements in the disposable DB only.
  await must(admin.from('entitlement_overrides').insert({family_id:a.family,plan:'pro',reason:'Isolated local service acceptance',ends_at:new Date(Date.now()+3600000).toISOString()}),'synthetic_entitlement');
  await must(admin.from('app_settings').update({value:true}).eq('key','question_groups.enabled'),'local_group_feature');
  const q= randomUUID();
  await must(a.c.from('question_bank').insert({id:q,family_id:a.family,grade:5,subject:'Fen',topic:'Işık',kind:'multiple_choice',difficulty:'orta',stem:'Hangisi kendi ışığını üretir?',choices:[{key:'A',text:'Güneş'},{key:'B',text:'Ay'}],correct_key:'A',solution:'Güneş kendi ışığını üretir.'}),'create_manual_choice_question');
  const groupId=randomUUID();
  await rpc(a.c,'save_question_source_group',{p_request_id:groupId,p_group:{title:'Okul bahçesi',body:'Dikdörtgen bahçenin kenarları 8 metre ve 6 metredir.',grade:5,subject:'Matematik'},p_questions:[{topic:'Çevre',kind:'open_ended',difficulty:'orta',stem:'Bahçenin çevresi kaç metredir?',expected_answer:'28',solution:'2 × (8 + 6)'},{topic:'Alan',kind:'open_ended',difficulty:'orta',stem:'Bahçenin alanı kaç metrekaredir?',expected_answer:'48',solution:'8 × 6'}],p_images:[]});
  const draftId=randomUUID(),content={childId:child,grade:5,title:'Synthetic mixed Prova',purpose:'written',format:'school',subjects:['Fen','Matematik'],topics:['Işık','Çevre'],target:3,minutes:null,difficulty:'orta',kind:'mixed',note:'',step:2,blocks:[{kind:'question',id:q,source:'manual'},{kind:'group',id:groupId,source:'manual'}]};
  const draftArgs={p_request_id:randomUUID(),p_id:draftId,p_version:0,p_content:content};
  const saved=await rpc(a.c,'save_prova_draft',draftArgs);
  assert('draft_replay_same_version',JSON.stringify(saved)===JSON.stringify(await rpc(a.c,'save_prova_draft',draftArgs)));
  const assignment={p_request_id:randomUUID(),p_id:draftId,p_version:1};
  await rpc(a.c,'submit_prova_draft',assignment);await rpc(a.c,'submit_prova_draft',assignment);
  if(live) await live.expect('child','exams',row=>row.id===draftId,'realtime_child_sees_assignment');
  const exam=await must(device.from('exams').select('id,question_ids').eq('id',draftId).single(),'child_reads_assignment');
  assert('mixed_exam_contains_whole_shared_group',exam.question_ids.length===3&&exam.question_ids[0]===q);
  const childQuestions=await rpc(device,'get_attempt_questions',{p_exam_id:draftId});
  assert('child_question_payload_has_no_answer_keys',!JSON.stringify(childQuestions).includes('correct_key')&&!JSON.stringify(childQuestions).includes('expected_answer'));
  const started=await rpc(device,'start_exam_attempt',{p_exam_id:draftId}),attempt=Array.isArray(started)?started[0].id:started.id;
  const doc={version:1,width:1000,height:1400,elements:[{id:randomUUID(),type:'stroke',color:'#201951',size:4,points:[[20,30],[80,90]]}]};
  const answer={p_request_id:randomUUID(),p_attempt_id:attempt,p_question_id:exam.question_ids[1],p_expected_revision:0,p_answer_text:'2 × (8 + 6) = 28 metre',p_answer_document:doc};
  const answerRevision=await rpc(device,'submit_exam_answer_v3',answer);
  assert('drawn_answer_first_revision',Number.isInteger(answerRevision)&&answerRevision>0);
  assert('drawn_answer_exact_replay',await rpc(device,'submit_exam_answer_v3',answer)===answerRevision);
  await rpc(device,'submit_exam_answer_v3',{p_request_id:randomUUID(),p_attempt_id:attempt,p_question_id:q,p_expected_revision:0,p_answer_key:'A'});
  await rpc(device,'submit_exam_answer_v3',{p_request_id:randomUUID(),p_attempt_id:attempt,p_question_id:exam.question_ids[2],p_expected_revision:0,p_answer_text:'48 metrekare'});
  await rpc(device,'finish_exam_attempt',{p_attempt_id:attempt});
  if(live) await live.expect('parent','exam_attempts',row=>row.id===attempt&&!!row.finished_at,'realtime_parent_sees_finished_attempt');
  const review=await rpc(a.c,'get_answer_review',{p_attempt_id:attempt,p_question_id:exam.question_ids[1]});
  const marking={p_request_id:randomUUID(),p_attempt_id:attempt,p_question_id:exam.question_ids[1],p_revision:0,p_answer_hash:review.answer_hash,p_score:90,p_feedback:'İşlemin doğru; birimini de belirttin.',p_document:{...doc,elements:[]}};
  const revision=await rpc(a.c,'save_answer_review',marking);
  assert('review_receipt_replay',revision===await rpc(a.c,'save_answer_review',marking));
  const stale=await a.c.rpc('save_answer_review',{...marking,p_request_id:randomUUID(),p_score:10});
  assert('stale_review_cannot_overwrite',stale.error?.message==='review_changed');
  const childRead=await rpc(device,'get_saved_exam_answers_v3',{p_attempt_id:attempt});
  assert('child_ink_preserved_after_review',isDeepStrictEqual(childRead.find(v=>v.question_id===exam.question_ids[1])?.answer_document,doc));
  const choiceReview=await rpc(a.c,'get_answer_review',{p_attempt_id:attempt,p_question_id:q});
  const choiceMarking={...marking,p_request_id:randomUUID(),p_question_id:q,p_revision:choiceReview.revision,p_answer_hash:choiceReview.answer_hash,p_score:0};
  const invalidScore=await a.c.rpc('save_answer_review',choiceMarking);
  assert('choice_answer_score_cannot_be_overridden',invalidScore.error?.message==='review_mc_score');
  const choiceBefore=await must(a.c.from('exam_answers').select('is_correct,score').eq('attempt_id',attempt).eq('question_id',q).single(),'choice_score_before_feedback');
  await rpc(a.c,'save_answer_review',{...choiceMarking,p_score:null,p_feedback:'Işık kaynağını doğru belirledin.'});
  const choiceAfter=await must(a.c.from('exam_answers').select('is_correct,score').eq('attempt_id',attempt).eq('question_id',q).single(),'choice_score_after_feedback');
  const feedback=await rpc(device,'get_child_answer_reviews',{p_attempt_id:attempt});
  assert('child_receives_parent_feedback',feedback.some(v=>v.question_id===exam.question_ids[1]&&v.score===90&&v.feedback===marking.p_feedback));
  assert('choice_feedback_preserves_automatic_score',choiceBefore.is_correct===true&&isDeepStrictEqual(choiceBefore,choiceAfter)&&feedback.some(v=>v.question_id===q&&v.feedback==='Işık kaynağını doğru belirledin.'));
  const other=await b.c.rpc('get_answer_review',{p_attempt_id:attempt,p_question_id:exam.question_ids[1]});
  assert('foreign_family_review_denied',!!other.error);
  const progress=await rpc(a.c,'learning_progress',{p_child_id:child,p_days:30,p_subject:null,p_grade:null});
  assert('progress_counts_reviewed_and_pending_separately',isDeepStrictEqual(progress.summary,{total:3,unique_questions:3,attempts:1,pending:1,correct:1,partial:1,wrong:0,blank:0,repeats:0}));
  assert('progress_preserves_subject_evidence',progress.topics.length===3&&progress.topics.every(t=>t.limited_observation&&t.evidence.length===1&&t.evidence[0].attempt_id===attempt));
  const task=randomUUID(),today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'});
  await must(a.c.from('task_templates').insert({id:task,family_id:a.family,child_id:child,title:'Synthetic reading',stars:2,starts_on:today}),'create_task');
  const completionArgs={p_template_id:task,p_due_date:today,p_client_id:randomUUID()};
  const completion=await rpc(device,'complete_task',completionArgs),completed=Array.isArray(completion)?completion[0]:completion;
  await rpc(a.c,'review_task',{p_completion_id:completed.id,p_approve:true});
  if(live) {
    await live.expect('child','task_completions',row=>row.id===completed.id&&row.status==='approved','realtime_child_sees_approval');
    await live.expect('child','star_events',row=>row.child_id===child&&row.delta===2,'realtime_child_sees_stars');
    live.assertForeignEmpty();
  }
  const retried=await rpc(device,'complete_task',completionArgs);
  assert('child_replay_sees_approved_task',(Array.isArray(retried)?retried[0]:retried).status==='approved');
  const duplicateApproval=await a.c.rpc('review_task',{p_completion_id:completed.id,p_approve:true});
  assert('duplicate_approval_rejected',duplicateApproval.error?.message==='already_reviewed');
  const ledger=await must(device.from('star_events').select('delta').eq('child_id',child),'child_reads_star_events');
  assert('duplicate_approval_awards_stars_once',ledger.reduce((n,r)=>n+r.delta,0)===2);
  if(live)live.mark();
  await rpc(a.c,'change_task_routine',{p_request_id:randomUUID(),p_id:task,p_revision:1,p_action:'pause'});
  const pausedForChild=await must(device.from('task_templates').select('id,active').eq('id',task),'child_reads_paused_recorded_routine');
  assert('child_paused_recorded_routine_stays_readable',pausedForChild.length===1&&!pausedForChild[0].active);
  if(live)await live.expect('child','task_routine_sync',row=>row.child_id===child,'realtime_child_receives_routine_pause_signal');
  const hiddenRoutine=randomUUID();await must(a.c.from('task_templates').insert({id:hiddenRoutine,family_id:a.family,child_id:child,title:'Hidden unused routine',active:false}),'create_unused_paused_routine');
  assert('child_cannot_read_unused_paused_routine',(await must(device.from('task_templates').select('id').eq('id',hiddenRoutine),'child_hidden_routine_read')).length===0);
  assert('foreign_family_cannot_read_routine_sync',(await must(b.c.from('task_routine_sync').select('*'),'foreign_routine_sync_read')).length===0);
  const sync=await must(device.from('task_routine_sync').select('*'),'child_routine_sync_read');assert('routine_sync_has_no_task_content',sync.length===1&&Object.keys(sync[0]).sort().join(',')==='child_id,family_id,revision');
  const childEdit=await device.rpc('change_task_routine',{p_request_id:randomUUID(),p_id:task,p_revision:2,p_action:'resume'});assert('real_child_device_cannot_change_routine',!!childEdit.error);
  await rpc(a.c,'change_task_routine',{p_request_id:randomUUID(),p_id:task,p_revision:2,p_action:'resume'});
  if(storagePort) await testSources({parent:a.c,other:b.c,child:device,childId:child,admin,base,pdf,must,assert});
  if(storagePort) await testAiServices({parent:a.c,other:b.c,child:device,childId:child,admin,base,must,assert});
  let c08Ui={};
  if(storagePort) c08Ui=await testC08({parent:a.c,child:device,childId:child,admin,base,must,assert,attempt,openQuestion:exam.question_ids[2]});
  await testBackoffice({admin,client,parent:a.c,other:b.c,child:device,must,assert});
  await rpc(a.c,'revoke_device',{p_device_id:deviceId});
  // Deliberately retain the old JWT: revocation must take effect before refresh.
  assert('revoked_device_old_token_cannot_read_children',(await must(device.from('children').select('id'),'revoked_device_read')).length===0);
  const revokedWrite=await device.rpc('complete_task',completionArgs);
  assert('revoked_device_old_token_cannot_replay_write',!!revokedWrite.error);
  if(live) {
    live.mark();
    const routine=(await must(a.c.from('task_templates').select('*').eq('id',task).single(),'read_task_after_revocation'));
    await rpc(a.c,'change_task_routine',{p_request_id:randomUUID(),p_id:task,p_revision:routine.revision,p_action:'save',p_value:{title:'Synthetic updated after revocation',icon:routine.icon,stars:routine.stars,days_of_week:routine.days_of_week,time_of_day:routine.time_of_day,requires_approval:routine.requires_approval}});
    await live.expect('parent','task_templates',row=>row.id===task&&row.title==='Synthetic updated after revocation','realtime_parent_still_receives_after_revoke');
    await live.assertRevokedSilent();
  }
  if(process.env.GINA_QA_UI_HOLD==='1') {
    const user=(await a.c.auth.getUser()).data.user.id;
    await must(admin.from('admins').upsert({user_id:user}),'ui_admin');
    await refresh(a.c);
    await rpc(a.c,'set_parent_pin',{p_pin:'5678'});
    await rpc(a.c,'set_child_pin',{p_child_id:child,p_pin:'1234'});
    // C04 UI: opt-in synthetic Pro override so the deterministic prova-generate path is reachable.
    if(process.env.GINA_QA_UI_PLAN==='pro') await must(admin.from('entitlement_overrides').insert({family_id:a.family,plan:'pro',reason:'synthetic ui qa',ends_at:new Date(Date.now()+86400000).toISOString()}),'ui_pro_override');
    const file=process.env.GINA_QA_UI_FIXTURE||'/tmp/gina-experience-ui-private.json';
    writeFileSync(file,JSON.stringify({pid:process.pid,url:base,anon:process.env.GINA_QA_ANON,email:a.email,password:a.password,userId:user,familyId:a.family,childId:child,examId:exam.id,attemptId:attempt,...c08Ui}),{mode:0o600});
    let timer, release;
    try {await new Promise(resolve=>{
      release=resolve; timer=setTimeout(resolve,2700000);
      // A completed UI run can release this disposable fixture without killing cleanup.
      process.once('SIGUSR2',release);
    });} finally {clearTimeout(timer);process.off('SIGUSR2',release);unlinkSync(file);}
  }

} catch(error) {
  const label=error instanceof Error && /^[a-z_]+$/.test(error.message)?error.message:'service_contract_failed';
  checks[label]=false;process.exitCode=1;
} finally {
  await Promise.all(clients.map(c=>c.removeAllChannels()));
  for(const socket of sockets)socket.destroy();
  if(edge && edge.exitCode===null) {
    edge.kill('SIGTERM');
    await new Promise(resolve=>{const timer=setTimeout(()=>{edge.kill('SIGKILL');resolve();},2000);edge.once('exit',()=>{clearTimeout(timer);resolve();});});
  }
  await new Promise(resolve=>proxy.close(resolve));
  console.log(JSON.stringify({checks}));
}
