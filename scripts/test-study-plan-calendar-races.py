#!/usr/bin/env python3
"""Concurrent study-plan apply in disposable audit clones; never mutates a family DB."""
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
prefix=(root/'supabase/tests/046_study_plan_calendar.test.sql').read_text().split('create function pg_temp.items')[0].replace('select no_plan();','')
claims=json.dumps({'sub':'00000000-0000-4000-8000-000000003601','role':'authenticated','gina':{'role':'parent','family_id':'00000000-0000-4000-8000-000000003611'}})
auth=f"set local role authenticated;set local request.jwt.claims='{claims}';"
results=[]
for scenario in ['same_request','same_day_different_request','different_day_stale_snapshot']:
 db='gina_plan_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,prefix+'commit;');request=str(uuid.uuid4())
  def call(req,day):return f"select public.apply_study_plan_calendar('{req}','00000000-0000-4000-8000-000000005601','2026-01-01Z',jsonb_build_array(jsonb_build_object('day',{day},'title','Reading','notes','Read together','starts_at',date_trunc('day',now())+interval '2 days 15 hours','minutes',15)));"
  calls=[call(request,1),call(request if scenario=='same_request' else str(uuid.uuid4()),2 if scenario=='different_day_stale_snapshot' else 1)]
  barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   return sql(db,"begin;set local lock_timeout='10s';"+auth+calls[i]+"select pg_sleep(0.1);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  success=sum(r.returncode==0 for r in pair)
  assert success==(2 if scenario=='same_request' else 1),[(r.returncode,r.stderr) for r in pair]
  for r in pair:
   if r.returncode:assert 'plan_changed' in r.stderr,r.stderr
  count=int(sql(db,'select count(*) from public.events;').stdout.strip());assert count==1
  results.append({'scenario':scenario,'successes':success,'events':count,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
