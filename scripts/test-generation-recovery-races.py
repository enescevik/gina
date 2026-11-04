#!/usr/bin/env python3
"""Paid request/cancellation races, only in explicit disposable audit clones."""
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
fixture=(root/'supabase/tests/058_generation_recovery.test.sql').read_text().split('set local role authenticated;',1)[0].replace('select no_plan();','')
helpers=fixture[fixture.index('create function pg_temp.intent()'):]
parent="set local role authenticated;set local request.jwt.claims='{\"role\":\"authenticated\",\"sub\":\"00000000-0000-4000-8000-000000005801\",\"gina\":{\"role\":\"parent\",\"family_id\":\"10000000-0000-4000-8000-000000005801\"}}';"
service="set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';"
results=[]
for scenario in ['same_request','changed_context','cancel_reserve','same_cancel']:
 db='gina_generation_recovery_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4());barrier=threading.Barrier(2)
  def send(i):
   if scenario=='same_cancel' or (scenario=='cancel_reserve' and i==1):command=parent+f"select public.cancel_unstarted_generation('{request}',pg_temp.intent());"
   else:command=service+f"select pg_temp.reserve('{request}',pg_temp.context()"+(f"||'{{\"model\":\"model-{i}\"}}'" if scenario=='changed_context' else '')+");"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+helpers+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  for r in pair:
   if r.returncode:assert scenario=='cancel_reserve' and 'generation_cannot_cancel' in r.stderr,r.stderr
  state=json.loads(sql(db,"select jsonb_build_object('jobs',(select count(*) from public.prova_generation_jobs),'contexts',(select count(*) from gina.prova_generation_contexts),'cancellations',(select count(*) from gina.prova_generation_cancellations),'allocations',(select count(*) from public.generation_credit_allocations));").stdout)
  assert state['jobs']==state['contexts']==state['allocations']
  if scenario in ['same_request','changed_context']:assert state['jobs']==1 and sum('"lease"' in r.stdout for r in pair)==1
  if scenario=='same_cancel':assert state['jobs']==0 and state['cancellations']==1 and all(r.returncode==0 for r in pair)
  if scenario=='cancel_reserve':assert (state['jobs'],state['cancellations']) in [(1,0),(0,1)],state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
