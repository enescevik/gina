#!/usr/bin/env python3
"""Atomic entitlement races; disposable audit clone, synthetic users only."""
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
family='10000000-0000-4000-8000-000000004901'
def state(key,version,platform='apple',**extra):
 return json.dumps(dict(platform=platform,storeKey=key,productId='gina_plus_monthly',status='active',expiresAt='2027-01-01T00:00:00Z',autoRenewing=True,version=version,accountToken=family,raw={},**extra))
def apply(body,context=''):return f"select public.apply_verified_store_state('{body}'{context});"
results=[]
for case in ['revision_order','first_claim_two_families','replacement_vs_late_old']:
 db='gina_storestate_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {a.template};')
 try:
  sql(db,fixture+'commit;')
  if case=='revision_order':calls=[apply(state('revision',100)),apply(state('revision',200))]
  elif case=='first_claim_two_families':
   body=json.loads(state('legacy',100));body['accountToken']=None
   calls=[apply(json.dumps(body),f",'10000000-0000-4000-8000-00000000490{i}','00000000-0000-4000-8000-00000000490{i}'") for i in [1,2]]
  else:
   sql(db,apply(state('old',100,'google')))
   calls=[apply(state('new',200,'google',replacesStoreKey='old')),apply(state('old',300,'google'))]
  barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   return sql(db,"begin;set local role service_role;set local lock_timeout='10s';"+calls[i]+"select pg_sleep(0.2);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,range(2)))
  if case=='first_claim_two_families':
   assert sum(x.returncode==0 for x in pair)==1,[(x.returncode,x.stderr) for x in pair]
   assert 'account_mismatch' in next(x.stderr for x in pair if x.returncode)
   assert sql(db,"select count(*) from public.store_subscriptions where store_key='legacy';").stdout.strip()=='1'
  else:
   assert all(x.returncode==0 for x in pair),[(x.returncode,x.stderr) for x in pair]
   if case=='revision_order':assert sql(db,"select raw->>'version' from public.store_subscriptions where store_key='revision';").stdout.strip()=='200'
   else:assert sql(db,"select status from public.store_subscriptions where store_key='old';").stdout.strip()=='expired'
  results.append({'scenario':case,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
