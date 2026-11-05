"""Q02 SQL runner: applies all migrations to a disposable empty DB cloned from the
`gina_completion_audit` template and runs pgTAP files. Never resets app/demo data.
Usage: python3 scripts/test-q02-sql.py --run-local            # every supabase/tests/*.sql
       python3 scripts/test-q02-sql.py --run-local --only 093  # files whose name contains 093
       --timezone UTC          # session/database timezone (default Europe/Istanbul = family timezone, Q02-10)
       --out docs/release/x    # report directory (default docs/release/q02-2026-11-06)
Writes <out>/sql-checks.json. Exit 1 on any failing assertion.
"""
from pathlib import Path
import json, re, subprocess, sys, uuid

args = sys.argv[1:]
if '--run-local' not in args:
    raise SystemExit('Explicit --run-local required')
only = args[args.index('--only') + 1] if '--only' in args else None
timezone = args[args.index('--timezone') + 1] if '--timezone' in args else 'Europe/Istanbul'
out_dir = args[args.index('--out') + 1] if '--out' in args else 'docs/release/q02-2026-11-06'
if not re.fullmatch(r'[A-Za-z_]+(/[A-Za-z_+-]+)?', timezone):
    raise SystemExit('invalid --timezone')
root = Path(__file__).resolve().parents[1]
db = 'gina_q02sql_' + uuid.uuid4().hex[:10] + '_audit'
created = False


def sql(database, body, owner=False):
    role = 'supabase_admin' if owner or database != db else 'postgres'
    result = subprocess.run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', role, '-d', database, '-v', 'ON_ERROR_STOP=1'],
                            input=body, text=True, capture_output=True, timeout=600)
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result.stdout.strip()


report = {'environment': 'empty-disposable-database', 'timezone': timezone, 'files': [], 'failures': []}
try:
    assert sql('gina_completion_audit', 'begin read only; select count(*) from public.families; select count(*) from auth.users; commit;') == '0\n0'
    sql('postgres', f'create database {db} owner postgres template gina_completion_audit;')
    created = True
    # Q02-10: pgTAP files pass current_date to functions that work in the family timezone; keep the test
    # database in that timezone so a 21:00-24:00 UTC run does not shift 'today'. Template settings are not
    # copied by CREATE DATABASE, so set it on the clone. The app's own DB is untouched.
    sql('postgres', f"alter database {db} set timezone to '{timezone}';")
    sql(db, 'grant references on auth.users to postgres; create publication supabase_realtime;', owner=True)
    for migration in sorted((root / 'supabase/migrations').glob('*.sql')):
        if migration.name < '20261103093000':
            for line in migration.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '):
                    sql(db, line)
        else:
            sql(db, migration.read_text())
    files = sorted(f for f in (root / 'supabase/tests').glob('*.sql') if not only or only in f.name)
    for file in files:
        try:
            output = sql(db, file.read_text())
        except RuntimeError as error:
            report['files'].append({'file': file.name, 'passed': 0, 'error': str(error)[-600:]})
            report['failures'].append(file.name + ': ' + str(error)[-300:])
            continue
        failing = [line for line in output.splitlines() if line.startswith('not ok') or line.startswith('# Looks like') or line.startswith('# Failed')]
        passed = len(re.findall(r'^ok \d+', output, re.M))
        report['files'].append({'file': file.name, 'passed': passed, 'failed': len([l for l in failing if l.startswith('not ok')])})
        if failing:
            report['failures'].extend(file.name + ': ' + line for line in failing)
        elif passed == 0:
            report['failures'].append(file.name + ': no assertions')
    report['assertions'] = sum(f['passed'] for f in report['files'])
finally:
    if created:
        sql('postgres', f'drop database {db} with(force);')
    out = root / out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / ('sql-checks.json' if not only else f'sql-checks-{only}.json')).write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'files': len(report['files']), 'assertions': report.get('assertions'), 'failures': report['failures'][:20]}, ensure_ascii=False))
    if report['failures']:
        sys.exit(1)
