#!/usr/bin/env python3
"""Real two-session races against the isolated local audit database only.
Never targets the default local database or a remote/production project.
"""
import json
import subprocess
import time

DB = 'gina_release13_audit'
BASE = ['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB]
USER = '00000000-0000-4000-8000-000000009981'
FAMILY = '10000000-0000-4000-8000-000000009981'
CHILD = '20000000-0000-4000-8000-000000009981'
Q = '30000000-0000-4000-8000-000000009981'
EXAM = '50000000-0000-4000-8000-000000009981'
SOURCE = '80000000-0000-4000-8000-000000009981'
claims = json.dumps({'sub': USER, 'role': 'authenticated', 'gina': {'family_id': FAMILY, 'role': 'parent'}})
auth = f"set role authenticated;select set_config('request.jwt.claims','{claims}',false);"
assignment = f"insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('{EXAM}','{FAMILY}','{CHILD}','Race','Matematik',5,array['{Q}']::uuid[],'assigned');"
attachment = f"select public.attach_question_source('{Q}','{SOURCE}','Garden source');"


def sql(statement, check=True):
    return subprocess.run(BASE, input=statement, text=True, capture_output=True, check=check).stdout.strip()


def race(first, second, expected_error=None):
    a = subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    a.stdin.write("set application_name='gina_question_race';begin;" + auth + first + "select pg_sleep(2);commit;")
    a.stdin.close()
    try:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if sql("select count(*) from pg_stat_activity where application_name='gina_question_race' and wait_event='PgSleep';") == '1':
                break
            if a.poll() is not None:
                raise AssertionError(a.stderr.read())
            time.sleep(.05)
        else:
            raise AssertionError('first transaction never reached lock barrier')
        b = subprocess.run(BASE, input=auth + second, text=True, capture_output=True, timeout=15)
        a.wait(timeout=10)
        assert a.returncode == 0, a.stderr.read()
        if expected_error:
            assert b.returncode != 0 and expected_error in b.stderr, b.stderr
        else:
            assert b.returncode == 0, b.stderr
    finally:
        if a.poll() is None:
            a.kill()
            a.wait()


def main():
    assert sql('select current_database();') == DB
    assert sql(f"select count(*) from auth.users where id='{USER}';") == '0', 'fixture already exists; inspect before retry'
    sql(f"""
    insert into auth.users(id,email) values('{USER}','question-race@example.invalid');
    insert into public.families(id,name,created_by) values('{FAMILY}','Race QA','{USER}');
    insert into public.family_members(family_id,user_id) values('{FAMILY}','{USER}');
    insert into public.children(id,family_id,name) values('{CHILD}','{FAMILY}','Synthetic');
    insert into public.question_bank(id,family_id,grade,subject,topic,kind,stem) values('{Q}','{FAMILY}',5,'Matematik','Çevre','open_ended','Original question');
    insert into public.learning_sources(id,family_id,kind,name,mime,bytes,sha256,object_path,status,width,height,storage_consent)
    values('{SOURCE}','{FAMILY}','question_image','garden.png','image/png',100,repeat('a',64),'question-race/garden','ready',800,600,'private-storage-v1');
    """)
    try:
        race(assignment, f"update public.question_bank set stem='Racing edit' where id='{Q}';", 'question_in_use')
        assert sql(f"select stem from public.question_bank where id='{Q}';") == 'Original question'
        sql(f"delete from public.exams where id='{EXAM}';")
        race(f"update public.question_bank set stem='Edited before assignment' where id='{Q}';", assignment)
        assert sql(f"select stem from public.get_attempt_questions('{EXAM}');") == ''  # no user claims
        assert sql(f"select stem from public.question_bank where id='{Q}';") == 'Edited before assignment'
        sql(f"delete from public.exams where id='{EXAM}';")
        race(assignment, attachment, 'question_in_use')
        assert sql(f"select count(*) from public.learning_source_links where question_id='{Q}';") == '0'
        sql(f"delete from public.exams where id='{EXAM}';")
        race(attachment, assignment)
        assert sql(f"select count(*) from public.learning_source_links where question_id='{Q}';") == '1'
        print(json.dumps({'database': DB, 'passed': ['assignment_before_edit', 'edit_before_assignment', 'assignment_before_image', 'image_before_assignment']}))
    finally:
        sql(f"delete from auth.users where id='{USER}';delete from public.source_deletion_queue where object_path='question-race/garden';")


if __name__ == '__main__':
    main()
