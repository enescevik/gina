#!/usr/bin/env python3
"""Override commands race only in disposable audit clones."""
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
fixture=(root/'supabase/tests/051_override_commands.test.sql').read_text().split("select set_config('test.override'")[0].replace('select no_plan();','')
claims=json.dumps({'sub':'00000000-0000-4000-8000-000000005101','role':'authenticated','gina':{'admin':True,'role':'none'}})
auth=f"set local role authenticated;set local request.jwt.claims='{claims}';"
body="jsonb_build_object('action','grant','family_id','10000000-0000-4000-8000-000000005101','plan','pro','reason','Test reason','starts_at','2026-11-04T00:00:00Z','ends_at','2027-01-01T00:00:00Z')"
# Relative fixed timestamps are computed once so concurrent payloads are byte-identical.
body=body.replace("'2026-11-04T00:00:00Z'", "'"+sql(a.template,"select now()::text;").stdout.strip()+"'").replace("'2027-01-01T00:00:00Z'", "'"+sql(a.template,"select (now()+interval '30 days')::text;").stdout.strip()+"'")
results=[]
for case in ['same_grant','changed_payload','same_expiration']:
 db='gina_override_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {a.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4());payload=body
  if case=='same_expiration':
   receipt=sql(db,'begin;'+auth+f"select public.admin_save_override('{uuid.uuid4()}',{body});commit;").stdout
   target=json.loads(next(line for line in receipt.splitlines() if line.startswith('{')))['override_id']
   payload=f"jsonb_build_object('action','expire','override_id','{target}','reason','End test')"
  barrier=threading.Barrier(2)
  def send(i):
   command=payload+"||'{\"plan\":\"plus\"}'::jsonb" if case=='changed_payload' and i else payload
   barrier.wait(timeout=10)
   return sql(db,'begin;'+auth+f"select public.admin_save_override('{request}',{command});select pg_sleep(0.2);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  assert sum(r.returncode==0 for r in pair)==(1 if case=='changed_payload' else 2),[(r.returncode,r.stderr) for r in pair]
  if case=='changed_payload':assert 'request_conflict' in next(r.stderr for r in pair if r.returncode)
  assert sql(db,'select count(*) from public.entitlement_overrides;').stdout.strip()=='1'
  if case=='same_expiration':assert sql(db,"select count(*) from public.audit_log where action='entitlement_overrides.expire';").stdout.strip()=='1'
  results.append({'scenario':case,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
