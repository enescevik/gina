#!/usr/bin/env python3
"""Weekly paid context/reservation races, in explicitly owned disposable audit clones."""
import argparse,json,re,subprocess,threading,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--template',required=True);args=p.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):p.error('Explicit audit database required')
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=45)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
root=Path(__file__).resolve().parents[1]
fixture=(root/'supabase/tests/066_weekly_summary_safety.test.sql').read_text().split('set local role authenticated;',1)[0]
family='10000000-0000-0000-0000-0000000000e1';child='20000000-0000-0000-0000-00000000e1c1';lease='00000000-0000-4000-8000-000000008811'
service="set local role service_role;select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);"
fixture+=f"insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('{family}','pro','test',now()+interval '1 day');commit;"
# pg_temp helpers only live in their fixture session; reusable definitions are replayed per request.
helpers=(root/'supabase/tests/066_weekly_summary_safety.test.sql').read_text().split('create function pg_temp.week(',1)[1].split('insert into public.task_templates',1)[0]
helpers='create function pg_temp.week('+helpers
result=[]
for scenario in ['same_week','quota','store_replay','child_deletion']:
 db='gina_weekly_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture)
  if scenario=='quota':sql(db,"update public.ai_operation_policies set monthly_limit=1,max_concurrent=10 where action='weekly' and plan_code='pro';")
  context=job=None
  if scenario in ['store_replay','child_deletion']:
   sql(db,helpers+'begin;'+service+"select pg_temp.reserve((pg_temp.prepare()->>'id')::uuid);commit;")
   context=sql(db,'select id from gina.weekly_summary_contexts;').stdout.strip()
   job=sql(db,"select id from public.ai_operation_jobs where action='weekly';").stdout.strip()
   if scenario=='store_replay':sql(db,'begin;'+service+f"select public.finish_ai_operation('{job}','{lease}','{{\"output\":{{\"synthetic\":true}},\"inputTokens\":1,\"outputTokens\":1}}');commit;")
  barrier=threading.Barrier(2)
  def send(i):
   if scenario in ['same_week','quota']:command=f"select pg_temp.reserve((pg_temp.prepare(pg_temp.week({i+1 if scenario=='quota' else 1}))->>'id')::uuid);"
   elif scenario=='store_replay':command=f"select pg_temp.store('{context}','{job}');"
   else:command=f"select public.finish_ai_operation('{job}','{lease}','{{\"output\":{{\"synthetic\":true}}}}');select pg_temp.store('{context}','{job}');" if i==0 else f"reset role;delete from public.children where id='{child}';"
   barrier.wait(timeout=10)
   return sql(db,helpers+"begin;set local lock_timeout='10s';"+service+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='child_deletion':assert not errors or (len(errors)==1 and any(x in errors[0] for x in ['lease_lost','weekly_result_unavailable'])),errors
  else:assert not errors,errors
  state=json.loads(sql(db,"select jsonb_build_object('contexts',(select count(*) from gina.weekly_summary_contexts),'jobs',(select count(*) from public.ai_operation_jobs where action='weekly'),'summaries',(select count(*) from public.ai_summaries),'results',(select count(*) from public.ai_operation_jobs where action='weekly' and result is not null));").stdout)
  expected={'contexts':0 if scenario=='child_deletion' else 2 if scenario=='quota' else 1,'jobs':1,'summaries':1 if scenario=='store_replay' else 0,'results':1 if scenario=='store_replay' else 0}
  assert state==expected,(scenario,state,expected)
  if scenario=='same_week':assert sum('generation_in_progress' in r.stdout for r in pair)==1
  if scenario=='quota':assert sum('ai_quota_exceeded' in r.stdout for r in pair)==1
  result.append(dict(scenario=scenario,passed=True,state=state))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(result,indent=2))
