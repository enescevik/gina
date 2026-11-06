#!/usr/bin/env python3
"""QT00 gerçek iki-oturum yarış testleri (yapılandırılmış cevap yolu).
Yalnız kendi oluşturduğu tek kullanımlık `gina_qtrace_<hex>_audit` veritabanında çalışır (boş
`gina_completion_audit` şablonundan klonlanır, bütün migration'lar uygulanır, sonda silinir).
Uygulama/demo DB'sine veya uzak projeye bağlanmaz.
Kullanım: python3 scripts/test-qt-answer-races.py --run-local [--out docs/release/qt-2026-11-07]
"""
import json, secrets, subprocess, sys, time
from pathlib import Path

if '--run-local' not in sys.argv:
    raise SystemExit('Explicit --run-local required')
out_dir = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'docs/release/qt-2026-11-07'
ROOT = Path(__file__).resolve().parents[1]
DB = 'gina_qtrace_' + secrets.token_hex(5) + '_audit'
PSQL = ['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1']
PARENT = '00000000-0000-4000-8000-00000001e101'
DEVICE_USER = '00000000-0000-4000-8000-00000001e103'
FAMILY = '10000000-0000-4000-8000-00000001e101'
CHILD = '20000000-0000-4000-8000-00000001e101'
Q_TF = '40000000-0000-4000-8000-00000001e111'
Q_ORD = '40000000-0000-4000-8000-00000001e112'
EXAM = '50000000-0000-4000-8000-00000001e121'
parent_claims = json.dumps({'sub': PARENT, 'role': 'authenticated', 'gina': {'family_id': FAMILY, 'role': 'parent'}})
device_claims = json.dumps({'sub': DEVICE_USER, 'role': 'authenticated', 'gina': {'family_id': FAMILY, 'role': 'device', 'child_id': CHILD}})
AS_PARENT = f"set role authenticated;select set_config('request.jwt.claims','{parent_claims}',false);"
AS_DEVICE = f"set role authenticated;select set_config('request.jwt.claims','{device_claims}',false);"
report = {'environment': 'disposable-local-db', 'database': DB, 'checks': []}
created = False


def sql(body, db=None, user='postgres', check=True):
    r = subprocess.run(PSQL + ['-U', user, '-d', db or DB], input=body, text=True, capture_output=True, timeout=600)
    if check and r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    return r


