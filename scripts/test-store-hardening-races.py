#!/usr/bin/env python3
"""S03 store hardening races; disposable audit clone, synthetic users only (no real receipts)."""
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
fixture=(root/'supabase/tests/049_atomic_store_entitlements.test.sql').read_text().split('create function pg_temp.state')[0].replace('select no_plan();','')
fam=['10000000-0000-4000-8000-00000000490%d'%i for i in (1,2)];usr=['00000000-0000-4000-8000-00000000490%d'%i for i in (1,2)]
def state(key,version,platform='apple',source='client_verify',token=None,raw=None,**extra):
 return json.dumps(dict(platform=platform,storeKey=key,productId='gina_plus_monthly',status='active',expiresAt='2027-01-01T00:00:00Z',autoRenewing=True,version=version,accountToken=token,source=source,raw=raw or {},**extra))
service="begin;set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';set local lock_timeout='10s';"
results=[]
for case in ['two_families_one_receipt_with_audit','notification_vs_client_verify','double_acknowledge_confirmation']:
 db='gina_hardening_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {a.template};')
 try:
  sql(db,fixture+'commit;')
  if case=='two_families_one_receipt_with_audit':
   # Each family verifies the same legacy receipt; the loser must record the refusal (as iap-verify does).
   calls=[f"""do $$ begin
     perform public.apply_verified_store_state('{state('legacy',100)}','{fam[i]}','{usr[i]}');
   exception when others then
     if sqlerrm='account_mismatch' then perform public.record_store_account_conflict('apple','legacy','{fam[i]}','{usr[i]}','client_verify'); else raise; end if;
   end $$;""" for i in (0,1)]
  elif case=='notification_vs_client_verify':
   calls=[f"select public.apply_verified_store_state('{state('shared',100,token=fam[0])}','{fam[0]}','{usr[0]}');",
          f"select public.apply_verified_store_state('{state('shared',100,source='notification',token=fam[0])}');"]
  else:
   sql(db,service+f"select public.apply_verified_store_state('{state('gack',100,platform='google',token=fam[0],raw={'subscription':{'acknowledgementState':'ACKNOWLEDGEMENT_STATE_PENDING'}})}');commit;")
   calls=[f"select public.apply_verified_store_state('{state('gack',101,platform='google',token=fam[0],acknowledged=True)}');" for _ in (0,1)]
  barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   return sql(db,service+calls[i]+"select pg_sleep(0.2);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,range(2)))
  assert all(x.returncode==0 for x in pair),[(x.returncode,x.stderr) for x in pair]
  if case=='two_families_one_receipt_with_audit':
   assert sql(db,"select count(*) from public.store_subscriptions where store_key='legacy';").stdout.strip()=='1'
   assert sql(db,"select count(*) from public.audit_log where action='store_subscription.account_mismatch';").stdout.strip()=='1'
   owner,refused=sql(db,"select family_id from public.store_subscriptions where store_key='legacy';").stdout.strip(),sql(db,"select family_id from public.audit_log where action='store_subscription.account_mismatch';").stdout.strip()
   assert owner!=refused and {owner,refused}==set(fam),(owner,refused)
   assert 'legacy' not in sql(db,"select details::text from public.audit_log where action='store_subscription.account_mismatch';").stdout
  elif case=='notification_vs_client_verify':
   assert sql(db,"select count(*) from public.store_subscriptions where store_key='shared';").stdout.strip()=='1'
   assert sql(db,"select notified_at is not null from public.store_subscriptions where store_key='shared';").stdout.strip()=='t'
   assert sql(db,"select raw->>'version' from public.store_subscriptions where store_key='shared';").stdout.strip()=='100'
  else:
   assert sql(db,"select count(*) from public.store_subscriptions where store_key='gack';").stdout.strip()=='1'
   assert sql(db,"select acknowledged_at is not null from public.store_subscriptions where store_key='gack';").stdout.strip()=='t'
   assert sql(db,"select count(*) from public.iap_reconcile_candidates(interval '2 days',interval '-1 second',200) where store_key='gack';").stdout.strip()=='0'
  results.append({'scenario':case,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
