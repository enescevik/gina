#!/usr/bin/env python3
"""Package cohort admission against replay and publication withdrawal, in disposable audit clones."""
import argparse,json,re,subprocess,threading,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--template',required=True);args=p.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):p.error('Explicit audit template required')
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=40)
 if check and (r.returncode or re.search(r'^not ok',r.stdout,re.M)):raise RuntimeError(r.stderr+r.stdout)
 return r
root=Path(__file__).resolve().parents[1]
fixture=(root/'supabase/tests/047_group_library_packages.test.sql').read_text().split("select set_config('test.exam'")[0]
parent="set local role authenticated;select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000004302\",\"role\":\"authenticated\",\"gina\":{\"role\":\"parent\",\"family_id\":\"10000000-0000-4000-8000-000000004302\"}}',true);"
admin="set local role authenticated;select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000004301\",\"role\":\"authenticated\",\"gina\":{\"admin\":true}}',true);"
enroll="select public.enroll_group_exam('60000000-0000-4000-8000-000000004701','20000000-0000-4000-8000-000000004702',false,true);"
results=[]
for scenario in ['same_enrollment','enroll_vs_withdraw']:
 db='gina_package_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;')
  package=sql(db,"select package_id from public.group_exams where id='60000000-0000-4000-8000-000000004701';").stdout.strip()
  withdraw=f"select public.admin_set_library_publication(gen_random_uuid(),'{package}',1,public.admin_library_publication('{package}')#>>'{{checks,review_fingerprint}}','Test geometry','Test',array['free']::public.plan_code[],'Test curriculum',true,'archived','Race test withdrawal');"
  calls=[parent+enroll,admin+withdraw if scenario=='enroll_vs_withdraw' else parent+enroll];barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   return sql(db,"begin;set local lock_timeout='10s';"+calls[i]+"select pg_sleep(0.1);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  if scenario=='same_enrollment':assert all(r.returncode==0 for r in pair),[(r.returncode,r.stderr) for r in pair]
  else:
   assert pair[1].returncode==0,pair[1].stderr
   if pair[0].returncode:assert 'group_package_unavailable' in pair[0].stderr,pair[0].stderr
  count=int(sql(db,'select count(*) from public.group_exam_entries;').stdout.strip());expected=1 if pair[0].returncode==0 else 0
  assert count==expected,count
  media=int(sql(db,'select count(*) from gina.library_source_copies;').stdout.strip());assert media==expected
  questions=int(sql(db,'select count(*) from public.question_bank;').stdout.strip());assert questions==4*expected
  charges=int(sql(db,'select count(*) from gina.library_acquisition_charges;').stdout.strip());assert charges==0
  results.append({'scenario':scenario,'entries':count,'media':media,'questions':questions,'library_charges':charges,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
