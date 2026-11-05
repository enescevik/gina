"""Q02 SQL runner: applies all migrations to a disposable empty DB cloned from the
`gina_completion_audit` template and runs pgTAP files. Never resets app/demo data.
Usage: python3 scripts/test-q02-sql.py --run-local            # every supabase/tests/*.sql
       python3 scripts/test-q02-sql.py --run-local --only 093  # files whose name contains 093
       python3 scripts/test-q02-sql.py --run-local --fresh      # drop template public/gina, apply ALL migrations from scratch
       python3 scripts/test-q02-sql.py --run-local --skip-migration 20261106150000  # A/B: leave one migration out
Writes docs/release/q02-2026-11-06/sql-checks.json. Exit 1 on any failing assertion.
"""
from pathlib import Path
import json, re, subprocess, sys, uuid

args = sys.argv[1:]
if '--run-local' not in args:
    raise SystemExit('Explicit --run-local required')
only = args[args.index('--only') + 1] if '--only' in args else None
fresh = '--fresh' in args
skip_migration = args[args.index('--skip-migration') + 1] if '--skip-migration' in args else None
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


report = {'environment': 'empty-disposable-database', 'files': [], 'failures': []}
try:
    assert sql('gina_completion_audit', 'begin read only; select count(*) from public.families; select count(*) from auth.users; commit;') == '0\n0'
    sql('postgres', f'create database {db} owner postgres template gina_completion_audit;')
    created = True
    sql(db, 'grant references on auth.users to postgres; create publication supabase_realtime;', owner=True)
    if fresh:
        # Q03: şablondaki hazır public/gina şemasını at, hosted Supabase'in public şeması varsayılan ayrıcalıklarını kur
        # ve bütün migration'ları sıfırdan uygula (şablon ACL sapmasından bağımsız sonuç; bkz. scripts/security/rls-matrix.py).
        sql(db, """drop schema public cascade; drop schema if exists gina cascade; create schema public authorization postgres;
          grant usage, create on schema public to postgres; grant usage on schema public to anon, authenticated, service_role;
          alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
          alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
          alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
          drop publication if exists supabase_realtime; create publication supabase_realtime;""", owner=True)
        report['environment'] = 'empty-disposable-database-fresh-public-schema-all-migrations'
    for migration in sorted((root / 'supabase/migrations').glob('*.sql')):
        if skip_migration and skip_migration in migration.name:
            report['skipped_migration'] = migration.name
            continue
        if migration.name < '20261103093000' and not fresh:
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
    out = root / 'docs/release/q02-2026-11-06'
    out.mkdir(parents=True, exist_ok=True)
    out_name = ('sql-checks' + ('-fresh' if fresh else '') + ('-without-' + skip_migration if skip_migration else '')) + (f'-{only}' if only else '') + '.json'
    (out / out_name).write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'files': len(report['files']), 'assertions': report.get('assertions'), 'failures': report['failures'][:20]}, ensure_ascii=False))
    if report['failures']:
        sys.exit(1)
