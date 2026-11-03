#!/usr/bin/env python3
"""Concurrent setup saves in disposable audit clones, never a family DB."""
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
fixture=(root/'supabase/tests/031_setup_batch.test.sql').read_text().split("select set_config('test.batch'")[0].replace('select no_plan();','')
claims=json.dumps({'sub':'00000000-0000-4000-8000-000000003101','role':'authenticated','gina':{'role':'parent','family_id':'10000000-0000-4000-8000-000000003101'}})
auth=f"set local role authenticated;set local request.jwt.claims='{claims}';"
results=[]
for scenario in ['same_task','same_reward','last_task_slot']:
 db='gina_setup_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4())
  if scenario=='last_task_slot':sql(db,"update public.plans set max_active_tasks_per_child=1 where code='free';")
  kind='reward' if scenario=='same_reward' else 'task'
  items=json.dumps([{'title':'Reading','icon':'read-book' if kind=='task' else 'reward-book','stars':0 if kind=='task' else 20,'days':[1,3],'starts_on':'2026-11-04'}])
  child="'20000000-0000-4000-8000-000000003101'" if kind=='task' else 'null'
  barrier=threading.Barrier(2)
  def send(i):
   req=str(uuid.uuid4()) if scenario=='last_task_slot' else request
   barrier.wait(timeout=10)
   return sql(db,"begin;set local lock_timeout='10s';"+auth+f"select public.save_setup_batch('{req}','{kind}','{items}',{child});select pg_sleep(0.1);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  successes=sum(r.returncode==0 for r in pair)
  assert successes==(1 if scenario=='last_task_slot' else 2),[(r.returncode,r.stderr) for r in pair]
  for r in pair:
   if r.returncode:assert 'plan_limit_tasks' in r.stderr,r.stderr
  table='task_templates' if kind=='task' else 'family_rewards'
  count=int(sql(db,f"select count(*) from public.{table};").stdout.strip())
  assert count==1,count
  results.append({'scenario':scenario,'successes':successes,'rows':count,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
