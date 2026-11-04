#!/usr/bin/env python3
"""Explicit notification recovery races, only in disposable audit database clones."""
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
fixture=(root/'supabase/tests/062_push_operations.test.sql').read_text().split('set local role authenticated;',1)[0]
results=[]
for scenario in ['same_request','two_operators','family_deletion']:
 db='gina_push_operations_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+"insert into public.operations_members(user_id,role,expires_at) values('00000000-0000-4000-8000-000000006101','release',now()+interval '1 day');commit;")
  event=int(sql(db,'select id from public.push_outbox;').stdout.strip());request=str(uuid.uuid4());barrier=threading.Barrier(2)
  def send(i):
   actor='00000000-0000-4000-8000-00000000610'+('1' if scenario=='two_operators' and i else '2')
   req=str(uuid.uuid4()) if scenario=='two_operators' else request
   command=f"set local role authenticated;select set_config('request.jwt.claims','{{\"sub\":\"{actor}\",\"role\":\"authenticated\"}}',true);select public.release_retry_push('{req}',{event},0,'Provider configuration checked.',true);"
   if scenario=='family_deletion' and i==1:command="delete from public.families where id='10000000-0000-4000-8000-000000006101';"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='same_request':assert not errors,errors
  elif scenario=='two_operators':assert len(errors)==1 and 'push_recovery_changed' in errors[0],errors
  else:assert not errors or (len(errors)==1 and 'not_found' in errors[0]),errors
  state=json.loads(sql(db,"select jsonb_build_object('recoveries',(select count(*) from gina.push_recoveries),'revision',(select max(recovery_revision) from public.push_outbox),'accepted',(select count(*) from gina.push_deliveries where status='sent'),'other',(select count(*) from gina.push_deliveries where status<>'sent'));").stdout)
  assert state==({'recoveries':0,'revision':None,'accepted':0,'other':0} if scenario=='family_deletion' else {'recoveries':1,'revision':1,'accepted':1,'other':0}),state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
