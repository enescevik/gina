#!/usr/bin/env python3
"""Submission identity races in disposable audit clones; never an application DB."""
import argparse,json,re,subprocess,threading,uuid,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
p=argparse.ArgumentParser();p.add_argument('--template',required=True);args=p.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):p.error('Explicit audit template required')
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=40)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
root=Path(__file__).resolve().parents[1]
fixture=(root/'supabase/tests/068_task_submission_receipts.test.sql').read_text().split('-- Legacy/service imported row',1)[0]
child='20000000-0000-0000-0000-0000000000a1';task='40000000-0000-0000-0000-0000000000a1';other='40000000-0000-0000-0000-0000000000a3'
auth="set local role authenticated;select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-0000-0000-00000000a001\",\"role\":\"authenticated\",\"gina\":{\"family_id\":\"10000000-0000-0000-0000-00000000000a\",\"role\":\"parent\"}}',true);"
results=[]
for scenario in ['same_request','same_id_other_task','two_devices_one_award','old_replay_new_submission','undo_replay','approval_undo']:
 db='gina_submission_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4());new=str(uuid.uuid4());barrier=threading.Barrier(2)
  sendcall=lambda req,target=task:f"select public.complete_task('{target}',current_date,'{req}','{child}');"
  if scenario=='two_devices_one_award':sql(db,f"update public.task_templates set requires_approval=false where id='{task}';")
  if scenario in ['old_replay_new_submission','undo_replay','approval_undo']:
   sql(db,'begin;'+auth+sendcall(request)+("select public.review_task((select id from public.task_completions),false);" if scenario=='old_replay_new_submission' else '')+'commit;')
  def send(i):
   command=sendcall(new if i==1 and scenario in ['two_devices_one_award','old_replay_new_submission'] else request,other if scenario=='same_id_other_task' and i==1 else task)
   if scenario=='undo_replay' and i==1:command="select public.undo_complete((select id from public.task_completions));"
   barrier.wait(timeout=10)
   if scenario=='approval_undo':
    if i==0:return sql(db,"begin;set local application_name='gina_review_race';"+auth+"select public.review_task((select id from public.task_completions),true);select pg_sleep(1.5);commit;",False)
    for _ in range(30):
     if sql(db,"select count(*) from pg_stat_activity where datname=current_database() and application_name='gina_review_race' and wait_event='PgSleep';").stdout.strip()=='1':break
     time.sleep(.03)
    else:raise AssertionError('review transaction never reached deterministic gate')
    command="select public.undo_complete((select id from public.task_completions));"
   return sql(db,"begin;set local lock_timeout='10s';"+auth+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='same_id_other_task':assert len(errors)==1 and 'completion_request_conflict' in errors[0],errors
  elif scenario=='approval_undo':assert len(errors)==1 and 'already_reviewed' in errors[0],errors
  elif scenario=='undo_replay':assert not errors or (len(errors)==1 and 'completion_withdrawn' in errors[0]),errors
  else:assert not errors,errors
  state=json.loads(sql(db,"select jsonb_build_object('rows',(select count(*) from public.task_completions),'receipts',(select count(*) from gina.task_submission_receipts),'withdrawn',(select count(*) from gina.task_submission_receipts where completion_id is null),'stars',(select coalesce(sum(delta),0) from public.star_events));").stdout)
  assert state=={'rows':0 if scenario=='undo_replay' else 1,'receipts':2 if scenario in ['two_devices_one_award','old_replay_new_submission'] else 1,'withdrawn':1 if scenario=='undo_replay' else 0,'stars':2 if scenario in ['two_devices_one_award','approval_undo'] else 0},state
  if scenario=='old_replay_new_submission':assert sql(db,'select client_id from public.task_completions;').stdout.strip()==new
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
