#!/usr/bin/env python3
"""Two real concurrent sessions; targets only this feature's isolated audit DB."""
import json, subprocess, time
DB='gina_prova_builder_audit'
BASE=['docker','exec','-i','supabase_db_gina','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB]
u='00000000-0000-4000-8000-000000009951';f='10000000-0000-4000-8000-000000009951';c='20000000-0000-4000-8000-000000009951';q='40000000-0000-4000-8000-000000009951';d='50000000-0000-4000-8000-000000009951'
auth="set role authenticated;select set_config('request.jwt.claims','"+json.dumps({'sub':u,'role':'authenticated','gina':{'family_id':f,'role':'parent'}})+"',false);"
content=json.dumps(dict(childId=c,grade=5,title='Race',purpose='practice',format='school',subjects=['Fen'],topics=['Güneş'],target=1,minutes=None,difficulty='orta',kind='open_ended',note='',step=3,blocks=[dict(kind='question',id=q,source='library')]))
def sql(s):
 r=subprocess.run(BASE,input=s,text=True,capture_output=True,check=True);return r.stdout.strip()
def race(a,b,error=None):
 p=subprocess.Popen(BASE,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 p.stdin.write("set application_name='gina_builder_race';begin;"+auth+a+'select pg_sleep(2);commit;');p.stdin.close()
 try:
  end=time.monotonic()+10
  while time.monotonic()<end:
   if sql("select count(*) from pg_stat_activity where application_name='gina_builder_race' and wait_event='PgSleep';")=='1':break
   if p.poll() is not None:raise AssertionError(p.stderr.read())
   time.sleep(.05)
  else:raise AssertionError('barrier timeout')
  r=subprocess.run(BASE,input=auth+b,text=True,capture_output=True,timeout=15);p.wait(timeout=10)
  assert p.returncode==0,p.stderr.read()
  assert (r.returncode!=0 and error in r.stderr) if error else r.returncode==0,r.stderr
 finally:
  if p.poll() is None:p.kill();p.wait()
assert sql('select current_database();')==DB
assert sql(f"select count(*) from auth.users where id='{u}';")=='0'
sql(f"insert into auth.users(id,email) values('{u}','builder-race@example.invalid');insert into public.families(id,name,created_by) values('{f}','Race QA','{u}');insert into public.family_members(family_id,user_id) values('{f}','{u}');insert into public.children(id,family_id,name,grade) values('{c}','{f}','QA',5);insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem,expected_answer) values('{q}','{f}',5,'Fen','Güneş','open_ended','Güneş nedir?','Bir yıldızdır.');")
try:
 sql(auth+f"select public.save_prova_draft(gen_random_uuid(),'{d}',0,'{content}');")
 race(f"select public.save_prova_draft(gen_random_uuid(),'{d}',1,'{content}');",f"select public.save_prova_draft(gen_random_uuid(),'{d}',1,'{content}');",'prova_draft_changed')
 assert sql(f"select version from public.prova_drafts where id='{d}';")=='2'
 race(f"select public.submit_prova_draft(gen_random_uuid(),'{d}',2);",f"select public.submit_prova_draft(gen_random_uuid(),'{d}',2);")
 assert sql(f"select count(*) from public.exams where id='{d}';")=='1'
 print('PASS: concurrent save rejects stale version; concurrent submit creates exactly one exam')
finally:
 sql(f"delete from public.exams where id='{d}';delete from public.families where id='{f}';delete from auth.users where id='{u}';")
