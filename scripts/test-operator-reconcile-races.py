#!/usr/bin/env python3
"""Operator reconciliation races in disposable audit clones only."""
import argparse,json,re,subprocess,threading,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--template',required=True);a=p.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',a.template):p.error('Explicit audit template required')
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
root=Path(__file__).resolve().parents[1]
fixture=(root/'supabase/tests/052_operator_reconciliation.test.sql').read_text().split('create function pg_temp.state')[0].replace('select no_plan();','')
family='10000000-0000-4000-8000-000000005201';subscription='20000000-0000-4000-8000-000000005201'
operator="set local role authenticated;set local request.jwt.claims='"+json.dumps({'sub':'00000000-0000-4000-8000-000000005201','role':'authenticated','gina':{'role':'none'}})+"';"
service="set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';"
def enqueue(req):return f"select public.finance_request_reconcile('{req}','{family}','{subscription}','Check state');"
def lastjson(result):return json.loads(next(line for line in result.stdout.splitlines() if line.startswith('{')))
results=[]
for case in ['same_request','two_requests','two_workers','two_completions']:
 db='gina_operator_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {a.template};')
 try:
  sql(db,fixture+'commit;');req=str(uuid.uuid4())
  if case in ['two_workers','two_completions']:sql(db,'begin;'+operator+enqueue(req)+'commit;')
  if case=='two_completions':lease=lastjson(sql(db,'begin;'+service+f"select public.claim_operator_reconcile('{req}');commit;"))['token']
  barrier=threading.Barrier(2)
  def send(i):
   if case in ['same_request','two_requests']:body=operator+enqueue(str(uuid.uuid4()) if case=='two_requests' else req)
   elif case=='two_workers':body=service+f"select public.claim_operator_reconcile('{req}');"
   else:body=service+f"select public.finish_operator_reconcile('{req}','{lease}',null,'no_data');"
   barrier.wait(timeout=10)
   return sql(db,'begin;'+body+'select pg_sleep(0.15);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  expected=1 if case in ['two_requests','two_completions'] else 2
  assert sum(r.returncode==0 for r in pair)==expected,[(r.returncode,r.stderr) for r in pair]
  if case=='two_workers':assert sorted(lastjson(r)['status'] for r in pair)==['busy','claimed']
  if case=='two_requests':assert 'reconcile_pending' in next(r.stderr for r in pair if r.returncode)
  if case=='two_completions':assert 'reconcile_lease_lost' in next(r.stderr for r in pair if r.returncode)
  assert sql(db,'select count(*) from gina.store_reconcile_jobs;').stdout.strip()=='1'
  results.append({'scenario':case,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
