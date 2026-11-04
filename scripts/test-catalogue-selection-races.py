#!/usr/bin/env python3
"""Exercise selection/publication and provider reservation races on disposable audit clones."""
import argparse,json,re,subprocess,threading,uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('Explicit audit template required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
 p=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=45)
 if check and p.returncode:raise RuntimeError(p.stderr)
 return p
fixture=(root/'supabase/tests/057_catalogue_family_selection.test.sql').read_text().split('set local role authenticated;',1)[0].replace('select no_plan();','')
helpers=fixture[fixture.index('create function pg_temp.bundle()'):fixture.index('insert into public.entitlement_overrides')]
parent="set local role authenticated;set local request.jwt.claims='{\"sub\":\"00000000-0000-4000-8000-000000005701\",\"role\":\"authenticated\",\"gina\":{\"role\":\"parent\",\"family_id\":\"10000000-0000-4000-8000-000000005701\"}}';"
admin="set local role authenticated;set local request.jwt.claims='{\"sub\":\"00000000-0000-4000-8000-000000005702\",\"role\":\"authenticated\",\"gina\":{\"role\":\"parent\",\"admin\":true}}';"
service="set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';"
results=[]
for scenario in ['same_selection','two_devices','withdraw_selection','withdraw_reservation']:
 db='gina_catalog_selection_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+"update public.app_settings set value='true' where key='curriculum_catalog.enabled';"+admin+"select public.admin_import_curriculum_candidates(gen_random_uuid(),pg_temp.bundle());commit;")
  cid=sql(db,'select id from gina.curriculum_candidates;').stdout.strip()
  sql(db,'begin;'+helpers+admin+f"select public.admin_change_curriculum_candidate(gen_random_uuid(),'{cid}',0,'review',pg_temp.review(),'Synthetic review',true);select public.admin_change_curriculum_candidate(gen_random_uuid(),'{cid}',1,'publish',null,'Synthetic publication',true);commit;")
  body=json.dumps(dict(child_id='20000000-0000-4000-8000-000000005701',catalogue_id=cid,revision=2,subject='Türkçe',confirmed=True));request=str(uuid.uuid4())
  if scenario=='withdraw_reservation':sql(db,'begin;'+parent+f"select public.save_catalog_blueprint('{uuid.uuid4()}','{body}');commit;")
  bp=sql(db,'select id from public.exam_blueprints;').stdout.strip()
  barrier=threading.Barrier(2)
  def send(i):
   if i==1 and scenario.startswith('withdraw'):
    command=admin+f"select public.admin_change_curriculum_candidate(gen_random_uuid(),'{cid}',2,'withdraw',null,'Race withdrawal',true);"
   elif scenario=='withdraw_reservation':
    command=service+f"select public.reserve_catalog_prova_generation('{request}','10000000-0000-4000-8000-000000005701','00000000-0000-4000-8000-000000005701',repeat('a',64),6,'{bp}','30000000-0000-4000-8000-000000005701');"
   else:command=parent+f"select public.save_catalog_blueprint('{uuid.uuid4() if scenario=='two_devices' and i else request}','{body}');"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  for r in pair:
   if r.returncode:assert scenario=='withdraw_selection' and 'curriculum_unavailable' in r.stderr,r.stderr
  count=int(sql(db,'select count(*) from public.exam_blueprints;').stdout.strip())
  if scenario in ['same_selection','two_devices']:assert all(r.returncode==0 for r in pair) and count==1
  if scenario=='withdraw_selection':assert pair[1].returncode==0 and count==int(pair[0].returncode==0)
  if scenario=='withdraw_reservation':
   assert all(r.returncode==0 for r in pair)
   jobs=int(sql(db,'select count(*) from public.prova_generation_jobs;').stdout.strip())
   assert jobs==int('"lease"' in pair[0].stdout)
   new=sql(db,'begin;'+service+f"select public.reserve_catalog_prova_generation('{uuid.uuid4()}','10000000-0000-4000-8000-000000005701','00000000-0000-4000-8000-000000005701',repeat('b',64),6,'{bp}','30000000-0000-4000-8000-000000005701');commit;").stdout
   assert 'curriculum_unavailable' in new,new
  results.append(dict(scenario=scenario,successes=sum(r.returncode==0 for r in pair),copies=count,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
