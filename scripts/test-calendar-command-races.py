#!/usr/bin/env python3
"""Concurrent calendar mutations in disposable audit clones, never a family DB."""
import argparse,json,re,subprocess,threading,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('An explicit audit template is required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
prefix=(root/'supabase/tests/045_calendar_commands.test.sql').read_text().split('create function pg_temp.event_values')[0].replace('select no_plan();','')
claims=json.dumps({'sub':'00000000-0000-4000-8000-000000003601','role':'authenticated','gina':{'role':'parent','family_id':'00000000-0000-4000-8000-000000003611'}})
auth=f"set local role authenticated;set local request.jwt.claims='{claims}';"
values=json.dumps({'title':'Reading','type':'activity','child_id':'00000000-0000-4000-8000-000000003621','starts_at':'2026-11-04T15:00:00Z','ends_at':'2026-11-04T15:30:00Z','all_day':False,'location':None,'rrule':None})
results=[]
for scenario in ['same_request','different_create_requests','concurrent_edits','edit_vs_delete']:
 db='gina_calendar_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,prefix+'commit;');event=str(uuid.uuid4());request=str(uuid.uuid4());revision=0
  def call(req,rev,val):return f"select public.save_calendar_event('{req}','{event}',{rev},{val});"
  body="'"+values+"'::jsonb"
  if scenario in ['concurrent_edits','edit_vs_delete']:
   sql(db,'begin;'+auth+call(str(uuid.uuid4()),0,body)+'commit;');revision=1
  calls=[call(request,revision,body),call(request if scenario=='same_request' else str(uuid.uuid4()),revision,'null' if scenario=='edit_vs_delete' else body)]
  barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   return sql(db,"begin;set local lock_timeout='10s';"+auth+calls[i]+"select pg_sleep(0.1);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool: pair=list(pool.map(send,[0,1]))
  success=sum(r.returncode==0 for r in pair)
  assert success==(2 if scenario=='same_request' else 1),[(r.returncode,r.stderr) for r in pair]
  for r in pair:
   if r.returncode:assert 'event_changed' in r.stderr,r.stderr
  count=int(sql(db,f"select count(*) from public.events where id='{event}';").stdout.strip())
  assert count in ([0,1] if scenario=='edit_vs_delete' else [1])
  results.append({'scenario':scenario,'successes':success,'events':count,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
