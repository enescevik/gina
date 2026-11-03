#!/usr/bin/env python3
"""Real concurrency on disposable clones only; no provider or family data."""
import argparse,json,re,subprocess,threading,uuid,time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('explicit audit template required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
fixture=(root/'supabase/tests/053_document_setup.test.sql').read_text().split('set local role authenticated;')[0].replace('select no_plan();','')
family='10000000-0000-4000-8000-000000005301';user='00000000-0000-4000-8000-000000005301';child='20000000-0000-4000-8000-000000005301';source='40000000-0000-4000-8000-000000005301'
auth="set local role authenticated;set local request.jwt.claims='"+json.dumps({'sub':user,'role':'authenticated','gina':{'role':'parent','family_id':family}})+"';"
service="set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';"
results=[]
for scenario in ['same_generation','same_linked_save','cleanup_during_save','delete_before_save']:
 db='gina_doc_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');req=str(uuid.uuid4());barrier=threading.Barrier(2)
  items=json.dumps([{'title':'Read','icon':'read-book','stars':1,'days':[1],'source_id':source}])
  save=f"select public.save_setup_batch('{req}','task','{items}','{child}');"
  if scenario in ['same_generation','same_linked_save']:
   def run(i):
    barrier.wait(timeout=10)
    stmt=service+f"select public.reserve_setup_generation('{req}','{family}','{user}',repeat('a',64),'{uuid.uuid4()}');" if scenario=='same_generation' else auth+save
    return sql(db,"begin;set local lock_timeout='10s';"+stmt+"select pg_sleep(.15);commit;")
   with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(run,[0,1]))
   if scenario=='same_generation':
    assert sum('"ok": true' in r.stdout for r in pair)==1
    assert sum('generation_in_progress' in r.stdout for r in pair)==1
   else:
    assert sql(db,'select count(*) from public.task_templates;select count(*) from public.learning_source_links;').stdout.strip().splitlines()==['1','1']
  else:
   label='gina_doc_hold_'+uuid.uuid4().hex
   def hold():
    stmt=auth+save if scenario=='cleanup_during_save' else f"delete from public.learning_sources where id='{source}';"
    return sql(db,f"begin;set local application_name='{label}';"+stmt+'select pg_sleep(2);commit;')
   with ThreadPoolExecutor(max_workers=1) as pool:
    future=pool.submit(hold)
    for _ in range(80):
     if sql(db,f"select count(*) from pg_stat_activity where application_name='{label}' and wait_event='PgSleep';").stdout.strip()=='1':break
     time.sleep(.025)
    else:raise AssertionError('holder did not acquire locks')
    if scenario=='cleanup_during_save':
     sql(db,'begin;'+service+'select public.expire_unlinked_learning_sources();commit;');future.result()
     assert sql(db,f"select count(*) from public.learning_sources where id='{source}';select count(*) from public.learning_source_links;").stdout.strip().splitlines()==['1','1']
    else:
     result=sql(db,'begin;'+auth+save+'commit;',False);future.result();assert result.returncode!=0 and 'source_not_ready' in result.stderr
     assert sql(db,'select count(*) from public.task_templates;').stdout.strip()=='0'
  results.append({'scenario':scenario,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
