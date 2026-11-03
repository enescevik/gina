#!/usr/bin/env python3
"""Checks pending event deduplication under concurrency in disposable audit clones."""
import argparse,json,re,subprocess,threading,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--template',required=True);args=p.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):p.error('Explicit audit template required')
def sql(db,body):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
fixture=(Path(__file__).resolve().parents[1]/'supabase/tests/045_calendar_commands.test.sql').read_text().split('create function pg_temp.event_values')[0].replace('select no_plan();','')
results=[]
for same in [True,False]:
 db='gina_push_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   payload=json.dumps({'attempt_id':'same' if same else str(i)})
   return sql(db,"begin;select gina.enqueue_push('00000000-0000-4000-8000-000000003611','parents','exam_finished','"+payload+"');select pg_sleep(0.1);commit;")
  with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(send,[0,1]))
  count=int(sql(db,"select count(*) from public.push_outbox where kind='exam_finished';"));assert count==(1 if same else 2)
  results.append({'same_event':same,'pending_notifications':count,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
