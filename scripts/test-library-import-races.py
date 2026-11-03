#!/usr/bin/env python3
"""Exercise real concurrent imports in a disposable clone of an isolated audit DB.

Never connects to, resets or seeds the normal application database. The explicit
template must be named gina_*_audit and already contain the intake migration.
"""
import argparse
import copy
import json
import re
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--template', required=True)
    parser.add_argument('--container', default='supabase_db_gina')
    args = parser.parse_args()
    if not re.fullmatch(r'gina_[a-z0-9_]+_audit', args.template):
        parser.error('Only an explicit gina_*_audit template is allowed')
    database = f'gina_library_race_{uuid.uuid4().hex}_audit'
    actor = str(uuid.uuid4())

    def sql(db, statement, check=True):
        result = subprocess.run(
            ['docker', 'exec', '-i', args.container, 'psql', '-U', 'postgres',
             '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'],
            input=statement, text=True, capture_output=True, timeout=35,
        )
        if check and result.returncode:
            raise RuntimeError(result.stderr)
        return result

    # CREATE/DROP DATABASE cannot run inside a transaction. No other sessions are
    # terminated; a busy template fails instead of interrupting somebody's work.
    sql('postgres', f'CREATE DATABASE {database} TEMPLATE {args.template};')
    try:
        sql(database, f"INSERT INTO auth.users(id,email) VALUES ('{actor}','{actor}@race.test');"
            f"INSERT INTO public.admins(user_id) VALUES ('{actor}');")
        fixture = (Path(__file__).resolve().parents[1] / 'supabase/tests/040_library_import.test.sql').read_text()
        bundle = json.loads(fixture.split('$fixture$')[1])

        def run_pair(name, same_request=False, conflict=False):
            payloads = [copy.deepcopy(bundle), copy.deepcopy(bundle)]
            for payload in payloads:
                payload['package_key'] = f'race-{name}'
            if conflict:
                payloads[1]['title'] = 'Concurrent changed title'
            requests = [str(uuid.uuid4()), str(uuid.uuid4())]
            if same_request:
                requests[1] = requests[0]
            barrier = threading.Barrier(2)

            def send(index):
                # UUID dollar quoting avoids treating fixture content as SQL.
                delimiter = '$bundle_' + uuid.uuid4().hex + '$'
                raw = json.dumps(payloads[index], ensure_ascii=False)
                assert delimiter not in raw
                claims = json.dumps({'sub': actor, 'gina': {'admin': True}})
                statement = f"""BEGIN;
                    SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='10s';
                    SET LOCAL ROLE authenticated;
                    SET LOCAL request.jwt.claims = '{claims}';
                    SELECT pg_sleep(0.1);
                    SELECT public.admin_import_library_bundle('{requests[index]}',
                        {delimiter}{raw}{delimiter}::jsonb);
                    SELECT pg_sleep(0.3); COMMIT;"""
                barrier.wait(timeout=10)
                return sql(database, statement, check=False)

            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(send, (0, 1)))
            successes = [json.loads(next(line for line in r.stdout.splitlines() if line.startswith('{')))
                         for r in results if r.returncode == 0]
            if conflict:
                assert len(successes) == 1, results
                assert 'library_import_revision_conflict' in next(r.stderr for r in results if r.returncode)
            else:
                assert len(successes) == 2, results
                assert successes[0]['id'] == successes[1]['id']
                if same_request:
                    assert successes[0] == successes[1]
                else:
                    assert sorted(r['created'] for r in successes) == [False, True]
            pid = successes[0]['id']
            counts = sql(database, f"""SELECT
                (SELECT count(*) FROM gina.library_import_packages WHERE package_key='race-{name}'),
                (SELECT count(*) FROM gina.library_import_requests WHERE package_id='{pid}'),
                (SELECT count(*) FROM public.audit_log WHERE action='library_bundle.imported' AND target_id='{pid}');""").stdout.strip()
            expected_receipts = 1 if same_request or conflict else 2
            assert counts == f'1|{expected_receipts}|1', counts
            print(f'PASS {name}: one package, {expected_receipts} receipt(s), one audit event')
            return pid

        review_package = run_pair('different-requests')
        run_pair('same-request', same_request=True)
        run_pair('conflicting-content', conflict=True)
        def review_race(same_request):
            ids = [str(uuid.uuid4()), str(uuid.uuid4())]
            if same_request:
                ids[1] = ids[0]
            question = bundle['questions'][1 if same_request else 0]['key']
            barrier = threading.Barrier(2)
            claims = json.dumps({'sub': actor, 'gina': {'admin': True}})
            def send(index):
                statement = f"""BEGIN;
                    SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='10s';
                    SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{claims}';
                    SELECT pg_sleep(0.1);
                    SELECT public.admin_review_library_question('{ids[index]}','{review_package}',
                        '{question}',1,0,'suitable','Concurrent review');
                    SELECT pg_sleep(0.3); COMMIT;"""
                barrier.wait(timeout=10)
                return sql(database, statement, check=False)
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(send, (0, 1)))
            successes = [json.loads(next(line for line in r.stdout.splitlines() if line.startswith('{')))
                         for r in results if r.returncode == 0]
            if same_request:
                assert len(successes) == 2 and successes[0] == successes[1], results
            else:
                assert len(successes) == 1, results
                assert 'library_review_changed' in next(r.stderr for r in results if r.returncode)
            count = sql(database, f"SELECT count(*) FROM gina.library_editorial_reviews WHERE package_id='{review_package}' AND question_key='{question}';").stdout.strip()
            assert count == '1', count
            print('PASS editorial race: ' + ('same request replays one decision' if same_request else 'stale editor cannot overwrite winner'))
        review_race(False)
        review_race(True)

        # Media bytes are trusted fixtures here; decoder tests cover actual bytes.
        media = [{'source_hash': a['sha256'], 'base64': a['base64']} for a in bundle['assets']]
        sql(database, f"SET request.jwt.claims='{{\"role\":\"service_role\"}}'; SELECT public.prepare_library_delivery_media('{actor}','{review_package}',$media${json.dumps(media)}$media$::jsonb);")
        claims = json.dumps({'sub': actor, 'gina': {'admin': True}})
        def publication_race(same_request, version, review_conflict=False):
            fp = sql(database, f"SELECT gina.library_review_fingerprint('{review_package}');").stdout.strip()
            requests = [str(uuid.uuid4()), str(uuid.uuid4())]
            if same_request: requests[1] = requests[0]
            barrier = threading.Barrier(2)
            def send(index):
                operation = f"SELECT public.admin_set_library_publication('{requests[index]}','{review_package}',{version},'{fp}','Race publication','Description',array['plus','pro']::public.plan_code[],'Test programme',true,'published');"
                if review_conflict and index == 1:
                    operation = f"SELECT public.admin_review_library_question('{requests[index]}','{review_package}','{bundle['questions'][0]['key']}',1,1,'changes_requested','Recheck source');"
                statement = f"BEGIN; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='10s'; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{claims}'; SELECT pg_sleep(0.1); {operation} SELECT pg_sleep(0.3); COMMIT;"
                barrier.wait(timeout=10)
                return sql(database, statement, check=False)
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(send, (0, 1)))
            successes = [json.loads(next(line for line in r.stdout.splitlines() if line.startswith('{'))) for r in results if r.returncode == 0]
            if review_conflict:
                assert results[1].returncode == 0, results
                if results[0].returncode: assert 'library_publication_review_changed' in results[0].stderr, results
                stale = sql(database, f"SELECT review_fingerprint<>gina.library_review_fingerprint(package_id) FROM gina.library_publications WHERE package_id='{review_package}';").stdout.strip()
                assert stale == 't', stale
                print('PASS publication/review race: changed review cannot leave an effective release')
            elif same_request:
                assert len(successes) == 2 and successes[0] == successes[1], results
                print('PASS publication replay race: one exact receipt')
            else:
                assert len(successes) == 1, results
                assert 'library_publication_changed' in next(r.stderr for r in results if r.returncode)
                print('PASS publication version race: one winner')
        publication_race(False, 0)
        publication_race(True, 1)
        publication_race(False, 2, review_conflict=True)

    finally:
        # Exact generated name only; do not force-drop or touch the template.
        sql('postgres', f'DROP DATABASE {database};')
        print('Disposable race database removed; template and normal database untouched')


if __name__ == '__main__':
    main()
