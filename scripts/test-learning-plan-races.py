#!/usr/bin/env python3
"""Dated-plan races; only disposable clones of an explicit audit database."""
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
fixture=(root/'supabase/tests/067_learning_plan.test.sql').read_text().split('set local role authenticated;',1)[0]
child='20000000-0000-0000-0000-00000000e1c1';other='20000000-0000-0000-0000-00000000e1c2';family='10000000-0000-0000-0000-0000000000e1';actors=['00000000-0000-0000-0000-00000000e101','00000000-0000-0000-0000-00000000e1d1']
body="jsonb_build_object('kind','homework','title','Kesirler','subject','Matematik','topic','','planned_on',(now() at time zone 'Europe/Istanbul')::date,'due_on',null,'time',null,'steps','[]'::jsonb,'done',false,'archived',false,'source_id',null)"
def auth(actor):
 claim={'sub':actor,'role':'authenticated','gina':{'family_id':family,'role':'device' if actor==actors[1] else 'parent'}}
 if actor==actors[1]:claim['gina'].update(child_id=child,device_id='30000000-0000-0000-0000-00000000e1c1')
 return f"set local role authenticated;select set_config('request.jwt.claims','{json.dumps(claim)}',true);"
results=[]
for scenario in ['same_request','parent_child','same_id_different_children','child_deletion']:
 db='gina_learning_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4());item=str(uuid.uuid4());barrier=threading.Barrier(2)
  if scenario=='parent_child':sql(db,"begin;"+auth(actors[0])+f"select public.save_learning_plan(gen_random_uuid(),'{child}','{item}',0,{body});commit;")
  def send(i):
   actor=actors[i] if scenario=='parent_child' else actors[0]
   owner=other if scenario=='same_id_different_children' and i==1 else child
   req=str(uuid.uuid4()) if scenario in ['parent_child','same_id_different_children'] else request
   value=body+"||'{\"done\":true}'::jsonb" if scenario=='parent_child' else body
   command=auth(actor)+f"select public.save_learning_plan('{req}','{owner}','{item}',{1 if scenario=='parent_child' else 0},{value});"
   if scenario=='child_deletion' and i==1:command=f"delete from public.children where id='{child}';"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='same_request':assert not errors,errors
  elif scenario=='parent_child':assert len(errors)==1 and 'plan_changed' in errors[0],errors
  elif scenario=='same_id_different_children':assert len(errors)==1 and 'plan_forbidden' in errors[0],errors
  else:assert not errors or (len(errors)==1 and 'plan_forbidden' in errors[0]),errors
  state=json.loads(sql(db,"select jsonb_build_object('rows',(select count(*) from gina.learning_plan),'revision',(select coalesce(max(revision),0) from gina.learning_plan),'stars',(select count(*) from public.star_events));").stdout)
  assert state=={'rows':0 if scenario=='child_deletion' else 1,'revision':0 if scenario=='child_deletion' else 2 if scenario=='parent_child' else 1,'stars':0},state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
