// Opt-in hosted acceptance. At most four new paid operations; no automatic retry.
// The caller owns a fresh synthetic family and deletes it in finally.
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

export async function checkHostedFeatures({parent,admin,familyId,childId,sourceIds,sourcePaths,must,check,report}) {
  const rpc=async(name,args)=>must(await parent.rpc(name,args),name);
  const invoke=async(name,body)=>must(await parent.functions.invoke(name,{body}),name);
  const initial=await rpc('get_family_weekly_review',{});
  const summary=await invoke('ai-weekly-summary',{week_start:initial.week_start});
  const repeated=await invoke('ai-weekly-summary',{week_start:initial.week_start});
  const read=await rpc('get_family_weekly_review',{p_week:initial.week_start});
  check('live_weekly_replay_and_reopen',summary.ok===true&&isDeepStrictEqual(summary,repeated)&&read.state==='ready'&&isDeepStrictEqual(summary.summary,read.summary));
  check('live_weekly_single_quota',read.remaining===initial.remaining-1);
  check('live_weekly_no_unsupported_difficulty',summary.summary.cocuk_basina.length===1&&summary.summary.cocuk_basina[0].zorlananlar.length===0);

  const fixtures=readFileSync(new URL('../supabase/functions/ai-preflight/feature-fixture.ts',import.meta.url),'utf8');
  async function upload(name) {
    const matched=fixtures.match(new RegExp('export const '+name+'\\s*=\\s*"([A-Za-z0-9+/=]+)"'));
    if(!matched)throw Error('feature_fixture_missing');
    const bytes=Buffer.from(matched[1],'base64'),id=randomUUID();sourceIds.push(id);
    const reserved=await invoke('learning-source',{action:'reserve',id,kind:'document',name:'synthetic-feature.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),consent:true});
    sourcePaths.push(reserved.path);
    must(await parent.storage.from(reserved.bucket).uploadToSignedUrl(reserved.path,reserved.token,bytes,{contentType:'image/png',cacheControl:'0'}),'feature_source_upload');
    const ready=await invoke('learning-source',{action:'finalize',id});
    check(name.toLowerCase()+'_verified',ready.ready===true);return id;
  }
  const learningSource=await upload('LEARNING_PNG');
  const learningBody={child_id:childId,source_id:learningSource,locale:'tr',ai_consent:true};
  const draft=await invoke('learning-plan-import',learningBody);
  const replay=await invoke('learning-plan-import',learningBody);
  const reopened=await rpc('get_learning_plan_import',{p_child_id:childId,p_source_id:learningSource,p_locale:'tr'});
  check('live_plan_import_replay_and_reopen',draft.id===replay.id&&draft.id===reopened.id&&isDeepStrictEqual(draft.draft,reopened.draft));
  const homework=draft.draft.items.find(i=>i.kind==='homework');
  const course=draft.draft.items.find(i=>i.kind==='course');
  check('live_plan_document_dates',draft.draft.items.length===2&&homework?.due_on===null&&course?.due_on==='2026-11-12'&&course?.time==='16:30');
  const items=draft.draft.items.map((item,index)=>({index,id:randomUUID(),content:{
    kind:item.kind,title:item.title,subject:item.subject,topic:item.topic,planned_on:'2026-11-04',due_on:item.due_on??'2026-11-06',time:item.time,
    steps:item.steps.map(label=>({id:randomUUID(),label,checked:false})),done:false,archived:false,source_id:learningSource,
  }}));
  const args={p_request_id:randomUUID(),p_child_id:childId,p_import_id:draft.id,p_items:items};
  const saved=await rpc('apply_learning_plan_import',args);
  check('live_plan_apply_receipt',isDeepStrictEqual(saved,await rpc('apply_learning_plan_import',args)));
  const plan=await rpc('get_learning_plan',{p_child_id:childId,p_from:'2026-11-01',p_to:'2026-11-30'});
  check('live_plan_two_items_and_private_source',plan.items.length===2&&items.every(i=>plan.items.some(r=>r.id===i.id&&isDeepStrictEqual(r.content,i.content)&&r.source?.id===learningSource)));

  const setupSource=await upload('SETUP_PNG');
  for(const kind of ['task','reward']) {
    // Respect the existing family cooldown without altering timestamps or policy.
    if(kind==='reward')await new Promise(resolve=>setTimeout(resolve,21000));
    const input={request_id:randomUUID(),kind,grade:5,age_band:'10-13',interests:['reading','nature'],locale:'tr',source_id:setupSource,source_ai_consent:true};
    const result=await invoke('setup-suggestions',input);
    check('live_'+kind+'_paid_result_reused',isDeepStrictEqual(result,await invoke('setup-suggestions',input)));
    check('live_'+kind+'_verified_source',result.suggestions.length>=1&&result.suggestions.length<=3&&result.suggestions.every(i=>i.source_id===setupSource));
    const selected=result.suggestions.map(i=>({title:i.title,stars:i.stars,icon:i.icon,source_id:i.source_id,...(kind==='task'?{days:[1,3,5]}:{})}));
    const save={p_request_id:randomUUID(),p_kind:kind,p_items:selected,p_child_id:kind==='task'?childId:null};
    const ids=await rpc('save_setup_batch',save);
    check('live_'+kind+'_multi_select_single_receipt',ids.length===selected.length&&isDeepStrictEqual(ids,await rpc('save_setup_batch',save)));
    const sources=await rpc('get_setup_sources',{p_kind:kind,p_ids:ids});
    check('live_'+kind+'_saved_source_links',sources.length===ids.length&&sources.every(s=>s.source_id===setupSource));
  }
  const jobs=must(await admin.from('ai_operation_jobs').select('action,status,result').eq('family_id',familyId),'feature_usage');
  check('live_ai_operations_completed_once',jobs.length===3&&jobs.every(j=>j.status==='done')&&jobs.filter(j=>j.action==='weekly').length===1&&jobs.filter(j=>j.action==='import').length===2);
  const setups=must(await admin.from('setup_ai_jobs').select('id,status').eq('family_id',familyId),'feature_setup_usage');
  check('live_setup_operations_completed_once',setups.length===2&&setups.every(j=>j.status==='done'));
  report.featureUsage={operations:jobs.map(j=>({action:j.action,inputTokens:j.result?.inputTokens??null,outputTokens:j.result?.outputTokens??null})),setupOperations:setups.length};
}
