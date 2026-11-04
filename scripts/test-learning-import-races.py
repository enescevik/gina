#!/usr/bin/env python3
"""Document plan atomic application: disposable clones of an explicit audit DB only."""
import argparse,json,re,subprocess,threading,uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
p=argparse.ArgumentParser();p.add_argument('--template',required=True);args=p.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):p.error('Explicit audit template required')
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=40)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
root=Path(__file__).resolve().parents[1]
fixture=(root/'supabase/tests/069_learning_plan_import.test.sql').read_text().split('set local role service_role;',1)[0]
child='20000000-0000-0000-0000-00000000e1c1';family='10000000-0000-0000-0000-0000000000e1';user='00000000-0000-0000-0000-00000000e101';source='40000000-0000-4000-8000-000000009101'
claim={'sub':user,'role':'authenticated','gina':{'family_id':family,'role':'parent'}}
auth="set local role authenticated;select set_config('request.jwt.claims','"+json.dumps(claim)+"',true);"
service="set local role service_role;select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);"
results=[]
for scenario in ['same_request','two_devices_same_selection','source_deletion','child_deletion','two_paid_reservations']:
 db='gina_import_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;')
  context=json.loads(sql(db,"begin;"+service+f"select public.prepare_learning_plan_import('{family}','{user}','{child}','{source}','tr','{{\"config\":{{\"model\":\"claude-sonnet-5-5\"}},\"system\":\"test\",\"schema\":{{}}}}');commit;").stdout.splitlines()[-2])['id']
  if scenario!='two_paid_reservations':
   sql(db,"begin;"+service+f"with job as(select public.reserve_learning_plan_import('{family}','{user}','{context}','00000000-0000-4000-8000-000000009111') r) select public.finish_ai_operation((r->>'id')::uuid,'00000000-0000-4000-8000-000000009111','{{\"output\":{{\"items\":[{{\"title\":\"Kesirler\"}}],\"warnings\":[]}},\"inputTokens\":1,\"outputTokens\":1}}') from job;commit;")
  request=str(uuid.uuid4());item=str(uuid.uuid4());barrier=threading.Barrier(2)
  content="jsonb_build_object('kind','homework','title','Kesirler','subject','Matematik','topic','','planned_on',(now() at time zone 'Europe/Istanbul')::date,'due_on',null,'time',null,'steps','[]'::jsonb,'done',false,'archived',false,'source_id','"+source+"')"
  def send(i):
   req=str(uuid.uuid4()) if scenario=='two_devices_same_selection' and i else request
   command=auth+f"select public.apply_learning_plan_import('{req}','{child}','{context}',jsonb_build_array(jsonb_build_object('index',0,'id','{item}','content',{content})));"
   if scenario=='child_deletion' and i:command=f"delete from public.children where id='{child}';"
   if scenario=='source_deletion' and i:command=f"delete from public.learning_sources where id='{source}';"
   if scenario=='two_paid_reservations':command=service+f"select public.reserve_learning_plan_import('{family}','{user}','{context}','{uuid.uuid4()}');"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='same_request':assert not errors,errors
  elif scenario=='two_devices_same_selection':assert len(errors)==1 and 'plan_import_already_applied' in errors[0],errors
  elif scenario in ['source_deletion','child_deletion']:assert not errors or len(errors)==1 and any(s in errors[0] for s in ['source_not_ready','plan_import_unavailable','plan_forbidden','plan_import_forbidden']),errors
  else:assert not errors and sum('generation_in_progress' in r.stdout for r in pair)==1,[(r.stdout,r.stderr) for r in pair]
  state=json.loads(sql(db,"select jsonb_build_object('rows',(select count(*) from gina.learning_plan),'jobs',(select count(*) from public.ai_operation_jobs),'sources',(select count(*) from public.learning_sources),'derived',(select count(*) from public.ai_operation_jobs where result is not null));").stdout)
  assert state['jobs']==1,state
  if scenario in ['same_request','two_devices_same_selection']:assert state['rows']==1,state
  if scenario=='child_deletion':assert state['rows']==0 and state['derived']==0,state
  if scenario=='source_deletion':assert state['rows'] in [0,1] and state['sources']==1 and state['derived']==0,state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
