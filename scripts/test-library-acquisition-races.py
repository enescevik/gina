#!/usr/bin/env python3
"""Real concurrent acquisitions against a disposable clone of an explicit audit DB."""
import argparse,json,re,subprocess,uuid,threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('Explicit audit database required')
root=Path(__file__).resolve().parents[1]
def sql(db,s,check=True):
 r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=s,text=True,capture_output=True,timeout=35)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r
prefix=(root/'supabase/tests/043_library_family_access.test.sql').read_text().split("select throws_ok($$select pg_temp.acquire")[0]
prefix=re.sub(r'select plan\(\d+\);','',prefix)
claims=json.dumps({'sub':'00000000-0000-4000-8000-000000004302','role':'authenticated','gina':{'role':'parent','family_id':'10000000-0000-4000-8000-000000004302'}})
results=[]
for scenario in ['same_request','different_requests','legacy_quota']:
 db='gina_acquire_'+uuid.uuid4().hex+'_audit';sql('postgres',f'CREATE DATABASE {db} TEMPLATE {args.template};')
 try:
  r=sql(db,prefix+"reset role; update public.app_settings set value='true' where key in('library_packages.enabled','sources.enabled','question_groups.enabled'); update public.plans set library_monthly=2 where code='free'; select id from state;commit;")
  package=next(x for x in r.stdout.splitlines() if re.fullmatch('[a-f0-9-]{36}',x))
  req=str(uuid.uuid4());calls=[f"select public.acquire_library_units('{req}','{package}',1,array['source:segments']);",f"select public.acquire_library_units('{req if scenario=='same_request' else uuid.uuid4()}','{package}',1,array['source:segments']);"]
  if scenario=='legacy_quota':
   col,item=str(uuid.uuid4()),str(uuid.uuid4())
   sql(db,f"insert into public.library_collections(id,title,grade,subject,status,plans) values('{col}','Legacy test',5,'Matematik','published',array['free']::public.plan_code[]); insert into public.library_items(id,collection_id,content,content_hash,status) select '{item}','{col}',student||teacher,repeat('a',64),'published' from gina.library_import_questions q join gina.library_import_answers a using(package_id,question_key) limit 1;")
   calls[1]=f"select public.redeem_library_item('{item}');"
  barrier=threading.Barrier(2)
  def send(i):
   barrier.wait(timeout=10)
   return sql(db,f"begin;set local lock_timeout='10s';set local role authenticated;set local request.jwt.claims='{claims}';{calls[i]}select pg_sleep(0.1);commit;",False)
  with ThreadPoolExecutor(max_workers=2) as pool: pair=list(pool.map(send,[0,1]))
  successes=sum(r.returncode==0 for r in pair)
  usage=int(sql(db,"select gina.library_month_used('10000000-0000-4000-8000-000000004302');").stdout.strip())
  if scenario=='legacy_quota':
   assert successes==1 and usage in [1,2],[(r.returncode,r.stderr) for r in pair]
   assert 'library_quota_exceeded' in next(r.stderr for r in pair if r.returncode)
  else:
   assert successes==2 and usage==2,[(r.returncode,r.stderr) for r in pair]
   assert sql(db,'select count(*) from gina.library_acquisitions;').stdout.strip()=='1'
  results.append({'scenario':scenario,'successfulRequests':successes,'questionCredits':usage,'passed':True})
 finally:sql('postgres',f'DROP DATABASE {db};')
print(json.dumps(results,indent=2))
