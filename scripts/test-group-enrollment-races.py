#!/usr/bin/env python3
"""Cohort enrollment/cancellation races in disposable audit clones only."""
import argparse,json,re,subprocess,threading,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('An explicit audit template is required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
prefix=(root/'supabase/tests/029_group_exams.test.sql').read_text().split('set local role authenticated;')[0].replace('select no_plan();','')
parent='{"sub":"00000000-0000-4000-8000-000000002901","role":"authenticated","gina":{"family_id":"10000000-0000-4000-8000-000000002901","role":"parent"}}'
admin='{"sub":"00000000-0000-4000-8000-000000002903","role":"authenticated","gina":{"role":"none","admin":true}}'
def auth(claims):return f"set local role authenticated;set local request.jwt.claims='{claims}';"
def group(n):return f'60000000-0000-4000-8000-{n:012}'
def enroll(g):return f"select public.enroll_group_exam('{group(g)}','20000000-0000-4000-8000-000000002901',false,true);"
results=[]
for scenario in ['same_child_twice','two_groups_last_quota','cancel_vs_enroll']:
 db='gina_group_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,prefix+"update public.app_settings set value='true' where key='cohorts.enabled';update public.plans set cohort_monthly=1 where code='plus';commit;")
  for n in [2901,2902]:
   sql(db,'begin;'+auth(admin)+f"select public.admin_create_group_exam('{group(n)}','40000000-0000-4000-8000-000000002901','Practice {n}',array['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003']::uuid[],now()-interval '1 hour',now()+interval '1 hour',30,array['plus']::public.plan_code[]);commit;")
  calls=[auth(parent)+enroll(2901),auth(parent)+enroll(2902 if scenario=='two_groups_last_quota' else 2901)]
  if scenario=='cancel_vs_enroll':calls[1]=auth(admin)+f"select public.admin_cancel_group_exam('{group(2901)}','Review before new publication');"
  barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+calls[i]+"select pg_sleep(0.1);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  successes=sum(r.returncode==0 for r in pair)
  count=int(sql(db,'select count(*) from public.group_exam_entries;').stdout.strip())
  if scenario=='same_child_twice':assert successes==2 and count==1
  elif scenario=='two_groups_last_quota':assert successes==1 and count==1 and any('group_quota' in r.stderr for r in pair)
  else:
   assert pair[1].returncode==0 and count in [0,1]
   if pair[0].returncode:assert 'group_not_open' in pair[0].stderr
   assert sql(db,f"select status from public.group_exams where id='{group(2901)}';").stdout.strip()=='cancelled'
  assert int(sql(db,'select count(*) from public.exams;').stdout.strip())==count
  results.append({'scenario':scenario,'successes':successes,'entries':count,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
