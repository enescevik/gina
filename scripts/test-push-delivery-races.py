#!/usr/bin/env python3
"""Push leases and device receipt races, in explicitly named disposable audit clones."""
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
fixture=(root/'supabase/tests/061_push_delivery_recovery.test.sql').read_text().split('set local role authenticated;',1)[0]
claim="select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.push_claim_v2(1)c;"
def rows(output):return json.loads(next(x for x in output.splitlines() if x.startswith('[')))
results=[]
for scenario in ['same_event_claim','same_device_receipt','expired_worker']:
 db='gina_push_delivery_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');lease=None
  if scenario!='same_event_claim':
   row=rows(sql(db,'begin;set local role service_role;'+claim+'commit;').stdout)[0];lease=row['lease_id']
   if scenario=='expired_worker':sql(db,"update public.push_outbox set claimed_at=now()-interval '6 minutes';")
  barrier=threading.Barrier(2)
  def send(i):
   command=claim if scenario=='same_event_claim' or (scenario=='expired_worker' and i==0) else f"select public.push_record_delivery({row['id']},'{lease}','20000000-0000-4000-8000-000000006101',encode(extensions.digest('qa-token-one','sha256'),'hex'),'sent');"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';set local role service_role;"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='expired_worker':assert len(errors)==1 and 'push_lease_changed' in errors[0],errors
  else:assert not errors,errors
  if scenario=='same_event_claim':assert sum(len(rows(r.stdout)) for r in pair)==1
  state=json.loads(sql(db,"select jsonb_build_object('attempts',(select attempts from public.push_outbox),'receipts',(select count(*) from gina.push_deliveries),'receipt_attempts',(select max(attempts) from gina.push_deliveries));").stdout)
  assert state['attempts']==(2 if scenario=='expired_worker' else 1),state
  assert state['receipts']==(1 if scenario=='same_device_receipt' else 0),state
  if scenario=='same_device_receipt':assert state['receipt_attempts']==1,state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
