"""C07 UI: disposable Auth/PostgREST on an empty audit DB clone (gina_c07_*), seeded synthetic fixture
(B03/B04 fixture + C07 operator roles/paging data), loopback proxy + static server for the exported backoffice.
Holds until STOP file exists, then cleans up. Adapted from docs/release/b03-b04-2026-11-06/harness/run.py."""
import base64, hashlib, hmac, json, os, secrets, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path

# Usage: C07_WORK=<private scratch dir> python3 run.py  (fixture + STOP file live there, never in the repo)
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
WORK = Path(os.environ['C07_WORK']); WORK.mkdir(parents=True, exist_ok=True)
FIXTURE = WORK / 'fixture.json'
STOP = WORK / 'STOP'
DB = 'gina_c07_' + secrets.token_hex(6) + '_audit'
containers = []
created = False
report = {'db': DB, 'cleanup': {}}

def command(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, timeout=300, **kw)
    if r.returncode:
        if 'psql' in args:
            print('\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l), file=sys.stderr)
        raise RuntimeError('local_command_failed')
    return r.stdout

def sql(database, body, owner=False):
    if owner and database != DB:
        raise RuntimeError('owner_only_on_disposable')
    source_read = database in ('postgres', 'gina_completion_audit') and body.lstrip().lower().startswith('select ')
    if source_read:
        body = 'begin read only;\n' + body + '\ncommit;'
    return command(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin' if owner or source_read else 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], input=body)

def inspect(name):
    d = json.loads(command(['docker', 'inspect', name]))[0]
    return d['Config']['Image'], dict(v.split('=', 1) for v in d['Config']['Env'])

def database_url(original):
    p = urllib.parse.urlsplit(original)
    if p.hostname != 'supabase_db_gina':
        raise RuntimeError('unexpected_host')
    return urllib.parse.urlunsplit(p._replace(path='/' + DB))

def jwt(role, secret):
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).decode().rstrip('=')
    body = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'role': role, 'iss': 'supabase', 'iat': int(time.time()), 'exp': int(time.time()) + 6 * 3600})
    return body + '.' + base64.urlsafe_b64encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip('=')

def start(name, image, env, port):
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-c07-env-') as f:
        os.chmod(f.name, 0o600)
        for k, v in env.items():
            f.write(k + '=' + v + '\n')
        f.flush()
        containers.append(name)
        command(['docker', 'run', '-d', '--name', name, '--network', 'supabase_network_gina', '-p', f'127.0.0.1::{port}', '--env-file', f.name, image])
    return int(json.loads(command(['docker', 'inspect', name]))[0]['NetworkSettings']['Ports'][f'{port}/tcp'][0]['HostPort'])

def healthy(port, path):
    for _ in range(80):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('not_ready')

def gotrue_user(port, service, email, password):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/admin/users', method='POST',
        data=json.dumps({'email': email, 'password': password, 'email_confirm': True}).encode(),
        headers={'Authorization': 'Bearer ' + service, 'apikey': service, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())['id']

