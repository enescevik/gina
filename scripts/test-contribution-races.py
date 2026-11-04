#!/usr/bin/env python3
"""Concurrent sharing/moderation only in disposable audit database clones."""
import argparse,json,re,subprocess,threading,uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('Explicit audit template required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
source=(root/'supabase/tests/055_contribution_sets.test.sql').read_text()
fixture=source.split('set local role authenticated;',1)[0].replace('select no_plan();','')
helpers=fixture[fixture.index('create function pg_temp.media()'):]
def auth(role):
 claims={'role':'service_role'} if role=='service_role' else {'role':'authenticated','sub':'00000000-0000-4000-8000-00000000550'+('3' if role=='admin' else '1'),'gina':{'role':'parent','admin':role=='admin','family_id':'10000000-0000-4000-8000-000000005501'}}
 return 'set local role '+('service_role' if role=='service_role' else 'authenticated')+";set local request.jwt.claims='"+json.dumps(claims)+"';"
cid='60000000-0000-4000-8000-000000005501';qid='40000000-0000-4000-8000-000000005501'
begin=f"select public.begin_question_contribution('{cid}','{qid}',true,true);"
copy=f"select public.finish_question_contribution('00000000-0000-4000-8000-000000005501','10000000-0000-4000-8000-000000005501','{cid}',pg_temp.media());"
results=[]
for scenario in ['same_begin','withdraw_vs_copy','same_accept','accept_vs_reject']:
 db='gina_contribution_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+"update public.app_settings set value='true' where key='contribution_sets.enabled';commit;")
  if scenario!='same_begin':sql(db,'begin;'+auth('parent')+begin+'commit;')
  if 'accept' in scenario:sql(db,'begin;'+helpers+auth('service_role')+copy+'commit;')
  request=str(uuid.uuid4());barrier=threading.Barrier(2)
  def send(i):
   if scenario=='same_begin':body=auth('parent')+begin
   elif scenario=='withdraw_vs_copy':body=auth('parent')+f"select public.withdraw_question_contribution('{cid}');" if i==0 else auth('service_role')+copy
   else:body=auth('admin')+f"select public.admin_decide_contribution_set('{request if scenario=='same_accept' or i==0 else uuid.uuid4()}','{cid}',{'true' if scenario=='same_accept' or i==0 else 'false'},'İncelendi',pg_temp.teachers(),true);"
   barrier.wait(timeout=10)
   return sql(db,"begin;set local lock_timeout='10s';"+helpers+body+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  successes=sum(r.returncode==0 for r in pair)
  assert successes in ([2] if scenario in ['same_begin','same_accept'] else [1] if scenario=='accept_vs_reject' else [1,2]),[(r.returncode,r.stderr) for r in pair]
  for r in pair:
   if r.returncode:assert 'contribution_changed' in r.stderr,r.stderr
  row=json.loads(sql(db,f"select jsonb_build_object('status',status,'media',media is not null,'packages',(select count(*) from gina.library_import_packages),'credits',(select count(*) from gina.contribution_question_credits)) from gina.contribution_sets where id='{cid}';").stdout.strip())
  if scenario=='withdraw_vs_copy':assert row['status']=='withdrawn' and not row['media'],row
  if scenario=='same_accept':assert row['packages']==row['credits']==1,row
  if scenario=='accept_vs_reject':assert row['packages']==row['credits']==int(row['status']=='approved'),row
  results.append({'scenario':scenario,'successes':successes,**row,'passed':True})
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
