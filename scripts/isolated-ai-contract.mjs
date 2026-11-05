// Real local Auth/REST/Storage/Edge/DB; deterministic provider boundary, no paid AI.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

export async function testAiServices({parent,other,child,childId,admin,base,must,assert}) {
  const invoke=(client,name,body)=>client.functions.invoke(name,{body});
  const rpc=(client,name,args)=>must(client.rpc(name,args),name);
  const stats=async()=>{const r=await fetch(base+'/functions/v1/__qa-provider-stats');assert('local_ai_stats_available',r.ok);return r.json();};
  const before=await rpc(parent,'get_family_weekly_review',{});
  const week=before.week_start;
  assert('weekly_initial_state_empty',before.state==='empty');
  assert('child_cannot_request_weekly_ai',!!(await invoke(child,'ai-weekly-summary',{week_start:week})).error);
  const summary=await must(invoke(parent,'ai-weekly-summary',{week_start:week}),'weekly_edge_generation');
  assert('weekly_edge_returns_valid_summary',summary.ok===true&&summary.summary.cocuk_basina.length===2);
  const replay=await must(invoke(parent,'ai-weekly-summary',{week_start:week}),'weekly_edge_replay');
  assert('weekly_replay_identical',isDeepStrictEqual(summary,replay));
  const reopened=await rpc(parent,'get_family_weekly_review',{p_week:week});
  assert('weekly_reopened_from_database',reopened.state==='ready'&&isDeepStrictEqual(reopened.summary,summary.summary));
  assert('weekly_quota_consumed_once',reopened.remaining===before.remaining-1);
  const foreign=await rpc(other,'get_family_weekly_review',{p_week:week});
  assert('weekly_other_family_has_no_summary',foreign.summary===null&&foreign.state==='empty');
  assert('weekly_single_provider_generation',(await stats()).weekly===1);

  const fixture=readFileSync(new URL('../supabase/functions/ai-preflight/fixture.ts',import.meta.url),'utf8').match(/"([A-Za-z0-9+/=]{100,})"/)[1];
  const bytes=Buffer.from(fixture,'base64'),sourceId=randomUUID();
  const source=await must(invoke(parent,'learning-source',{action:'reserve',id:sourceId,kind:'document',name:'synthetic-ai-pipeline.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),consent:true}),'ai_pipeline_source_reserve');
  await must(parent.storage.from(source.bucket).uploadToSignedUrl(source.path,source.token,bytes,{contentType:'image/png',cacheControl:'0'}),'ai_pipeline_source_upload');
  await must(invoke(parent,'learning-source',{action:'finalize',id:sourceId}),'ai_pipeline_source_finalize');
  const body={child_id:childId,source_id:sourceId,locale:'tr',ai_consent:true};
  assert('learning_import_requires_consent',!!(await invoke(parent,'learning-plan-import',{...body,ai_consent:false})).error);
  assert('learning_import_child_denied',!!(await invoke(child,'learning-plan-import',body)).error);
  assert('learning_import_foreign_denied',!!(await invoke(other,'learning-plan-import',body)).error);
  const draft=await must(invoke(parent,'learning-plan-import',body),'learning_import_edge_generation');
  assert('learning_import_missing_date_stays_null',draft.status==='done'&&draft.draft.items[0].due_on===null);
  const repeat=await must(invoke(parent,'learning-plan-import',body),'learning_import_edge_replay');
  assert('learning_import_replay_same_draft',isDeepStrictEqual(draft,repeat));
  const readArgs={p_child_id:childId,p_source_id:sourceId,p_locale:'tr'};
  const read=await rpc(parent,'get_learning_plan_import',readArgs);
  assert('learning_import_reopen_same_result',read.id===draft.id&&isDeepStrictEqual(read.draft,draft.draft));
  assert('learning_import_single_provider_generation',(await stats()).learning===1);
  const range={p_child_id:childId,p_from:'2026-11-01',p_to:'2026-11-30'};
  assert('ai_draft_does_not_assign_automatically',(await rpc(parent,'get_learning_plan',range)).items.length===0);
  const items=draft.draft.items.map((item,index)=>({index,id:randomUUID(),content:{
    kind:item.kind,title:item.title,subject:item.subject,topic:item.topic,planned_on:'2026-11-04',due_on:item.due_on??'2026-11-06',time:item.time,
    steps:item.steps.map(label=>({id:randomUUID(),label,checked:false})),done:false,archived:false,source_id:sourceId,
  }}));
  const apply={p_request_id:randomUUID(),p_child_id:childId,p_import_id:draft.id,p_items:items};
  const applied=await rpc(parent,'apply_learning_plan_import',apply);
  assert('learning_import_apply_replay_same_ids',isDeepStrictEqual(applied,await rpc(parent,'apply_learning_plan_import',apply)));
  const saved=await rpc(parent,'get_learning_plan',range);
  assert('learning_import_two_selected_items_saved_once',saved.items.length===2&&items.every(i=>saved.items.some(r=>r.id===i.id&&isDeepStrictEqual(r.content,i.content))));
  assert('learning_import_cannot_reapply_selection',!!(await parent.rpc('apply_learning_plan_import',{...apply,p_request_id:randomUUID()})).error);
  const childPlan=await rpc(child,'get_learning_plan',range);
  assert('child_sees_parent_approved_plan',childPlan.items.length===2&&childPlan.items.every(i=>i.source===null));

  for(const kind of ['task','reward']) {
    const request={request_id:randomUUID(),kind,grade:5,age_band:'10-13',interests:['reading','nature'],locale:'tr',source_id:sourceId,source_ai_consent:true};
    assert(kind+'_source_ai_consent_required',!!(await invoke(parent,'setup-suggestions',{...request,source_ai_consent:false})).error);
    if(kind==='reward'){
      const throttled=await invoke(parent,'setup-suggestions',request);
      let code;try{code=(await throttled.error?.context.json())?.error;}catch{}
      assert('setup_cooldown_blocks_second_generation',code==='generation_in_progress');
      assert('setup_cooldown_does_not_call_provider',(await stats()).generations===3);
      await new Promise(resolve=>setTimeout(resolve,21000));
    }
    const generated=await invoke(parent,'setup-suggestions',request);
    if(generated.error){let code='unknown';try{code=(await generated.error.context.json()).error;}catch{}assert(kind+'_edge_'+String(code).replace(/[^a-z_]/g,''),false);}
    const suggested=await must(Promise.resolve(generated),kind+'_edge_generation');
    const repeated=await must(invoke(parent,'setup-suggestions',request),kind+'_edge_replay');
    assert(kind+'_generation_replay_same',isDeepStrictEqual(suggested,repeated));
    assert(kind+'_server_attaches_verified_source',suggested.suggestions.length===2&&suggested.suggestions.every(i=>i.source_id===sourceId));
    const selected=suggested.suggestions.map(i=>({title:i.title,stars:i.stars,icon:i.icon,source_id:i.source_id,...(kind==='task'?{days:[1,3,5]}:{})}));
    const args={p_request_id:randomUUID(),p_kind:kind,p_items:selected,p_child_id:kind==='task'?childId:null};
    const ids=await rpc(parent,'save_setup_batch',args);
    assert(kind+'_batch_selection_single_receipt',ids.length===2&&isDeepStrictEqual(ids,await rpc(parent,'save_setup_batch',args)));
    const rows=await must(parent.from(kind==='task'?'task_templates':'family_rewards').select('id,title').in('id',ids),kind+'_saved_rows');
    assert(kind+'_two_selected_rows_preserved',rows.length===2&&selected.every(i=>rows.some(r=>r.title===i.title)));
    const links=await rpc(parent,'get_setup_sources',{p_kind:kind,p_ids:ids});
    assert(kind+'_source_links_preserved',Array.isArray(links)&&links.length===2);
    assert(kind+'_single_provider_generation',(await stats())[kind]===1);
  }
  const totals=await stats();
  assert('four_ai_operations_only_four_provider_calls',totals.generations===4&&totals.tokenChecks===4);
  const family=(await parent.auth.getSession()).data.session;
  const familyId=JSON.parse(Buffer.from(family.access_token.split('.')[1],'base64url')).gina.family_id;
  const jobs=await must(admin.from('ai_operation_jobs').select('action,status').eq('family_id',familyId),'local_ai_jobs');
  assert('weekly_and_import_jobs_done_once',jobs.length===2&&jobs.every(j=>j.status==='done'));
  const timetableBody={...body,instructions:'MAT = Matematik. Tekrar eden saatleri ayrı tut.'};
  assert('timetable_requires_consent',!!(await invoke(parent,'timetable-import',{...timetableBody,ai_consent:false})).error);
  assert('timetable_child_analysis_denied',!!(await invoke(child,'timetable-import',timetableBody)).error);
  assert('timetable_foreign_analysis_denied',!!(await invoke(other,'timetable-import',timetableBody)).error);
  assert('timetable_oversized_notes_denied',!!(await invoke(parent,'timetable-import',{...timetableBody,instructions:'x'.repeat(1501)})).error);
  const timetable=await must(invoke(parent,'timetable-import',timetableBody),'timetable_edge_generation');
  assert('timetable_all_periods_retained',timetable.draft.lessons.length===40&&timetable.draft.lessons.every(l=>l.start===null&&l.end===null));
  const timetableReplay=await must(invoke(parent,'timetable-import',timetableBody),'timetable_edge_replay');
  assert('timetable_replay_same_draft',isDeepStrictEqual(timetable,timetableReplay));
  assert('timetable_replay_no_second_provider_call',(await stats()).generations===5);
  const changedNotes={...timetableBody,instructions:'İNG = İngilizce. Tablodaki sütunlar günlerdir.'};
  let revisedResult=await invoke(parent,'timetable-import',changedNotes);
  if(revisedResult.error){
    const code=(await revisedResult.error.context.json()).error;
    assert('timetable_burst_rate_limited_without_provider',code==='ai_rate_limited'&&(await stats()).generations===5);
    // The setup cooldown above already waited 21 s. Let the first operations
    // leave the minute window without modifying production limits or grants.
    await new Promise(resolve=>setTimeout(resolve,42000));
    revisedResult=await invoke(parent,'timetable-import',changedNotes);
  }
  const revised=await must(Promise.resolve(revisedResult),'timetable_changed_notes_generation');
  assert('timetable_new_notes_have_separate_result',revised.id!==timetable.id&&(await stats()).generations===6);
  const sourceLinks=await must(parent.from('timetable_imports').select('source_id').in('id',[timetable.id,revised.id]),'timetable_source_links');
  assert('timetable_original_document_preserved',sourceLinks.length===2&&sourceLinks.every(i=>i.source_id===sourceId));
  await must(admin.from('entitlement_overrides').delete().eq('family_id',familyId),'local_remove_test_entitlement');
  const downgraded=await rpc(parent,'get_family_weekly_review',{p_week:week});
  assert('weekly_ready_result_readable_after_downgrade',downgraded.state==='ready'&&downgraded.access==='disabled'&&isDeepStrictEqual(downgraded.summary,summary.summary));
  assert('quota_downgrade_read_has_no_provider_call',(await stats()).generations===6);
}
