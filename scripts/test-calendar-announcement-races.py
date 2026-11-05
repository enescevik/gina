"""Calendar/announcement races in a disposable empty database. Never runs on the app database."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, subprocess, uuid, sys
if sys.argv[1:] != ['--run-local']: raise SystemExit('Explicit --run-local required')
root=Path(__file__).resolve().parents[1]; db='gina_calendar_races_'+uuid.uuid4().hex[:10]+'_audit'; created=False
out=root/'docs/release/education-calendars-2026-11-05';out.mkdir(parents=True,exist_ok=True)
def sql(database,body,owner=False,allow_error=False):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-X','-qAt','-U',('postgres' if database==db and not owner else 'supabase_admin'),'-d',database,'-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=120)
 if r.returncode:
  if allow_error:return 'ERROR:'+r.stderr.strip()
  raise RuntimeError(r.stderr[-1000:])
 return r.stdout.strip()
admin='00000000-0000-4000-8000-000000009101'; parent='00000000-0000-4000-8000-000000009102';family='10000000-0000-4000-8000-000000009101';child='20000000-0000-4000-8000-000000009101';place='ec000000-0000-4000-8000-000000000001'
def call(expression):
 claims=json.dumps({'sub':admin,'role':'authenticated','gina':{'role':'parent'}},separators=(',',':'))
 return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select {expression};commit;",allow_error=True)
def race(expressions):
 with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(call,expressions))
results=[]
try:
 assert sql('gina_completion_audit','select count(*) from public.families;select count(*) from auth.users;')=='0\n0'
 sql('postgres',f'create database {db} owner postgres template gina_completion_audit;');created=True
 sql(db,'grant references on auth.users to postgres;create publication supabase_realtime;',owner=True)
 for p in sorted((root/'supabase/migrations').glob('*.sql')):
  if p.name<'20261103093000':
   for line in p.read_text().splitlines():
    if line.lower().startswith('alter publication supabase_realtime add table '):sql(db,line)
  else:sql(db,p.read_text())
 sql(db,f"insert into auth.users(id,email) values('{admin}','calendar-race-admin@example.invalid'),('{parent}','calendar-race-parent@example.invalid');insert into public.operations_members(user_id,role,expires_at) values('{admin}','content',now()+interval '1 day'),('{admin}','release',now()+interval '1 day');insert into public.families(id,name,created_by) values('{family}','Synthetic race family','{parent}');insert into public.family_members(family_id,user_id) values('{family}','{parent}');insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic child',2);insert into gina.child_education_locations(child_id,place_id,stage) values('{child}','{place}','primary');")
 def announcement():
  id=str(uuid.uuid4());assert not call(f"public.admin_save_announcement('{uuid.uuid4()}','{id}',0,jsonb_build_object('title','Synthetic notice','body','Disposable concurrency check','place_id',null,'stage',null,'push',true,'expires_on',current_date+1))").startswith('ERROR:')
  preview=json.loads(call(f"public.admin_preview_announcement('{id}',1)"));return id,preview['fingerprint']
 id,fp=announcement();request=str(uuid.uuid4());expr=f"public.admin_publish_announcement('{request}','{id}',1,'{fp}',true)";r=race([expr,expr]);assert all(not x.startswith('ERROR:') for x in r) and r[0]==r[1],r
 assert sql(db,f"select count(*) from gina.parent_inbox where announcement_id='{id}';")=='1'
 results.append({'check':'concurrent_same_request_publish_single_recipient_copy','passed':True})
 id,fp=announcement();r=race([f"public.admin_publish_announcement('{uuid.uuid4()}','{id}',1,'{fp}',true)" for _ in range(2)]);assert sum(not x.startswith('ERROR:') for x in r)==1 and any('announcement_changed' in x for x in r),r
 assert sql(db,f"select count(*) from gina.parent_inbox where announcement_id='{id}';")=='1'
 results.append({'check':'different_requests_same_draft_cannot_publish_twice','passed':True})
 id,fp=announcement();r=race([f"public.admin_publish_announcement('{uuid.uuid4()}','{id}',1,'{fp}',true)",f"public.admin_save_announcement('{uuid.uuid4()}','{id}',1,jsonb_build_object('title','Edited notice','body','Changed while publishing','place_id',null,'stage',null,'push',true,'expires_on',current_date+1))"]);assert sum(not x.startswith('ERROR:') for x in r)==1 and any('announcement_changed' in x for x in r),r
 results.append({'check':'edit_vs_publish_requires_review_of_the_winning_revision','passed':True})
 cal=str(uuid.uuid4());sql(db,f"insert into gina.education_calendars(id,place_id,stage,academic_year,draft,published,published_revision) values('{cal}','{place}','primary',extract(year from current_date)::int,'{{}}',jsonb_build_object('starts_on',current_date,'ends_on',current_date+180),1);update gina.education_notification_settings set reminders_enabled=true;")
 with ThreadPoolExecutor(max_workers=2) as pool:r=list(pool.map(lambda _:sql(db,'select gina.enqueue_education_reminders();'),range(2)))
 assert sorted(r)==['0','1'],r
 assert sql(db,"select count(*) from gina.parent_inbox where kind='education_start';")=='1'
 results.append({'check':'overlapping_reminder_runs_produce_one_inbox_and_push','passed':True})
 assert sql(db,"select count(*) from public.push_outbox where kind='education_reminder';")=='1'
 result={'environment':'empty-disposable-database','results':results};(out/'race-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'races':len(results),'passed':True}))
finally:
 if created:sql('postgres',f'drop database {db} with(force);')
