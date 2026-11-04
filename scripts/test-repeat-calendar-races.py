#!/usr/bin/env python3
"""Reminder idempotency/review/delete races, only disposable audit database clones."""
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
fixture=(root/'supabase/tests/063_repeat_calendar.test.sql').read_text().split('create function pg_temp.source()',1)[0]
actor='00000000-0000-4000-8000-000000003601';family='00000000-0000-4000-8000-000000003611';attempt='00000000-0000-4000-8000-000000003901';question='00000000-0000-4000-8000-000000003702'
claims=json.dumps({'sub':actor,'role':'authenticated','gina':{'role':'parent','family_id':family}})
results=[]
for scenario in ['same_request','two_requests','review_change','child_deletion']:
 db='gina_repeat_calendar_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4())
  source=json.loads(sql(db,f"select gina.repeat_calendar_source('{attempt}','{family}');").stdout)
  items=sql(db,"select jsonb_build_array(jsonb_build_object('day',1,'title','Birlikte tekrar','notes','Çözümü birlikte konuşun.','starts_at',now()+interval '1 day','minutes',15));").stdout.strip()
  barrier=threading.Barrier(2)
  def send(i):
   req=str(uuid.uuid4()) if scenario=='two_requests' else request
   command=f"set local role authenticated;select set_config('request.jwt.claims','{claims}',true);select public.apply_repeat_calendar('{req}','{attempt}','{source['hash']}',array['{question}'::uuid],'{items}'::jsonb);"
   if i==1 and scenario=='review_change':command=f"select id from public.exam_attempts where id='{attempt}' for update;update public.exam_answers set is_correct=true where attempt_id='{attempt}' and question_id='{question}';"
   if i==1 and scenario=='child_deletion':command="delete from public.children where id='00000000-0000-4000-8000-000000003621';"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='same_request':assert not errors,errors
  elif scenario=='two_requests':assert len(errors)==1 and 'repeat_applied' in errors[0],errors
  else:assert not errors or (len(errors)==1 and any(x in errors[0] for x in ['repeat_changed','forbidden'])),errors
  state=json.loads(sql(db,"select jsonb_build_object('batches',(select count(*) from gina.repeat_calendar_batches),'events',(select count(*) from public.events));").stdout)
  expected=0 if scenario=='child_deletion' or (scenario=='review_change' and errors) else 1
  assert state=={'batches':expected,'events':expected},state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
