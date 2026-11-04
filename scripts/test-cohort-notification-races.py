#!/usr/bin/env python3
"""Publication notification races in disposable audit database clones."""
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
source=(root/'supabase/tests/060_cohort_result_notifications.test.sql').read_text()
fixture=source.split("select is((select count(*)::int from public.push_outbox",1)[0]
group='60000000-0000-4000-8000-000000005901'
admin="set local role authenticated;set local request.jwt.claims='{\"role\":\"authenticated\",\"sub\":\"00000000-0000-4000-8000-000000004301\",\"gina\":{\"admin\":true}}';"
results=[]
for same in [True,False]:
 db='gina_cohort_notification_'+uuid.uuid4().hex+'_audit';sql('postgres',f'create database {db} template {args.template};')
 try:
  sql(db,fixture+'commit;');request=str(uuid.uuid4());barrier=threading.Barrier(2)
  def send(i):
   req=request if same else str(uuid.uuid4())
   command=admin+f"select public.admin_publish_cohort_results('{req}','{group}',public.admin_cohort_review_queue('{group}')#>>'{{state,fingerprint}}',0);"
   barrier.wait(timeout=10);return sql(db,"begin;set local lock_timeout='10s';"+command+'select pg_sleep(0.1);commit;',False)
  with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
  errors=[r.stderr for r in pair if r.returncode]
  if same:assert not errors,errors
  else:assert len(errors)==1 and 'group_review_changed' in errors[0],errors
  state=json.loads(sql(db,"select jsonb_build_object('publications',(select version from gina.cohort_publications),'events',(select count(*) from public.push_outbox where kind='cohort_results'));").stdout)
  assert state=={'publications':1,'events':1},state
  results.append(dict(same_request=same,state=state,passed=True))
 finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