proxy = None
try:
    if sql('gina_completion_audit', 'select count(*) from public.families; select count(*) from auth.users;').strip() != '0\n0':
        raise RuntimeError('audit_template_is_not_empty')
    sql('postgres', f'create database {DB} template gina_completion_audit;')
    created = True
    cols = "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='auth' order by table_name,ordinal_position;"
    if sql('postgres', cols) != sql(DB, cols, owner=True):
        raise RuntimeError('auth_template_schema_mismatch')
    versions = sql('postgres', 'select version from auth.schema_migrations order by version;').splitlines()
    sql(DB, 'insert into auth.schema_migrations(version) values ' + ','.join("('" + v + "')" for v in versions) + ' on conflict do nothing;')
    sql(DB, """alter schema auth owner to supabase_auth_admin;
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname='auth' loop execute format('alter table auth.%I owner to supabase_auth_admin', r.tablename); end loop;
      for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind='S' loop execute format('alter sequence auth.%I owner to supabase_auth_admin', r.relname); end loop;
      for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' loop execute format('alter function %s owner to supabase_auth_admin', r.signature); end loop;
    end $$;
    grant references on auth.users to postgres;
    create publication supabase_realtime;""", owner=True)
    for m in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if m.name < '20261103093000':
            for line in m.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '):
                    sql(DB, line)
        else:
            sql(DB, m.read_text())
    auth_image, auth_base = inspect('supabase_auth_gina')
    rest_image, rest_base = inspect('supabase_rest_gina')
    secret = secrets.token_urlsafe(48)
    auth_port = start(DB + '_auth', auth_image, {
        'GOTRUE_API_HOST': '0.0.0.0', 'GOTRUE_API_PORT': '9999', 'API_EXTERNAL_URL': 'http://127.0.0.1', 'GOTRUE_SITE_URL': 'http://127.0.0.1',
        'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL': database_url(auth_base['GOTRUE_DB_DATABASE_URL']),
        'GOTRUE_DB_MIGRATIONS_PATH': '/usr/local/etc/auth/migrations', 'GOTRUE_JWT_SECRET': secret, 'GOTRUE_JWT_EXP': '3600',
        'GOTRUE_JWT_AUD': 'authenticated', 'GOTRUE_JWT_ADMIN_ROLES': 'service_role', 'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated',
        'GOTRUE_DISABLE_SIGNUP': 'false', 'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true', 'GOTRUE_MAILER_AUTOCONFIRM': 'true',
        'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED': 'true', 'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI': 'pg-functions://postgres/public/custom_access_token_hook',
    }, 9999)
    rest_port = start(DB + '_rest', rest_image, {
        'PGRST_DB_URI': database_url(rest_base['PGRST_DB_URI']), 'PGRST_DB_SCHEMAS': 'public',
        'PGRST_DB_EXTRA_SEARCH_PATH': 'public,extensions', 'PGRST_DB_ANON_ROLE': 'anon', 'PGRST_JWT_SECRET': secret,
    }, 3000)
    healthy(auth_port, '/health'); healthy(rest_port, '/')
    anon, service = jwt('anon', secret), jwt('service_role', secret)
    users = {}
    creds = {}
    for k in ('admin', 'support', 'content', 'finance', 'release', 'p1', 'p2', 'p3', 'p4'):
        email, password = f'gina-c07-{k}-{secrets.token_hex(4)}@example.invalid', secrets.token_urlsafe(18)
        users[k] = gotrue_user(auth_port, service, email, password)
        creds[k] = {'email': email, 'password': password}
    # Cohort fixture reuses the pgTAP 098 library bundle (no copy of question text in this harness).
    bundle_fns = '\n'.join(l for l in (ROOT / 'supabase/tests/098_library_credit_safety.test.sql').read_text().splitlines()
                           if l.startswith('create function pg_temp.base_bundle()') or l.startswith('create function pg_temp.bundle()'))
    for name in ('seed.sql', 'cohort.sql', 'c07.sql'):
        seed = (HERE / name).read_text().replace('-- {{bundle_functions}}', bundle_fns)
        for k, v in users.items():
            seed = seed.replace('{{' + k + '}}', v)
        sql(DB, seed)
    sql(DB, f"""update auth.users set raw_user_meta_data='{{"name":"Selin (destek)"}}' where id='{users['support']}';
    update auth.users set raw_user_meta_data='{{"name":"Yönetici"}}' where id='{users['admin']}';
    insert into auth.sessions(id,user_id,created_at,updated_at) values(gen_random_uuid(),'{users['p1']}',now(),now());""", owner=True)
    proxy = subprocess.Popen(['node', str(HERE / 'serve.mjs')], env={**os.environ, 'AUTH_PORT': str(auth_port), 'REST_PORT': str(rest_port),
        'OUT_DIR': str(ROOT / 'apps/backoffice/out')}, stdout=subprocess.PIPE, text=True)
    line = proxy.stdout.readline()
    ports = json.loads(line)
    fx = {'db': DB, 'url': f"http://127.0.0.1:{ports['proxy']}", 'app': f"http://127.0.0.1:{ports['static']}", 'anon': anon, 'users': users, 'creds': creds}
    FIXTURE.write_text(json.dumps(fx)); os.chmod(FIXTURE, 0o600)
    print('READY', DB, flush=True)
    deadline = time.time() + 3 * 3600
    while not STOP.exists() and time.time() < deadline:
        time.sleep(1)
except Exception as e:
    report['error'] = str(e)
finally:
    if proxy:
        proxy.terminate()
    for name in reversed(containers):
        try:
            command(['docker', 'rm', '-f', name]); report['cleanup'][name] = True
        except Exception:
            report['cleanup'][name] = False
    if created:
        try:
            sql('postgres', f'drop database {DB} with (force);'); report['cleanup']['db_dropped'] = True
        except Exception:
            report['cleanup']['db_dropped'] = False
    for f in (FIXTURE, STOP):
        try: f.unlink()
        except FileNotFoundError: pass
    print(json.dumps(report), flush=True)
