#!/usr/bin/env python3
"""Real concurrent requests against the isolated audit database only."""
import json
import subprocess
import time
DB = 'gina_prova_builder_audit'
BASE = ['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB]
U = '00000000-0000-4000-8000-000000009961'
V = '00000000-0000-4000-8000-000000009962'
F = '10000000-0000-4000-8000-000000009961'
R = '20000000-0000-4000-8000-000000009961'
def sql(statement):
    return subprocess.run(BASE, input=statement, text=True, capture_output=True, check=True).stdout.strip()
def auth(user):
    claims = json.dumps({'sub':user,'role':'authenticated','gina':{'role':'parent','family_id':F}})
    return "set role authenticated;select set_config('request.jwt.claims','" + claims + "',false);"
def race(first, second, second_user=U, error=None):
    p = subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    p.stdin.write("set application_name='gina_help_race';begin;"+auth(U)+first+'select pg_sleep(1);commit;')
    p.stdin.close()
    try:
        end = time.monotonic()+10
        while time.monotonic()<end:
            if sql("select count(*) from pg_stat_activity where application_name='gina_help_race' and wait_event='PgSleep';")=='1':
                break
            if p.poll() is not None:
                raise AssertionError(p.stderr.read())
            time.sleep(.05)
        else:
            raise AssertionError('barrier timeout')
        result = subprocess.run(BASE, input=auth(second_user)+second, text=True, capture_output=True, timeout=15)
        p.wait(timeout=10)
        assert p.returncode==0, p.stderr.read()
        assert (result.returncode!=0 and error in result.stderr) if error else result.returncode==0, result.stderr
    finally:
        if p.poll() is None:
            p.kill();p.wait()
assert sql('select current_database();')==DB
assert sql(f"select count(*) from auth.users where id in('{U}','{V}');")=='0'
sql(f"insert into auth.users(id,email,is_anonymous) values('{U}','help-race-1@example.invalid',false),('{V}','help-race-2@example.invalid',false);insert into public.families(id,name,created_by) values('{F}','Help race QA','{U}');insert into public.family_members(family_id,user_id) values('{F}','{U}'),('{F}','{V}');")
try:
    create = f"select public.create_help_ticket('{R}','support','other','Concurrent fixture','Original message');"
    race(create,create)
    assert sql(f"select count(*) from public.help_tickets where family_id='{F}';")=='1'
    ticket = sql(f"select id from public.help_tickets where family_id='{F}';")
    a=f"select public.reply_help_ticket(gen_random_uuid(),'{ticket}',1,'First reply');"
    b=f"select public.reply_help_ticket(gen_random_uuid(),'{ticket}',1,'Other parent reply');"
    race(a,b,V,'help_changed')
    assert sql(f"select revision from public.help_tickets where id='{ticket}';")=='2'
    assert sql(f"select count(*) from public.help_messages where ticket_id='{ticket}';")=='2'
    receipt='20000000-0000-4000-8000-000000009962'
    reply=f"select public.reply_help_ticket('{receipt}','{ticket}',2,'Retried reply');"
    race(reply,reply)
    assert sql(f"select count(*) from public.help_messages where ticket_id='{ticket}';")=='3'
    print('PASS: concurrent create/reply deduplicate; two-parent stale reply rejected')
finally:
    sql(f"delete from public.families where id='{F}';delete from auth.users where id in('{U}','{V}');")
