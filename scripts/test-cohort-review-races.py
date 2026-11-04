#!/usr/bin/env python3
"""Central review/publication/appeal races in disposable audit database clones."""
import argparse,json,re,subprocess,threading,uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('Explicit audit template required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
 p=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=45)
 if check and p.returncode:raise RuntimeError(p.stderr)
 return p
source=(root/'supabase/tests/059_cohort_written_review.test.sql').read_text()
fixture=source.split("select lives_ok($$select pg_temp.review('80000000",1)[0].replace('select no_plan();','select no_plan();')
group='60000000-0000-4000-8000-000000005901';child='20000000-0000-4000-8000-000000004702'
admin="set local role authenticated;set local request.jwt.claims='{\"role\":\"authenticated\",\"sub\":\"00000000-0000-4000-8000-000000004301\",\"gina\":{\"admin\":true}}';"
parent="set local role authenticated;set local request.jwt.claims='{\"role\":\"authenticated\",\"sub\":\"00000000-0000-4000-8000-000000004302\",\"gina\":{\"role\":\"parent\",\"family_id\":\"10000000-0000-4000-8000-000000004302\"}}';"
results=[]
for scenario in ['same_review','stale_review','same_appeal','publish_appeal']:
 db='gina_cohort_review_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  setup=sql(db,fixture+'commit;');assert 'not ok' not in setup.stdout,setup.stdout
  entry=sql(db,f"select id from public.group_exam_entries where group_id='{group}';").stdout.strip()
  def review(request):return f"select public.admin_save_cohort_review('{request}','{entry}',4,0,public.admin_cohort_review_detail('{entry}')#>>'{{questions,3,answer_hash}}','{{\"c1\":1,\"c2\":1,\"c3\":0,\"c4\":0}}','scored','Two criteria evidenced in this answer.');"
  def appeal(request):return f"select public.appeal_cohort_review('{request}','{group}','{child}',4,1,'Please check the second explanation.');"
  if scenario in ['same_appeal','publish_appeal']:sql(db,'begin;'+admin+review(str(uuid.uuid4()))+'commit;')
  request=str(uuid.uuid4());barrier=threading.Barrier(2)
  def send(i):
   if scenario=='same_appeal' or (scenario=='publish_appeal' and i==1):cmd=parent+appeal(request)
   elif scenario=='publish_appeal':cmd=admin+f"select public.admin_publish_cohort_results('{request}','{group}',public.admin_cohort_review_queue('{group}')#>>'{{state,fingerprint}}',0);"
   else:cmd=admin+review(request if scenario=='same_review' else str(uuid.uuid4()))
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+cmd+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if scenario=='stale_review':assert len(errors)==1 and 'group_review_changed' in errors[0],errors
  elif scenario=='publish_appeal':assert len(errors)<=1 and all('group_review_incomplete' in e for e in errors),errors
  else:assert not errors,errors
  state=json.loads(sql(db,f"select jsonb_build_object('review_revision',(select revision from gina.cohort_reviews where entry_id='{entry}'),'appeals',(select count(*) from gina.cohort_appeals),'events',(select count(*) from gina.cohort_review_events),'published',gina.cohort_review_state('{group}')->'published');").stdout)
  assert state['review_revision']==1,state
  assert state['events']==(2 if scenario in ['same_appeal','publish_appeal'] else 1),state
  assert state['published'] is False,state
  assert state['appeals']==(1 if scenario in ['same_appeal','publish_appeal'] else 0),state
  results.append(dict(scenario=scenario,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
