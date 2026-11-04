"""Run real Auth/PostgREST acceptance only in a disposable, empty audit DB clone.
Never targets the existing local app DB or a hosted project; prints no credentials.
Usage: python3 scripts/test-isolated-services.py --run-local
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
WITH_STORAGE = sys.argv[1:] == ['--run-local', '--with-storage']
if sys.argv[1:] != ['--run-local'] and not WITH_STORAGE:
    raise SystemExit('Explicit --run-local required')
DB = 'gina_http_' + secrets.token_hex(8) + '_audit'
NAMES = [DB + '_auth', DB + '_rest']
created = False
containers = []
report = {'environment': 'disposable-local-auth-postgrest', 'checks': {}, 'cleanup': {}}

def command(args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, timeout=180, **kwargs)
    if result.returncode:
        # SQL inputs here contain only schema setup/metadata, never credentials.
        if 'psql' in args:
            print('\n'.join(line for line in result.stderr.splitlines() if line.startswith('ERROR:')), file=sys.stderr)
        raise RuntimeError('local_command_failed')
    return result.stdout

def sql(database, body, owner=False):
    if owner and database != DB:
        raise RuntimeError('ownership_changes_require_disposable_database')
    return command(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-At', '-U', 'supabase_admin' if owner else 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], input=body)

def inspect(name):
    data = json.loads(command(['docker', 'inspect', name]))[0]
    return data['Config']['Image'], dict(v.split('=', 1) for v in data['Config']['Env'])

def database_url(original):
    parsed = urllib.parse.urlsplit(original)
    if parsed.hostname != 'supabase_db_gina':
        raise RuntimeError('unexpected_local_database_host')
    return urllib.parse.urlunsplit(parsed._replace(path='/' + DB))

def jwt(role, secret):
    encode = lambda data: base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode()).decode().rstrip('=')
    body = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'role': role, 'iss': 'supabase', 'iat': int(time.time()), 'exp': int(time.time()) + 3600})
    return body + '.' + base64.urlsafe_b64encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip('=')

def start(name, image, env, container_port, temporary_storage=False):
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-http-env-') as file:
        os.chmod(file.name, 0o600)
        for key, value in env.items():
            if '\n' in value:
                raise RuntimeError('invalid_environment_value')
            file.write(key + '=' + value + '\n')
        file.flush()
        # Register ownership before invoking Docker, even if the response is lost.
        containers.append(name)
        command(['docker', 'run', '-d', '--name', name, '--network', 'supabase_network_gina', '-p', f'127.0.0.1::{container_port}', '--env-file', file.name,
                 *(['--tmpfs', '/mnt:rw,size=64m,mode=1777'] if temporary_storage else []), image])
    binding = json.loads(command(['docker', 'inspect', name]))[0]['NetworkSettings']['Ports'][f'{container_port}/tcp'][0]
    return int(binding['HostPort'])

def healthy(port, path):
    status = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=2) as response:
                if response.status == 200:
                    return
        except urllib.error.HTTPError as error:
            status = error.code
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('local_service_not_ready_' + str(port) + '_' + str(status))

try:
    if sql('gina_completion_audit', 'select count(*) from public.families; select count(*) from auth.users;').strip() != '0\n0':
        raise RuntimeError('audit_template_is_not_empty')
    sql('postgres', f'create database {DB} template gina_completion_audit;')
    created = True
    # The empty audit template keeps Auth DDL but intentionally contains no data.
    # Copy only migration VERSION metadata, after confirming the column schemas
    # match. Never copy users, sessions, identities, or application records.
    auth_columns = "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='auth' order by table_name,ordinal_position;"
    if sql('postgres', auth_columns) != sql(DB, auth_columns):
        raise RuntimeError('auth_template_schema_mismatch')
    versions = sql('postgres', 'select version from auth.schema_migrations order by version;').splitlines()
    if not versions or not all(1 <= len(v) <= 14 and v.isdigit() for v in versions):
        raise RuntimeError('unexpected_auth_migration_metadata')
    sql(DB, 'insert into auth.schema_migrations(version) values ' + ','.join("('" + v + "')" for v in versions) + ' on conflict do nothing;')
    # The schema-only template was restored as postgres. Restore the Auth
    # service's ownership inside this clone, not cluster-wide role settings.
    sql(DB, """alter schema auth owner to supabase_auth_admin;
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname='auth' loop
        execute format('alter table auth.%I owner to supabase_auth_admin', r.tablename);
      end loop;
      for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind='S' loop
        execute format('alter sequence auth.%I owner to supabase_auth_admin', r.relname);
      end loop;
      for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' loop
        execute format('alter function %s owner to supabase_auth_admin', r.signature);
      end loop;
    end $$;
    create publication supabase_realtime;""", owner=True)
    if WITH_STORAGE:
        if sql(DB, 'select count(*) from storage.objects;').strip() != '0':
            raise RuntimeError('storage_template_is_not_empty')
        storage_columns = auth_columns.replace("table_schema='auth'", "table_schema='storage'")
        if sql('postgres', storage_columns) != sql(DB, storage_columns):
            raise RuntimeError('storage_template_schema_mismatch')
        # Storage migration metadata only; no objects or bucket/user records.
        metadata = sql('postgres', 'select coalesce(jsonb_agg(to_jsonb(m)),\'[]\') from storage.migrations m;').strip()
        sql(DB, "insert into storage.migrations select * from jsonb_populate_recordset(null::storage.migrations, '" + metadata.replace("'", "''") + "'::jsonb) on conflict do nothing;")
        sql(DB, """alter schema storage owner to supabase_storage_admin;
        do $$ declare r record; begin
          for r in select tablename from pg_tables where schemaname='storage' loop
            execute format('alter table storage.%I owner to supabase_storage_admin', r.tablename);
          end loop;
          for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relkind='S' loop
            execute format('alter sequence storage.%I owner to supabase_storage_admin', r.relname);
          end loop;
          for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='storage' loop
            execute format('alter function %s owner to supabase_storage_admin', r.signature);
          end loop;
        end $$;""", owner=True)
    for migration in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if migration.name < '20261103093000':
            for line in migration.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '):
                    sql(DB, line)
        else:
            sql(DB, migration.read_text())
    auth_image, auth_base = inspect('supabase_auth_gina')
    rest_image, rest_base = inspect('supabase_rest_gina')
    secret = secrets.token_urlsafe(48)
    auth_port = start(NAMES[0], auth_image, {
        'GOTRUE_API_HOST': '0.0.0.0', 'GOTRUE_API_PORT': '9999',
        'API_EXTERNAL_URL': 'http://127.0.0.1', 'GOTRUE_SITE_URL': 'http://127.0.0.1',
        'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL': database_url(auth_base['GOTRUE_DB_DATABASE_URL']),
        'GOTRUE_DB_MIGRATIONS_PATH': '/usr/local/etc/auth/migrations',
        'GOTRUE_JWT_SECRET': secret, 'GOTRUE_JWT_EXP': '3600', 'GOTRUE_JWT_AUD': 'authenticated',
        'GOTRUE_JWT_ADMIN_ROLES': 'service_role', 'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated',
        'GOTRUE_DISABLE_SIGNUP': 'false', 'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true',
        'GOTRUE_MAILER_AUTOCONFIRM': 'true', 'GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED': 'true',
        'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED': 'true',
        'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI': 'pg-functions://postgres/public/custom_access_token_hook',
    }, 9999)
    rest_port = start(NAMES[1], rest_image, {
        'PGRST_DB_URI': database_url(rest_base['PGRST_DB_URI']), 'PGRST_DB_SCHEMAS': 'public',
        'PGRST_DB_EXTRA_SEARCH_PATH': 'public,extensions', 'PGRST_DB_ANON_ROLE': 'anon',
        'PGRST_JWT_SECRET': secret,
    }, 3000)
    healthy(auth_port, '/health')
    healthy(rest_port, '/')
    env = {**os.environ, 'GINA_QA_AUTH_PORT': str(auth_port), 'GINA_QA_REST_PORT': str(rest_port),
           'GINA_QA_ANON': jwt('anon', secret), 'GINA_QA_SERVICE': jwt('service_role', secret)}
    if WITH_STORAGE:
        storage_image, storage_base = inspect('supabase_storage_gina')
        storage_port = start(DB + '_storage', storage_image, {
            'DATABASE_URL': database_url(storage_base['DATABASE_URL']),
            'ANON_KEY': env['GINA_QA_ANON'], 'SERVICE_KEY': env['GINA_QA_SERVICE'],
            'AUTH_JWT_SECRET': secret, 'STORAGE_BACKEND': 'file',
            'FILE_STORAGE_BACKEND_PATH': '/mnt', 'TENANT_ID': DB,
            'GLOBAL_S3_BUCKET': DB, 'STORAGE_S3_REGION': 'local',
            'ENABLE_IMAGE_TRANSFORMATION': 'false', 'IMAGE_TRANSFORMATION_ENABLED': 'false',
            'VECTOR_ENABLED': 'false', 'VECTOR_STORE_MIGRATIONS_ENABLED': 'false',
            'S3_PROTOCOL_ENABLED': 'false', 'FILE_SIZE_LIMIT': '10485760',
            'SIGNED_UPLOAD_URL_EXPIRATION_TIME': '120',
        }, 5000, temporary_storage=True)
        healthy(storage_port, '/status')
        env['GINA_QA_STORAGE_PORT'] = str(storage_port)
        report['environment'] = 'disposable-local-auth-postgrest-storage-edge'
    process = subprocess.Popen(['node', 'scripts/test-isolated-services.mjs'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        stdout, _ = process.communicate(timeout=180)
    finally:
        # Include the optional Deno child if Node exits or times out unexpectedly.
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
    try:
        report['checks'] = json.loads(stdout)['checks']
    except Exception:
        raise RuntimeError('service_contract_report_missing')
    if process.returncode:
        raise RuntimeError('service_contract_failed')
except Exception as error:
    report['error'] = str(error) if isinstance(error, RuntimeError) else 'isolated_service_setup_failed'
finally:
    for name in reversed(containers):
        try:
            command(['docker', 'rm', '-f', name])
            report['cleanup'][name.rsplit('_', 1)[-1] + '_removed'] = True
        except Exception:
            report['cleanup'][name.rsplit('_', 1)[-1] + '_removed'] = False
    if created:
        try:
            sql('postgres', f'drop database {DB} with (force);')
            report['cleanup']['disposable_database_removed'] = True
        except Exception:
            report['cleanup']['disposable_database_removed'] = False
    print(json.dumps(report, indent=2))
    if 'error' in report or not all(report['cleanup'].values()):
        sys.exit(1)
