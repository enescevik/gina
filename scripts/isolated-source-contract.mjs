import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

export async function testSources({parent,other,child,childId,admin,base,pdf,must,assert}) {
  await must(admin.from('app_settings').update({value:true}).eq('key','sources.enabled'),'local_source_feature');
  const fixture=readFileSync(new URL('../supabase/functions/ai-preflight/fixture.ts',import.meta.url),'utf8').match(/"([A-Za-z0-9+/=]{100,})"/)[1];
  const png=Buffer.from(fixture,'base64');
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const invoke=(c,body)=>c.functions.invoke('learning-source',{body});
  // U08: hata gövdesi sözleşmesi — eski `error` alanı + code/category/retryable; ham mesaj yok.
  const failure=async(c,body)=>{const r=await invoke(c,body);const res=r.error?.context;if(!res||typeof res.json!=='function')return {status:null,body:null};return {status:res.status,body:await res.json().catch(()=>null)};};
  const contract=(f,status,code,category)=>!!f.body&&f.status===status&&f.body.error===f.body.code&&(code===null||f.body.code===code)&&f.body.category===category&&typeof f.body.retryable==='boolean';
  for (const [format,mime,bytes] of [['png','image/png',png],['pdf','application/pdf',Buffer.from(pdf,'base64')]]) {
    const id=randomUUID(),body={action:'reserve',id,kind:'document',name:`synthetic.${format}`,mime,bytes:bytes.length,sha256:hash(bytes),consent:true};
    const reserved=await must(invoke(parent,body),format+'_reserve');
    const replay=await must(invoke(parent,body),format+'_reserve_replay');
    assert(format+'_single_reservation',reserved.id===replay.id&&reserved.path===replay.path);
    await must(parent.storage.from(reserved.bucket).uploadToSignedUrl(reserved.path,reserved.token,bytes,{contentType:mime,cacheControl:'0'}),format+'_signed_upload');
    const finalized=await must(invoke(parent,{action:'finalize',id}),format+'_finalize');
    assert(format+'_verified_metadata',finalized.ready===true&&finalized.pages===1&&(format==='pdf'||(finalized.width===960&&finalized.height===360)));
    const again=await must(invoke(parent,{action:'finalize',id}),format+'_finalize_replay');
    assert(format+'_same_finalization',again.id===id&&again.ready===true);
    const original=await must(invoke(parent,{action:'view',id}),format+'_signed_view');
    assert(format+'_view_uses_local_private_storage',new URL(original.url).origin===base);
    const downloaded=await fetch(original.url);
    assert(format+'_original_bytes_preserved',downloaded.ok&&hash(Buffer.from(await downloaded.arrayBuffer()))===hash(bytes));
    assert(format+'_foreign_family_view_denied',!!(await invoke(other,{action:'view',id})).error);
    if (format==='png') {
      const foreign=await failure(other,{action:'view',id});
      assert('u08_foreign_view_contract_body',contract(foreign,403,'source_not_available','permission_denied'),JSON.stringify(foreign));
      const device=await failure(child,{action:'delete',id});
      assert('u08_device_parent_action_forbidden',contract(device,403,'forbidden','permission_denied'),JSON.stringify(device));
    }
    assert(format+'_unlinked_child_view_denied',!!(await invoke(child,{action:'view',id})).error);
    const publicUrl=parent.storage.from(reserved.bucket).getPublicUrl(reserved.path).data.publicUrl;
    assert(format+'_anonymous_public_download_denied',!(await fetch(publicUrl)).ok);
    await must(invoke(parent,{action:'delete',id}),format+'_delete');
    assert(format+'_metadata_access_revoked_after_delete',!!(await invoke(parent,{action:'view',id})).error);
    assert(format+'_object_removed_after_successful_cleanup',!(await fetch(original.url)).ok);
  }
  const id=randomUUID(),body={action:'reserve',id,kind:'document',name:'mismatch.png',mime:'image/png',bytes:png.length,sha256:'0'.repeat(64),consent:true};
  const reserved=await must(invoke(parent,body),'mismatch_reserve');
  await must(parent.storage.from(reserved.bucket).uploadToSignedUrl(reserved.path,reserved.token,png,{contentType:'image/png'}),'mismatch_upload');
  assert('changed_upload_rejected',!!(await invoke(parent,{action:'finalize',id})).error);
  const invalid=await must(parent.from('learning_sources').select('status').eq('id',id).single(),'invalid_source_state');
  assert('changed_upload_not_marked_ready',invalid.status==='invalid');
  const queue=await must(admin.from('source_deletion_queue').select('object_path').eq('object_path',reserved.path),'invalid_source_cleanup_queue');
  assert('invalid_upload_queued_for_cleanup',queue.length===1);
  const imageId=randomUUID(),imageBody={...body,id:imageId,kind:'question_image',name:'question.png',sha256:hash(png)};
  assert('source_storage_consent_required',!!(await invoke(parent,{...imageBody,consent:false})).error);
  const consent=await failure(parent,{...imageBody,consent:false});
  assert('u08_consent_contract_body',contract(consent,400,null,'validation')&&/^source_[a-z_]+$/.test(consent.body.code),JSON.stringify(consent));
  const image=await must(invoke(parent,imageBody),'question_image_reserve');
  await must(parent.storage.from(image.bucket).uploadToSignedUrl(image.path,image.token,png,{contentType:'image/png'}),'question_image_upload');
  await must(invoke(parent,{action:'finalize',id:imageId}),'question_image_finalize');
  const questionArgs={p_request_id:randomUUID(),p_question:{grade:5,subject:'Matematik',topic:'Tablo okuma',stem:'Görselde pazartesi hangi ders var?',kind:'open_ended',difficulty:'orta',expected_answer:'Matematik',solution:'Pazartesi satırında Matematik yazıyor.'},p_images:[{source_id:imageId,alt:'İki günlük örnek ders programı'}]};
  const questionId=await must(parent.rpc('save_question_with_sources',questionArgs),'save_question_with_image');
  assert('question_image_save_replay',questionId===await must(parent.rpc('save_question_with_sources',questionArgs),'question_image_replay'));
  assert('child_cannot_view_unassigned_question_image',!!(await invoke(child,{action:'view',id:imageId,question_id:questionId})).error);
  const draftId=randomUUID(),content={childId,grade:5,title:'Synthetic image Prova',purpose:'written',format:'school',subjects:['Matematik'],topics:['Tablo okuma'],target:1,minutes:null,difficulty:'orta',kind:'open_ended',note:'',step:2,blocks:[{kind:'question',id:questionId,source:'manual'}]};
  await must(parent.rpc('save_prova_draft',{p_request_id:randomUUID(),p_id:draftId,p_version:0,p_content:content}),'save_image_prova');
  await must(parent.rpc('submit_prova_draft',{p_request_id:randomUUID(),p_id:draftId,p_version:1}),'assign_image_prova');
  const childView=await must(invoke(child,{action:'view',id:imageId,question_id:questionId}),'assigned_child_image_view');
  assert('assigned_child_view_is_local',new URL(childView.url).origin===base);
  const childImage=await fetch(childView.url);
  assert('assigned_child_receives_original_image',childImage.ok&&hash(Buffer.from(await childImage.arrayBuffer()))===hash(png));
  assert('wrong_question_cannot_authorize_image',!!(await invoke(child,{action:'view',id:imageId,question_id:randomUUID()})).error);
  assert('assigned_question_image_cannot_be_deleted',!!(await invoke(parent,{action:'delete',id:imageId})).error);
}