def race(first, second, name, expect_error=None, check_second=None):
    """first: holds its transaction open (pg_sleep) after the statement; second runs meanwhile."""
    app = 'gina_qtrace_' + secrets.token_hex(3)
    a = subprocess.Popen(PSQL + ['-U', 'postgres', '-d', DB], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    a.stdin.write(f"set application_name='{app}';begin;" + first + "select pg_sleep(1.5);commit;")
    a.stdin.close()
    try:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if sql(f"select count(*) from pg_stat_activity where application_name='{app}' and wait_event='PgSleep';").stdout.strip() == '1':
                break
            if a.poll() is not None:
                raise AssertionError('first failed: ' + a.stderr.read()[-800:])
            time.sleep(.05)
        else:
            raise AssertionError('first transaction never reached barrier')
        started = time.monotonic()
        b = sql(second, check=False)
        waited = round(time.monotonic() - started, 2)
        a.wait(timeout=15)
        assert a.returncode == 0, a.stderr.read()[-800:]
        if expect_error:
            assert b.returncode != 0 and expect_error in b.stderr, f'{name}: expected {expect_error}, got rc={b.returncode} {b.stderr[-400:]}'
        else:
            assert b.returncode == 0, f'{name}: {b.stderr[-400:]}'
        if check_second:
            check_second(b)
        report['checks'].append({'check': name, 'passed': True, 'second_waited_s': waited, 'expected_error': expect_error})
        print('ok', name, f'(second waited {waited}s)')
    finally:
        if a.poll() is None:
            a.kill(); a.wait()


def v4(request, revision, answer, question=Q_TF):
    return (f"select public.submit_exam_answer_v4('{request}',(select id from public.exam_attempts where exam_id='{EXAM}'),"
            f"'{question}',{revision},null,null,null,'{json.dumps(answer)}'::jsonb);")


try:
    assert sql("begin read only; select count(*) from public.families; select count(*) from auth.users; commit;", db='gina_completion_audit', user='supabase_admin').stdout.split() == ['0', '0']
    sql(f"create database {DB} owner postgres template gina_completion_audit;", db='postgres', user='supabase_admin')
    created = True
    sql(f"alter database {DB} set timezone to 'Europe/Istanbul';", db='postgres', user='supabase_admin')
    sql("""grant references on auth.users to postgres; create publication supabase_realtime;
      drop schema public cascade; drop schema if exists gina cascade; create schema public authorization postgres;
      grant usage, create on schema public to postgres; grant usage on schema public to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
      drop publication if exists supabase_realtime; create publication supabase_realtime;""", user='supabase_admin')
    for m in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        sql(m.read_text())
    sql(f"""
    insert into auth.users(id,email) values('{PARENT}','qt-race-parent@example.invalid'),('{DEVICE_USER}','qt-race-device@example.invalid');
    insert into public.families(id,name,created_by) values('{FAMILY}','QT race','{PARENT}');
    insert into public.family_members(family_id,user_id) values('{FAMILY}','{PARENT}');
    insert into public.children(id,family_id,name,grade) values('{CHILD}','{FAMILY}','Ada',3);
    insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('{FAMILY}','pro','race test',now()+interval '1 day');
    insert into public.devices(id,family_id,auth_user_id,active_child_id) values(gen_random_uuid(),'{FAMILY}','{DEVICE_USER}','{CHILD}');
    {AS_PARENT}
    select public.save_question_with_sources('{Q_TF}','{{"grade":3,"subject":"Fen","topic":"Canlılar","difficulty":"orta","stem":"İfadeleri değerlendir.","interaction_type":"true_false","schema_version":1,
      "payload":{{"statements":[{{"id":"s1","text":"Kedi memelidir."}},{{"id":"s2","text":"Balık akciğerle solur."}}]}},"answer_key":{{"answers":{{"s1":true,"s2":false}}}}}}');
    select public.save_question_with_sources('{Q_ORD}','{{"grade":3,"subject":"Fen","topic":"Canlılar","difficulty":"orta","stem":"Sırala.","interaction_type":"ordering","schema_version":1,
      "payload":{{"items":[{{"id":"a","text":"Tohum"}},{{"id":"b","text":"Filiz"}},{{"id":"c","text":"Çiçek"}}],"mode":"sequence"}},"answer_key":{{"orders":[["a","b","c"]]}}}}');
    insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status) values('{EXAM}','{FAMILY}','{CHILD}','Race','Fen',3,array['{Q_TF}','{Q_ORD}']::uuid[],'assigned');
    """)
    sql(AS_DEVICE + f"select public.start_exam_attempt('{EXAM}');")

    # 1) İki cihaz aynı revizyondan farklı cevap yazar: biri kazanır, diğeri answer_changed (sessiz ezme yok).
    race(AS_DEVICE + v4('70000000-0000-4000-8000-00000001e001', 0, {'type': 'true_false', 'v': 1, 'items': {'s1': True}}),
         AS_DEVICE + v4('70000000-0000-4000-8000-00000001e002', 0, {'type': 'true_false', 'v': 1, 'items': {'s1': False}}),
         'two devices, same base revision: second gets answer_changed', expect_error='answer_changed')
    assert sql(f"select answer->'items'->>'s1' from public.exam_answers where question_id='{Q_TF}';").stdout.strip() == 'true'

    # 2) Aynı istek kimliği eşzamanlı tekrar (belirsiz ağ yanıtı sonrası yeniden deneme): aynı revizyon, çift yazım yok.
    def same_revision(b):
        assert b.stdout.strip().splitlines()[-1] == '2', b.stdout
    race(AS_DEVICE + v4('70000000-0000-4000-8000-00000001e003', 1, {'type': 'true_false', 'v': 1, 'items': {'s1': True, 's2': False}}),
         AS_DEVICE + v4('70000000-0000-4000-8000-00000001e003', 1, {'type': 'true_false', 'v': 1, 'items': {'s1': True, 's2': False}}),
         'duplicate request id in flight: replay returns same revision', check_second=same_revision)
    assert sql(f"select edit_revision from public.exam_answers where question_id='{Q_TF}';").stdout.strip() == '2'

    # 3) Eski revizyonla gelen geç (sıra dışı) yanıt: yeni cevabı ezemez.
    r = sql(AS_DEVICE + v4('70000000-0000-4000-8000-00000001e004', 1, {'type': 'true_false', 'v': 1, 'items': {}}), check=False)
    assert r.returncode != 0 and 'answer_changed' in r.stderr
    report['checks'].append({'check': 'late out-of-order write with stale revision rejected', 'passed': True}); print('ok stale late write rejected')

    # 4) Cevap kaydı ile bitirme yarışı: bitirme kilidi tutarken gelen kayıt attempt_closed alır; puan bir kez hesaplanır.
    race(AS_DEVICE + f"select public.finish_exam_attempt((select id from public.exam_attempts where exam_id='{EXAM}'));",
         AS_DEVICE + v4('70000000-0000-4000-8000-00000001e005', 0, {'type': 'ordering', 'v': 1, 'order': ['a', 'b', 'c']}, Q_ORD),
         'submit racing finish: rejected with attempt_closed', expect_error='attempt_closed')
    row = sql(f"select score_exact, graded_by, score_details->>'answer_state' from public.exam_answers where question_id='{Q_TF}';").stdout.strip()
    assert row == '100.0000|auto|complete', row
    assert sql(f"select count(*) from public.exam_answers where question_id='{Q_ORD}';").stdout.strip() == '0'

    # 5) Çift bitirme: ikinci çağrı mevcut satırı döner, yeniden puanlamaz.
    before = sql(f"select graded_at from public.exam_answers where question_id='{Q_TF}';").stdout.strip()
    race(AS_DEVICE + f"select public.finish_exam_attempt((select id from public.exam_attempts where exam_id='{EXAM}'));",
         AS_DEVICE + f"select public.finish_exam_attempt((select id from public.exam_attempts where exam_id='{EXAM}'));",
         'double finish: idempotent')
    assert sql(f"select graded_at from public.exam_answers where question_id='{Q_TF}';").stdout.strip() == before
    st = sql(f"select status, items_unanswered, provisional from public.exam_attempts where exam_id='{EXAM}';").stdout.strip()
    assert st == 'submitted|1|t', st

    # 6) Süre bitişi: deadline geçmişse kayıt time_up; cevap yazılmaz.
    sql(f"""{AS_PARENT}
      insert into public.exams(id,family_id,child_id,title,subject,grade,question_ids,status,timed,duration_minutes)
      values('50000000-0000-4000-8000-00000001e122','{FAMILY}','{CHILD}','Timed','Fen',3,array['{Q_TF}']::uuid[],'assigned',true,1);""")
    sql(AS_DEVICE + "select public.start_exam_attempt('50000000-0000-4000-8000-00000001e122');")
    sql("update public.exam_attempts set deadline_at=now()-interval '1 second' where exam_id='50000000-0000-4000-8000-00000001e122';")
    r = sql(AS_DEVICE + "select public.submit_exam_answer_v4(gen_random_uuid(),(select id from public.exam_attempts where exam_id='50000000-0000-4000-8000-00000001e122'),"
            f"'{Q_TF}',0,null,null,null,'{{\"type\":\"true_false\",\"v\":1,\"items\":{{\"s1\":true}}}}'::jsonb);", check=False)
    assert r.returncode != 0 and 'time_up' in r.stderr, r.stderr
    report['checks'].append({'check': 'write after deadline rejected with time_up', 'passed': True}); print('ok deadline time_up')

    # 7) Veli puanı ile aynı isteğin eşzamanlı tekrarı: tek kayıt.
    fp = sql(f"select gina.answer_fingerprint(a) from public.exam_answers a where question_id='{Q_TF}' and attempt_id=(select id from public.exam_attempts where exam_id='{EXAM}');").stdout.strip()
    call = (AS_PARENT + "select public.set_structured_answer_score('70000000-0000-4000-8000-00000001e009',"
            f"(select id from public.exam_attempts where exam_id='{EXAM}'),'{Q_ORD}',null,0::smallint,null);")
    race(call, call, 'parent score request replay in flight: single override row')
    assert sql(f"select count(*) from gina.answer_score_overrides;").stdout.strip() == '1'
    assert fp
    report['passed'] = True
finally:
    if created:
        sql(f"drop database {DB} with (force);", db='postgres', user='supabase_admin', check=False)
        report['cleanup'] = 'database dropped'
    out = ROOT / out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / 'answer-races.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
