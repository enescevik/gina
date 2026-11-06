// C03 acceptance against real local Auth/PostgREST (+ Storage and the unchanged Edge handlers when
// --with-storage): return reason across two parents and the child device, legacy review calls,
// bulk archive/restore counts and history, and the real file/account deletion paths.
// Synthetic users only; the disposable database is dropped by the runner.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

export async function testC03({admin,client,parentA,other,device,childId,draftId,base,storage,must,assert}) {
  const rpc=(c,name,args)=>must(c.rpc(name,args),'c03_'+name);
  const checks_diag=(text)=>{try{assert("diag:"+text,false);}catch{}};
  const refresh=async c=>(await must(c.auth.refreshSession(),'c03_refresh')).session;
  const signIn=async(email,password)=>{const c=client();await must(c.auth.signInWithPassword({email,password}),'c03_sign_in');return c;};
  const newUser=async()=>{const email=`gina-c03-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
    await must(admin.auth.admin.createUser({email,password,email_confirm:true}),'c03_create_user');return {email,password,c:await signIn(email,password)};};
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'});

  // --- Co-parent joins family A ---------------------------------------------------------------------------------
  const fam=await must(parentA.from('families').select('invite_code').single(),'c03_read_invite');
  const co=await newUser();
  await rpc(co.c,'join_family',{p_invite_code:fam.invite_code,p_display_name:'Synthetic co-parent'});
  await refresh(co.c);

  // --- Return reason: parent A returns with a reason; co-parent and the child device read it -------------------
  const task=randomUUID();
  const familyOfChild=(await must(parentA.from('children').select('family_id').eq('id',childId).single(),'c03_family_of_child')).family_id;
  await must(parentA.from('task_templates').insert({id:task,family_id:familyOfChild,child_id:childId,title:'C03 synthetic tidy',stars:3,starts_on:today}),'c03_create_task');
  const submitted=await rpc(device,'complete_task',{p_template_id:task,p_due_date:today,p_client_id:randomUUID()});
  const row=Array.isArray(submitted)?submitted[0]:submitted;
  const args={p_request_id:randomUUID(),p_completion_id:row.id,p_approve:false,p_expected_completed_at:row.completed_at,p_return_reason:'missing_part',p_return_note:'Yatağı da topla'};
  const first=await rpc(parentA,'review_task_once',args);
  assert('c03_return_with_reason',first.status==='returned'&&first.return_reason==='missing_part'&&first.return_note==='Yatağı da topla');
  assert('c03_return_replay_same_result',JSON.stringify(await rpc(parentA,'review_task_once',args))===JSON.stringify(first));
  const conflict=await parentA.rpc('review_task_once',{...args,p_return_note:'Başka'});
  assert('c03_same_request_other_note_conflict',conflict.error?.message==='request_conflict');
  const second=await co.c.rpc('review_task_once',{...args,p_request_id:randomUUID(),p_approve:true,p_return_reason:null,p_return_note:null});
  assert('c03_coparent_second_decision_rejected',second.error?.message==='already_reviewed');
  const coRead=await must(co.c.from('task_completions').select('status,return_reason,return_note').eq('id',row.id).single(),'c03_coparent_reads');
  assert('c03_coparent_sees_reason',coRead.status==='returned'&&coRead.return_reason==='missing_part'&&coRead.return_note==='Yatağı da topla');
  const childRead=await must(device.from('task_completions').select('return_reason,return_note').eq('id',row.id).single(),'c03_child_reads');
  assert('c03_child_device_sees_reason',childRead.return_reason==='missing_part'&&childRead.return_note==='Yatağı da topla');
  assert('c03_foreign_family_cannot_read_reason',(await must(other.from('task_completions').select('id').eq('id',row.id),'c03_foreign_read')).length===0);
  const deviceReview=await device.rpc('review_task_once',{...args,p_request_id:randomUUID()});
  assert('c03_child_device_cannot_review',!!deviceReview.error);
  // Resubmission keeps the previous reason for the parent; the legacy 4-argument approval clears it, stars once.
  const again=await rpc(device,'complete_task',{p_template_id:task,p_due_date:today,p_client_id:randomUUID()});
  const resub=Array.isArray(again)?again[0]:again;
  assert('c03_resubmission_keeps_previous_reason',resub.status==='done'&&resub.return_reason==='missing_part');
  const legacy={p_request_id:randomUUID(),p_completion_id:row.id,p_approve:true,p_expected_completed_at:resub.completed_at};
  const approved=await rpc(co.c,'review_task_once',legacy);
  assert('c03_legacy_four_argument_call',approved.status==='approved'&&approved.return_reason===null);
  await rpc(co.c,'review_task_once',legacy);
  const stars=await must(device.from('star_events').select('delta').eq('completion_id',row.id),'c03_child_stars');
  assert('c03_double_tap_single_award',stars.length===1&&stars[0].delta===3);

  // --- Bulk: calendar archive → co-parent restore → history; assigned Prova draft stays protected ----------------
  const familyId=(await must(parentA.from('children').select('family_id').eq('id',childId).single(),'c03_family')).family_id;
  const tomorrow=new Date(Date.now()+86400000).toISOString();
  const events=[randomUUID(),randomUUID()];
  await must(parentA.from('events').insert([{id:events[0],family_id:familyId,child_id:childId,type:'activity',title:'C03 swim',starts_at:tomorrow},{id:events[1],family_id:familyId,child_id:childId,type:'activity',title:'C03 chess',starts_at:tomorrow,rrule:'FREQ=WEEKLY'}]),'c03_create_events');
  const to=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'});
  const preview=await rpc(parentA,'bulk_archive_preview',{p_scope:{types:['event'],child_id:childId,from:today,to,event_scope:'series'}});
  const items=preview.items.filter(i=>events.includes(i.id)).map(i=>({type:'event',id:i.id,revision:i.revision}));
  assert('c03_bulk_preview_lists_both',items.length===2);
  const key=randomUUID();
  const applied=await rpc(parentA,'bulk_archive_apply',{p_items:items,p_idempotency_key:key});
  assert('c03_bulk_archive_two',applied.summary.ok===2);
  assert('c03_bulk_apply_twice_one_result',JSON.stringify(await rpc(parentA,'bulk_archive_apply',{p_items:items,p_idempotency_key:key}))===JSON.stringify(applied));
  assert('c03_archived_hidden_from_parent',(await must(co.c.from('events').select('id').in('id',events),'c03_events_after')).length===0);
  assert('c03_archived_hidden_from_child',(await must(device.from('events').select('id').in('id',events),'c03_child_events_after')).length===0);
  const back=await rpc(co.c,'bulk_archive_preview',{p_scope:{types:['event'],child_id:childId,archived:true}});
  const restoreItems=back.items.filter(i=>events.includes(i.id)&&i.archived).map(i=>({type:'event',id:i.id,revision:i.revision}));
  const restored=await rpc(co.c,'bulk_restore_apply',{p_items:restoreItems,p_idempotency_key:randomUUID()});
  assert('c03_bulk_restore_two',restored.summary.ok===2);
  const history=await rpc(parentA,'bulk_archive_history',{});
  const mine=history.find(h=>h.run_id===key),theirs=history.find(h=>h.run_id===restored.run_id);
  assert('c03_history_counts',mine?.operation==='archive'&&mine.summary.ok===2&&mine.mine===true&&theirs?.operation==='restore'&&theirs.summary.ok===2&&theirs.mine===false);
  if(draftId){
    const drafts=await rpc(parentA,'bulk_archive_preview',{p_scope:{types:['prova_draft']}});
    const assigned=drafts.items.find(i=>i.id===draftId);
    assert('c03_assigned_prova_draft_protected',!assigned||assigned.blocked==='prova_draft_assigned'||assigned.blocked==='prova_has_answers');
    if(assigned){
      const tried=await rpc(parentA,'bulk_archive_apply',{p_items:[{type:'prova_draft',id:draftId,revision:assigned.revision}],p_idempotency_key:randomUUID()});
      assert('c03_assigned_prova_draft_not_archived',tried.summary.ok===0);
    }
  }

  // --- Weekly suggestion → task form child map; help reply tracking ---------------------------------------------
  const monday=new Date();monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7)-7);
  const kids=await rpc(parentA,'weekly_review_children',{p_week:monday.toISOString().slice(0,10)});
  assert('c03_weekly_child_map',kids.some(k=>k.child_id===childId));
  assert('c03_weekly_child_map_foreign_empty',!(await rpc(other,'weekly_review_children',{p_week:monday.toISOString().slice(0,10)})).some(k=>k.child_id===childId));

  if(!storage) return;
  // --- Storage + Edge: shared source survives a co-parent's account deletion; last parent's deletion removes it ---
  const invoke=(c,name,body)=>c.functions.invoke(name,{body});
  const c1=await newUser(),c2=await newUser();
  const famC=await rpc(c1.c,'create_family',{p_name:'Synthetic family C03',p_display_name:'Synthetic parent C1'});
  await refresh(c1.c);
  await must(admin.from('entitlement_overrides').insert({family_id:famC,plan:'pro',reason:'Isolated C03 acceptance',ends_at:new Date(Date.now()+3600000).toISOString()}),'c03_entitlement');
  const invite=(await must(c1.c.from('families').select('invite_code').single(),'c03_invite_c')).invite_code;
  await rpc(c2.c,'join_family',{p_invite_code:invite,p_display_name:'Synthetic parent C2'});
  await refresh(c2.c);
  const kid=await rpc(c1.c,'save_child_setup',{p_request_id:randomUUID(),p_profile:{name:'Synthetic C child',birth_year:2016,grade:4,gender:'unspecified',avatar:'avatar-default',interests:[]},p_tasks:[]});
  const kid2=await rpc(c1.c,'save_child_setup',{p_request_id:randomUUID(),p_profile:{name:'Synthetic C sibling',birth_year:2017,grade:3,gender:'unspecified',avatar:'avatar-default',interests:[]},p_tasks:[]});
  const fixture=readFileSync(new URL('../supabase/functions/ai-preflight/fixture.ts',import.meta.url),'utf8').match(/"([A-Za-z0-9+/=]{100,})"/)[1];
  const png=Buffer.from(fixture,'base64'),hash=createHash('sha256').update(png).digest('hex');
  const source=randomUUID();
  const reserved=await must(invoke(c1.c,'learning-source',{action:'reserve',id:source,kind:'document',name:'c03-shared.png',mime:'image/png',bytes:png.length,sha256:hash,consent:true}),'c03_reserve');
  await must(c1.c.storage.from(reserved.bucket).uploadToSignedUrl(reserved.path,reserved.token,png,{contentType:'image/png'}),'c03_upload');
  await must(invoke(c1.c,'learning-source',{action:'finalize',id:source}),'c03_finalize');
  const view=await must(invoke(c2.c,'learning-source',{action:'view',id:source}),'c03_coparent_view');
  assert('c03_coparent_signed_url_works',(await fetch(view.url)).ok);
  // Unauthorised signed URLs: tampered token, raw object path, the family's own JWT without the Edge, a foreign family.
  const tampered=new URL(view.url);tampered.searchParams.set('token',tampered.searchParams.get('token').slice(0,-4)+'AAAA');
  assert('c03_tampered_signed_url_denied',!(await fetch(tampered)).ok);
  assert('c03_raw_object_path_denied',!(await fetch(`${base}/storage/v1/object/${reserved.bucket}/${reserved.path}`)).ok);
  const direct=await c2.c.storage.from(reserved.bucket).createSignedUrl(reserved.path,60);
  assert('c03_client_cannot_sign_private_object',!!direct.error||!direct.data?.signedUrl||!(await fetch(direct.data.signedUrl)).ok);
  assert('c03_foreign_family_cannot_view',!!(await invoke(other,'learning-source',{action:'view',id:source})).error);

  // Child deletion through the preview path: files are family-level and stay; replay returns the receipt.
  const childPreview=await rpc(c1.c,'deletion_preview',{p_target:{kind:'child',child_id:kid2}});
  const request=randomUUID();
  const deleted=await rpc(c1.c,'confirm_child_deletion',{p_request_id:request,p_child_id:kid2,p_preview_token:childPreview.preview_token});
  assert('c03_child_deleted_once',JSON.stringify(await rpc(c1.c,'confirm_child_deletion',{p_request_id:request,p_child_id:kid2,p_preview_token:childPreview.preview_token}))===JSON.stringify(deleted));
  assert('c03_child_gone',(await must(c1.c.from('children').select('id').eq('id',kid2),'c03_child_after')).length===0);
  assert('c03_file_kept_after_child_deletion',(await fetch((await must(invoke(c1.c,'learning-source',{action:'view',id:source}),'c03_view_after_child')).url)).ok);

  // Co-parent deletes their account (transfer): real Edge + real Auth; the shared family file stays.
  const coPreview=await rpc(c2.c,'deletion_preview',{p_target:{kind:'account'}});
  assert('c03_account_preview_transfer',coPreview.families?.[0]?.mode==='transfer');
  const wrong=await invoke(c2.c,'delete-account',{confirm:true,password:'wrong-password',preview_token:coPreview.preview_token});
  assert('c03_wrong_password_keeps_account',!!wrong.error);
  await must(invoke(c2.c,'delete-account',{confirm:true,password:c2.password,preview_token:coPreview.preview_token}),'c03_coparent_account_deleted');
  const relogin=await client().auth.signInWithPassword({email:c2.email,password:c2.password});
  assert('c03_deleted_coparent_cannot_sign_in',!!relogin.error);
  const kept=await must(invoke(c1.c,'learning-source',{action:'view',id:source}),'c03_view_after_coparent_delete');
  assert('c03_shared_file_survives_coparent_deletion',(await fetch(kept.url)).ok);

  // Stale preview: the family changed after the preview → 409, nothing deleted.
  const lastPreview=await rpc(c1.c,'deletion_preview',{p_target:{kind:'account'}});
  await rpc(c1.c,'save_child_setup',{p_request_id:randomUUID(),p_profile:{name:'Synthetic C late child',birth_year:2018,grade:2,gender:'unspecified',avatar:'avatar-default',interests:[]},p_tasks:[]});
  const stale=await invoke(c1.c,'delete-account',{confirm:true,password:c1.password,preview_token:lastPreview.preview_token});
  const staleBody=stale.error?.context?await stale.error.context.json().catch(()=>null):null;
  assert('c03_stale_account_preview_409',stale.error?.context?.status===409&&staleBody?.error==='deletion_preview_stale');
  assert('c03_stale_preview_deleted_nothing',(await must(c1.c.from('children').select('id').eq('id',kid),'c03_child_still_there')).length===1);

  // Last parent: fresh preview → cascade; the queued storage object is removed and old signed URLs stop working.
  const before=await must(invoke(c1.c,'learning-source',{action:'view',id:source}),'c03_view_before_last');
  const fresh=await rpc(c1.c,'deletion_preview',{p_target:{kind:'account'}});
  assert('c03_account_preview_cascade',fresh.families?.[0]?.mode==='cascade');
  const last=await invoke(c1.c,'delete-account',{confirm:true,password:c1.password,preview_token:fresh.preview_token});
  if(last.error){const body=last.error.context?await last.error.context.json().catch(()=>null):null;
    const uid=(await c1.c.auth.getUser()).data.user?.id;
    const chk=await admin.rpc('check_deletion_preview',{p_token:fresh.preview_token,p_user_id:uid});
    const del=await admin.auth.admin.deleteUser(uid,false);
    checks_diag(JSON.stringify({check:chk.data??chk.error?.message,del:del.error?{message:del.error.message,status:del.error.status,code:del.error.code}:null}));
    assert('c03_last_parent_deleted_'+String(last.error.context?.status)+'_'+String(body?.error??'unknown').replace(/[^a-z_]/g,''),false);}
  assert('c03_last_parent_deleted',!last.error);
  assert('c03_family_cascade_removed',(await must(admin.from('families').select('id').eq('id',famC),'c03_family_after')).length===0);
  // The queue keeps a successful row for 3 hours (late-upload guard); success = attempted with no error.
  const queued=await must(admin.from('source_deletion_queue').select('attempts,last_error').eq('object_path',reserved.path),'c03_queue_after');
  assert('c03_cleanup_ran_without_error',queued.length===1&&queued[0].attempts>=1&&queued[0].last_error===null);
  assert('c03_old_signed_url_dead_after_deletion',!(await fetch(before.url)).ok);
  const gone=await admin.storage.from(reserved.bucket).download(reserved.path);
  assert('c03_storage_object_removed',!!gone.error);
}
