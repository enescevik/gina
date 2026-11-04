// Explicit operator test against a real Supabase project; never run in CI automatically.
// Creates one synthetic account/family, performs one paid document extraction, then deletes
// only that account through the normal deletion flow (admin cleanup on failure).
// Requires sources.enabled already open; never changes a global rollout flag.
// Existing family records are untouched.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const project = process.argv.find(v => v.startsWith('--project-ref='))?.split('=')[1];
if (!/^[a-z]{20}$/.test(project ?? '') || !process.argv.includes('--run')) throw Error('Explicit --project-ref and --run required');
const cli = spawnSync('pnpm', ['exec','supabase','projects','api-keys','--project-ref',project,'--output','json'],{encoding:'utf8'});
if (cli.status !== 0) throw Error('Credential lookup failed; output withheld');
const keys = JSON.parse(cli.stdout);
const serviceKey = keys.find(k=>k.name==='service_role')?.api_key;
const anonKey = keys.find(k=>k.name==='anon')?.api_key;
if (!serviceKey || !anonKey) throw Error('Project credentials unavailable');
const url = `https://${project}.supabase.co`;
const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin = createClient(url,serviceKey,options);
const parent = createClient(url,anonKey,options);
const report = {project,checks:{},cleanup:{}};
const must = (result,label) => { if(result.error) throw Error(label); return result.data; };
const check = (name,condition) => {report.checks[name]=!!condition;if(!condition)throw Error(name);};
let userId, familyId, sourcePath, sourceId, deleted=false;
try {
  const setting = must(await admin.from('app_settings').select('value').eq('key','sources.enabled').single(),'read_source_flag');
  if(setting.value !== true) throw Error('source_feature_not_enabled');
  report.checks.global_source_flag_already_enabled=true;
  const password = randomBytes(32).toString('base64url');
  const email = `gina-service-check-${randomUUID()}@example.invalid`;
  const created = must(await admin.auth.admin.createUser({email,password,email_confirm:true}),'create_synthetic_user');
  userId=created.user.id;
  must(await parent.auth.signInWithPassword({email,password}),'synthetic_sign_in');
  familyId=must(await parent.rpc('create_family',{p_name:'Synthetic service check',p_display_name:'Synthetic operator'}),'create_synthetic_family');
  must(await parent.auth.refreshSession(),'refresh_family_claims');
  const childId=must(await parent.rpc('save_child_setup',{p_request_id:randomUUID(),p_profile:{name:'Synthetic child',birth_year:2015,grade:5,gender:'unspecified',avatar:'avatar-default',interests:[]},p_tasks:[]}),'create_synthetic_child');
  must(await admin.from('entitlement_overrides').insert({family_id:familyId,plan:'pro',reason:'Synthetic service check; account removed after test',ends_at:new Date(Date.now()+3600000).toISOString()}),'temporary_test_entitlement');
  const batch={p_request_id:randomUUID(),p_kind:'task',p_child_id:childId,p_items:[
    {title:'Synthetic reading',icon:'read-book',stars:2,days:[1]},
    {title:'Synthetic packing',icon:'pack-school-bag',stars:1,days:[2]},
    {title:'Synthetic watering',icon:'water-plants',stars:1,days:[3]},
  ]};
  const saved=must(await parent.rpc('save_setup_batch',batch),'save_three_tasks');
  const replay=must(await parent.rpc('save_setup_batch',batch),'replay_three_tasks');
  check('batch_receipt_over_http',saved.length===3&&JSON.stringify(saved)===JSON.stringify(replay));
  const fixture=readFileSync(new URL('../supabase/functions/ai-preflight/fixture.ts',import.meta.url),'utf8').match(/"([A-Za-z0-9+/=]{100,})"/)[1];
  const bytes=Buffer.from(fixture,'base64');sourceId=randomUUID();
  const reserved=must(await parent.functions.invoke('learning-source',{body:{action:'reserve',id:sourceId,kind:'document',name:'synthetic-timetable.png',mime:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),consent:true}}),'reserve_source');
  sourcePath=reserved.path;
  must(await parent.storage.from(reserved.bucket).uploadToSignedUrl(reserved.path,reserved.token,bytes,{contentType:'image/png',cacheControl:'0'}),'signed_upload');
  const finalized=must(await parent.functions.invoke('learning-source',{body:{action:'finalize',id:sourceId}}),'finalize_source');
  check('signed_upload_and_validation',finalized.ready===true);
  const input={source_id:sourceId,child_id:childId,locale:'tr',ai_consent:true};
  const imported=must(await parent.functions.invoke('timetable-import',{body:input}),'extract_timetable');
  const repeated=must(await parent.functions.invoke('timetable-import',{body:input}),'replay_timetable');
  check('import_reuses_paid_result',imported.id===repeated.id);
  const monday=imported.draft.lessons.find(l=>l.day===1),tuesday=imported.draft.lessons.find(l=>l.day===2);
  check('document_extraction_preserves_unknown_time',imported.draft.lessons.length===2&&monday?.start==='09:00'&&monday.end==='09:40'&&tuesday?.start==='10:00'&&tuesday.end===null);
  const lessons=imported.draft.lessons.map(l=>({id:randomUUID(),day:l.day,title:l.title,start:l.start,end:l.end??'10:40'}));
  const apply={p_request_id:randomUUID(),p_import_id:imported.id,p_revision:0,p_lessons:lessons,p_settings:{start:'09:00',duration:40,break:10}};
  const revision=must(await parent.rpc('apply_timetable_import',apply),'apply_reviewed_timetable');
  check('program_receipt_over_http',revision===1&&must(await parent.rpc('apply_timetable_import',apply),'replay_apply')===revision);
  const program=must(await admin.from('school_timetables').select('lessons,revision').eq('child_id',childId).single(),'read_program');
  const events=must(await admin.from('events').select('id').eq('child_id',childId).not('timetable_entry_key','is',null),'read_calendar');
  const links=must(await parent.rpc('get_timetable_sources',{p_child_id:childId}),'read_original_link');
  check('program_calendar_original_link',program.lessons.length===2&&events.length===2&&links.some(l=>l.source_id===sourceId));
  const usage=must(await admin.from('prova_ai_usage').select('input_tokens,output_tokens').eq('family_id',familyId).eq('action','import'),'read_synthetic_usage');
  check('single_paid_import_record',usage.length===1);
  report.synthetic_import_usage=usage[0];
  const view=must(await parent.functions.invoke('learning-source',{body:{action:'view',id:sourceId}}),'view_original');
  const parsed=new URL(view.url);if(parsed.origin!==url)throw Error('Unexpected source URL');
  const original=await fetch(view.url);check('original_download',original.ok&&createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex')===createHash('sha256').update(bytes).digest('hex'));
  const deletion=must(await parent.functions.invoke('delete-account',{body:{confirm:true,password}}),'delete_synthetic_account');
  deleted=deletion.ok===true;check('normal_account_deletion',deleted);
} catch(error) {
  // Only our static operation labels; never print a Supabase error object, key or URL token.
  report.error=error instanceof Error && /^[a-z_]{1,100}$/.test(error.message) ? error.message : 'service_check_failed';
  process.exitCode=1;
} finally {
  if(userId&&!deleted){const cleanup=await admin.auth.admin.deleteUser(userId,false);report.cleanup.admin_account_cleanup=!cleanup.error;}
  if(sourcePath){const cleanup=await admin.storage.from('gina-private-sources').remove([sourcePath]);report.cleanup.test_object_removed=!cleanup.error;}
  if(familyId){const remaining=await admin.from('families').select('id').eq('id',familyId);report.cleanup.family_absent=!remaining.error&&remaining.data.length===0;}
  if(sourceId){const remaining=await admin.from('learning_sources').select('id').eq('id',sourceId);report.cleanup.source_absent=!remaining.error&&remaining.data.length===0;}
  if(userId){const remaining=await admin.auth.admin.getUserById(userId);report.cleanup.user_absent=remaining.error?.status===404;}
  if(Object.values(report.cleanup).some(v=>v!==true))process.exitCode=1;
  console.log(JSON.stringify(report,null,2));
}
