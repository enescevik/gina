#!/usr/bin/env python3
"""Manual timetable receipt/revision races in disposable audit database clones."""
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
fixture=(root/'supabase/tests/064_timetable_save_receipts.test.sql').read_text().split('create function pg_temp.lessons()',1)[0]
child='20000000-0000-0000-0000-00000000e1c1';family='10000000-0000-0000-0000-0000000000e1'
actors=['00000000-0000-0000-0000-00000000e101','00000000-0000-0000-0000-00000000e1d1']
lessons='[{"id":"one","day":1,"title":"Matematik","start":"09:00","end":"09:40"}]'
settings='{"start":"09:00","duration":40,"break":10}'
results=[]
for scenario in ['same_request','parent_child','legacy_writer','child_deletion']:
 db='gina_timetable_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4());barrier=threading.Barrier(2)
  def send(i):
   actor=actors[i] if scenario=='parent_child' else actors[0]
   claim={'sub':actor,'role':'authenticated','gina':{'family_id':family,'role':'device' if actor==actors[1] else 'parent'}}
   if actor==actors[1]:claim['gina'].update(child_id=child,device_id='30000000-0000-0000-0000-00000000e1c1')
   req=str(uuid.uuid4()) if scenario=='parent_child' else request
   command=f"set local role authenticated;select set_config('request.jwt.claims','{json.dumps(claim)}',true);"
   command+=f"select public.save_school_timetable_request('{req}','{child}',0,'{lessons}','{settings}');" if not(scenario=='legacy_writer' and i==1) else f"select public.save_school_timetable('{child}',0,'{lessons}','{settings}');"
   if scenario=='child_deletion' and i==1:command=f"delete from public.children where id='{child}';"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='same_request':assert not errors,errors
  elif scenario in ('parent_child','legacy_writer'):assert len(errors)==1 and 'timetable_conflict' in errors[0],errors
  else:assert not errors or (len(errors)==1 and 'timetable_forbidden' in errors[0]),errors
  state=json.loads(sql(db,"select jsonb_build_object('programs',(select count(*) from public.school_timetables),'revision',(select coalesce(max(revision),0) from public.school_timetables),'lessons',(select count(*) from public.events where timetable_entry_key is not null));").stdout)
  expected=0 if scenario=='child_deletion' else 1
  assert state=={'programs':expected,'revision':expected,'lessons':expected},state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
