#!/usr/bin/env python3
"""School distribution replay and profile races, only in disposable audit clones."""
import argparse
import json
import re
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--template', required=True)
args = parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit', args.template):
    parser.error('An explicit audit template is required')
root = Path(__file__).resolve().parents[1]

def sql(db, body, check=True):
    r = subprocess.run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-U',
                        'postgres', '-d', db, '-X', '-At', '-v', 'ON_ERROR_STOP=1'],
                       input=body, text=True, capture_output=True, timeout=35)
    if check and r.returncode:
        raise RuntimeError(r.stderr)
    return r

fixture = (root / 'supabase/tests/054_family_blueprint.test.sql').read_text().split("select set_config('test.result'")[0].replace('select no_plan();', '')
claims = json.dumps({'sub': '00000000-0000-4000-8000-000000005401', 'role': 'authenticated', 'gina': {'role': 'parent', 'family_id': '10000000-0000-4000-8000-000000005401'}})
auth = f"set local role authenticated;set local request.jwt.claims='{claims}';"
body = json.dumps({'child_id': '20000000-0000-4000-8000-000000005401', 'grade': 5, 'subject': 'Matematik', 'name': 'Senaryo 2', 'academic_year': '2026-2027', 'term': 1, 'exam': 1, 'rows': [{'topic': 'Açılar', 'count': 3}], 'source_url': '', 'confirmed': True})
results = []
for scenario in ['same_request', 'conflicting_payload', 'profile_change']:
    db = 'gina_blueprint_' + uuid.uuid4().hex + '_audit'
    sql('postgres', f'create database {db} template {args.template};')
    try:
        sql(db, fixture + 'commit;')
        request = str(uuid.uuid4())
        barrier = threading.Barrier(2)

        def send(i):
            barrier.wait(timeout=10)
            if scenario == 'profile_change' and i == 1:
                return sql(db, "begin;set local lock_timeout='10s';update public.children set grade=6 where id='20000000-0000-4000-8000-000000005401';select pg_sleep(0.1);commit;", False)
            value = body.replace('Senaryo 2', 'Senaryo 3') if scenario == 'conflicting_payload' and i else body
            return sql(db, "begin;set local lock_timeout='10s';" + auth + f"select public.save_family_blueprint('{request}','{value}');select pg_sleep(0.1);commit;", False)

        with ThreadPoolExecutor(max_workers=2) as pool:
            pair = list(pool.map(send, [0, 1]))
        successes = sum(r.returncode == 0 for r in pair)
        expected = [2] if scenario == 'same_request' else [1] if scenario == 'conflicting_payload' else [1, 2]
        assert successes in expected, [(r.returncode, r.stderr) for r in pair]
        for r in pair:
            if r.returncode:
                assert ('request_conflict' if scenario == 'conflicting_payload' else 'blueprint_grade_mismatch') in r.stderr, r.stderr
        count = int(sql(db, 'select count(*) from public.exam_blueprints;').stdout.strip())
        assert count == (int(pair[0].returncode == 0) if scenario == 'profile_change' else 1), count
        if scenario == 'profile_change':
            # Regardless of the first winner, new saves must use the updated grade.
            retry = sql(db, 'begin;' + auth + f"select public.save_family_blueprint('{uuid.uuid4()}','{body}');commit;", False)
            assert retry.returncode and 'blueprint_grade_mismatch' in retry.stderr
        results.append({'scenario': scenario, 'successes': successes, 'rows': count, 'passed': True})
    finally:
        sql('postgres', f'drop database {db};')
print(json.dumps(results, indent=2))
