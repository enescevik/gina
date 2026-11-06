"""C13 madde 4 — izole geri yükleme tatbikatı: Auth hesapları + Storage nesneleri (dosya baytları) + ilişkiler BİRLİKTE.

Yalnız tek kullanımlık yerel DB klonları (`gina_c13r_*`) ve geçici GoTrue/PostgREST/Storage kapsayıcılarıyla çalışır.
Yerel uygulama DB'si `postgres` ve şablon `gina_completion_audit` yalnız okunur (klon kaynağı); hosted/üretime dokunmaz;
`db reset` yapmaz; hiçbir sır (parola, JWT sırrı, imzalı URL belirteci, bağlantı parolası) yazdırmaz/dosyaya yazmaz.

Akış:
  1. Kaynak DB = şablon klonu + güncel migration'lar; gerçek GoTrue ile iki sentetik veli (A, B) kaydı; aile/çocuk/cihaz/
     not geçmişi; gerçek Storage API'ye (file backend, tmpfs) iki PDF yüklemesi + learning_sources satırları (sha256).
  2. Storage dosya baytları kapsayıcıdan `tar` ile belleğe alınır (nesne kopyası; DB dökümü bayt taşımaz).
  3. `pg_dump -Fc --data-only -n auth -n storage -n public -n gina` (servis metadata tabloları hariç) — süper kullanıcı.
  4. Hedef DB = şablon klonu, public/gina düşürülmüş; `node scripts/restore-database.mjs` önce dry-run, sonra
     `--execute --target-confirm <db>` (replica, süper kullanıcı) — beklenen sayımlar kaynaktan.
  5. Hedefe yeni GoTrue/PostgREST/Storage kapsayıcıları; tar ile baytlar hedef Storage'a geri konur.
  6. Kanıt: gerçek GoTrue parola girişi (parola yalnız süreç belleğinde) + JWT gina.family_id; Storage imzalı URL ile dosya
     açma + sha256 eşitliği; veli JWT'si PostgREST'te kendi learning_sources/children satırlarını okur, yabancı/anon okuyamaz;
     post-restore ACL kontrolü (0 satır); ilişki/yetim sorguları; tablo içerik özetleri kaynakla eşit.
  7. (Opsiyonel, varsayılan açık) Aynı döküm `--trigger-mode disable-user` ile süper kullanıcısız ikinci hedefe; sonuç
     dürüstçe kaydedilir; başarılıysa aynı uygulama kanıtları tekrarlanır.
Not: Bu tatbikatın pg_dump'ı yerel süper kullanıcıyla alınır; hosted (Supabase PITR/yedek paneli, süper kullanıcısız)
kanıt DEĞİLDİR.

Kullanım: python3 scripts/security/c13-restore-drill.py --run-local [--skip-disable-user] [--out docs/release/c13-2026-11-06/restore]
"""
import base64, hashlib, hmac, json, os, secrets, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

ARGS = sys.argv[1:]
if '--run-local' not in ARGS:
    raise SystemExit('Explicit --run-local required')
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / (ARGS[ARGS.index('--out') + 1] if '--out' in ARGS else 'docs/release/c13-2026-11-06/restore')
WITH_DISABLE_USER = '--skip-disable-user' not in ARGS
TAG = 'gina_c13r_' + secrets.token_hex(5)
SRC, TGT, TGT2 = TAG + '_src', TAG + '_tgt', TAG + '_tgt2'
STORE = TAG + '_store'            # Storage TENANT_ID/GLOBAL_S3_BUCKET: kaynak ve hedefte aynı (dosya yolu düzeni aynı kalsın)
DBC = 'supabase_db_gina'
TEMPLATE = 'gina_completion_audit'
BUCKET = 'gina-private-sources'
DUMP = f'/tmp/{TAG}_data.dump'   # supabase_db_gina kapsayıcısı içinde; sonunda silinir
PREFIX = 'docker exec -i ' + DBC
created_dbs, containers = [], []
SCRATCH = Path(tempfile.mkdtemp(prefix='gina-c13r-'))
JWT_SECRET = secrets.token_urlsafe(48)                       # yalnız bellekte + 0600 geçici env dosyası
PW = {'a': secrets.token_urlsafe(18), 'b': secrets.token_urlsafe(18)}  # yalnız bellekte
EMAIL = {'a': 'c13-restore-a@test.local', 'b': 'c13-restore-b@test.local'}
FAM = {'a': '10000000-0000-4000-8000-0000000c13a1', 'b': '10000000-0000-4000-8000-0000000c13b1'}
CHILD = {'a': '20000000-0000-4000-8000-0000000c13a1', 'b': '20000000-0000-4000-8000-0000000c13b1'}
SOURCE = {'a': '50000000-0000-4000-8000-0000000c13a1', 'b': '50000000-0000-4000-8000-0000000c13b1'}
DEVICE, DEVICE_USER = '30000000-0000-4000-8000-0000000c13a1', '40000000-0000-4000-8000-0000000c13a1'
T0 = time.time()
report = {
    'card': 'C13 madde 4 — izole geri yükleme tatbikatı',
    'environment': 'disposable-local: supabase_db_gina içinde gina_c13r_* klonları + geçici GoTrue/PostgREST/Storage(file backend, tmpfs) kapsayıcıları',
    'hosted_evidence': False,
    'hosted_note': 'pg_dump yerel süper kullanıcıyla (supabase_admin) alındı; bu hosted kanıt DEĞİLDİR. Hosted Supabase PITR/yedek paneli ve süper kullanıcısız geri yükleme (--trigger-mode disable-user, hosted rolüyle) AÇIK.',
    'secrets_policy': 'parolalar, JWT sırrı, imzalı URL belirteçleri ve bağlantı parolaları yazılmadı; bağlantı dizeleri maskeli (yalnız dbname/user)',
    'source': {}, 'dump': {}, 'storage_snapshot': {}, 'targets': {}, 'cleanup': {},
}


# ------------------------------------------------------------------------------------------------ yardımcılar
def run(args, input=None, allow_error=False, timeout=900, binary=False):
    r = subprocess.run(args, input=input, capture_output=True, timeout=timeout, text=not binary)
    if r.returncode and not allow_error:
        err = r.stderr if not binary else r.stderr.decode('utf8', 'replace')
        lines = [l for l in err.splitlines() if 'ERROR' in l or 'error' in l.lower()][-5:]
        raise RuntimeError('command_failed: ' + ' '.join(str(a) for a in args[:4]) + ' :: ' + ' | '.join(lines)[-1200:])
    return r


def sql(db, body, owner=False, allow_error=False):
    """Yazma yalnız gina_c13r_* klonlarında. postgres/şablon yalnız 'begin read only' ile okunur."""
    if not db.startswith(TAG):
        if db not in ('postgres', TEMPLATE):
            raise RuntimeError('unexpected_database')
        body = 'begin read only;\n' + body.rstrip().rstrip(';') + ';\ncommit;'
        owner = True
    role = 'supabase_admin' if owner else 'postgres'
    r = run(['docker', 'exec', '-i', DBC, 'psql', '-X', '-qAt', '-U', role, '-d', db, '-v', 'ON_ERROR_STOP=1'], input=body, allow_error=True)
    if r.returncode:
        if allow_error:
            return 'ERROR:' + (r.stderr.strip().splitlines() or ['unknown'])[0][:300]
        raise RuntimeError('sql_failed(' + db.replace(TAG, '<tag>') + '): ' + ' | '.join(l for l in r.stderr.splitlines() if 'ERROR' in l)[:900])
    return r.stdout.strip()


def admin_db(stmt, db):
    if not db.startswith(TAG):
        raise RuntimeError('refusing_non_drill_database')
    r = run(['docker', 'exec', '-i', DBC, 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=stmt, allow_error=True)
    return r.returncode == 0, (r.stderr.strip().splitlines() or [''])[0][:300]


def inspect_env(name):
    data = json.loads(run(['docker', 'inspect', name]).stdout)[0]
    return data['Config']['Image'], dict(v.split('=', 1) for v in data['Config']['Env'])


def db_url(original, db):
    p = urllib.parse.urlsplit(original)
    if p.hostname != DBC:
        raise RuntimeError('unexpected_local_database_host')
    return urllib.parse.urlunsplit(p._replace(path='/' + db))


def mint(role):
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).decode().rstrip('=')
    body = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'role': role, 'iss': 'supabase', 'iat': int(time.time()), 'exp': int(time.time()) + 3600})
    return body + '.' + base64.urlsafe_b64encode(hmac.new(JWT_SECRET.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip('=')


ANON, SERVICE = mint('anon'), mint('service_role')


def jwt_payload(token):
    part = token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))


def http(method, port, path, body=None, token=None, headers=None, raw=False):
    hdr = dict(headers or {})
    data = None
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data = bytes(body)
        else:
            data = json.dumps(body).encode(); hdr.setdefault('content-type', 'application/json')
    if token:
        hdr['authorization'] = 'Bearer ' + token
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=data, method=method, headers=hdr)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            content = r.read()
            return r.status, content if raw else _json(content), dict(r.headers)
    except urllib.error.HTTPError as e:
        content = e.read()
        return e.code, content if raw else _json(content), dict(e.headers)


def _json(content):
    try:
        return json.loads(content or b'null')
    except Exception:
        return None


def start(name, image, env, port, tmpfs=False):
    if not name.startswith(TAG):
        raise RuntimeError('refusing_non_drill_container')
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-c13r-env-') as f:
        os.chmod(f.name, 0o600)
        for k, v in env.items():
            if '\n' in v:
                raise RuntimeError('invalid_env_value')
            f.write(f'{k}={v}\n')
        f.flush()
        containers.append(name)
        run(['docker', 'run', '-d', '--name', name, '--network', 'supabase_network_gina', '-p', f'127.0.0.1::{port}', '--env-file', f.name,
             *(['--tmpfs', '/mnt:rw,size=64m,mode=1777'] if tmpfs else []), image])
    return int(json.loads(run(['docker', 'inspect', name]).stdout)[0]['NetworkSettings']['Ports'][f'{port}/tcp'][0]['HostPort'])


def healthy(port, path):
    for _ in range(90):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError(f'service_not_ready_{path}')


def stop(name):
    ok = run(['docker', 'rm', '-f', name], allow_error=True).returncode == 0
    if name in containers:
        containers.remove(name)
    return ok


def start_services(db, label):
    auth_image, auth_base = inspect_env('supabase_auth_gina')
    rest_image, rest_base = inspect_env('supabase_rest_gina')
    storage_image, storage_base = inspect_env('supabase_storage_gina')
    base = f'{TAG}_{label}'
    ports = {}
    ports['auth'] = start(base + '_auth', auth_image, {
        'GOTRUE_API_HOST': '0.0.0.0', 'GOTRUE_API_PORT': '9999', 'API_EXTERNAL_URL': 'http://127.0.0.1', 'GOTRUE_SITE_URL': 'http://127.0.0.1',
        'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL': db_url(auth_base['GOTRUE_DB_DATABASE_URL'], db),
        'GOTRUE_DB_MIGRATIONS_PATH': '/usr/local/etc/auth/migrations',
        'GOTRUE_JWT_SECRET': JWT_SECRET, 'GOTRUE_JWT_EXP': '3600', 'GOTRUE_JWT_AUD': 'authenticated', 'GOTRUE_JWT_ADMIN_ROLES': 'service_role',
        'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated', 'GOTRUE_DISABLE_SIGNUP': 'false', 'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true',
        'GOTRUE_MAILER_AUTOCONFIRM': 'true', 'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED': 'true',
        'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI': 'pg-functions://postgres/public/custom_access_token_hook',
    }, 9999)
    ports['rest'] = start(base + '_rest', rest_image, {
        'PGRST_DB_URI': db_url(rest_base['PGRST_DB_URI'], db), 'PGRST_DB_SCHEMAS': 'public',
        'PGRST_DB_EXTRA_SEARCH_PATH': 'public,extensions', 'PGRST_DB_ANON_ROLE': 'anon', 'PGRST_JWT_SECRET': JWT_SECRET,
    }, 3000)
    ports['storage'] = start(base + '_storage', storage_image, {
        'DATABASE_URL': db_url(storage_base['DATABASE_URL'], db), 'ANON_KEY': ANON, 'SERVICE_KEY': SERVICE,
        'AUTH_JWT_SECRET': JWT_SECRET, 'STORAGE_BACKEND': 'file', 'FILE_STORAGE_BACKEND_PATH': '/mnt', 'TENANT_ID': STORE,
        'GLOBAL_S3_BUCKET': STORE, 'STORAGE_S3_REGION': 'local', 'ENABLE_IMAGE_TRANSFORMATION': 'false', 'IMAGE_TRANSFORMATION_ENABLED': 'false',
        'VECTOR_ENABLED': 'false', 'VECTOR_STORE_MIGRATIONS_ENABLED': 'false', 'S3_PROTOCOL_ENABLED': 'false', 'FILE_SIZE_LIMIT': '10485760',
    }, 5000, tmpfs=True)
    healthy(ports['auth'], '/health'); healthy(ports['rest'], '/'); healthy(ports['storage'], '/status')
    return base, ports


def stop_services(base):
    return {s: stop(f'{base}_{s}') for s in ('auth', 'rest', 'storage')}


# ------------------------------------------------------------------------------------------------ DB hazırlığı
def prepare_clone(db, app_schema):
    """app_schema='migrations-on-template' (kaynak) veya 'empty' (hedef: public/gina düşürülür; restore-database.mjs kurar)."""
    ok, err = admin_db(f'create database {db} owner postgres template {TEMPLATE};', db)
    if not ok:
        raise RuntimeError('create_database_failed: ' + err)
    created_dbs.append(db)
    for schema in ('auth', 'storage'):
        cols = f"select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='{schema}' order by table_name,ordinal_position;"
        if sql('postgres', cols) != sql(db, cols, owner=True):
            raise RuntimeError(f'{schema}_template_schema_mismatch')
    versions = sql('postgres', 'select version from auth.schema_migrations order by version;').splitlines()
    if not versions or not all(v.isdigit() and len(v) <= 14 for v in versions):
        raise RuntimeError('unexpected_auth_migration_metadata')
    sql(db, 'insert into auth.schema_migrations(version) values ' + ','.join(f"('{v}')" for v in versions) + ' on conflict do nothing;', owner=True)
    meta = sql('postgres', "select coalesce(jsonb_agg(to_jsonb(m)),'[]') from storage.migrations m;")
    sql(db, "insert into storage.migrations select * from jsonb_populate_recordset(null::storage.migrations, '" + meta.replace("'", "''") + "'::jsonb) on conflict do nothing;", owner=True)
    own = []
    for schema, role in (('auth', 'supabase_auth_admin'), ('storage', 'supabase_storage_admin')):
        own.append(f"""alter schema {schema} owner to {role};
        do $$ declare r record; begin
          for r in select tablename from pg_tables where schemaname='{schema}' loop execute format('alter table {schema}.%I owner to {role}', r.tablename); end loop;
          for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='{schema}' and c.relkind='S' loop execute format('alter sequence {schema}.%I owner to {role}', r.relname); end loop;
          for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='{schema}' loop execute format('alter function %s owner to {role}', r.s); end loop;
        end $$;""")
    # Yerel yığın ACL'ini yansıt (postgres=arwdDxtm on auth.users; hosted'da da vardır) + realtime yayını.
    sql(db, '\n'.join(own) + '\ngrant all on auth.users to postgres;\ncreate publication supabase_realtime;', owner=True)
    migrations = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
    if app_schema == 'migrations-on-template':
        for m in migrations:
            if m.name < '20261103093000':  # şablon bu noktaya kadar şemayı taşır; yalnız yayın satırları
                for line in m.read_text().splitlines():
                    if line.lower().startswith('alter publication supabase_realtime add table '):
                        sql(db, line)
            else:
                sql(db, m.read_text())
        return len(migrations)
    # Hedef: uygulama şemaları yok; hosted'daki public varsayılanlarıyla boş public (restore-database.mjs migration'ları uygular)
    sql(db, """drop schema public cascade; drop schema gina cascade; create schema public authorization postgres;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;""", owner=True)
    return 0


COUNT_TABLES = ['auth.users', 'auth.identities', 'public.families', 'public.family_members', 'public.children', 'public.devices',
                'public.learning_sources', 'storage.objects', 'public.notes', 'gina.note_changes', 'public.audit_log']
EXTRA_COUNT_TABLES = ['storage.buckets', 'auth.sessions', 'auth.refresh_tokens']
# İçerik özetleri: satırların kendisi (yalnız md5 özet yazılır; parola karması dahil ama asla düz yazılmaz).
DIGESTS = {
    'auth.users(id,email,encrypted_password,role,aud,email_confirmed_at)': "select md5(coalesce(string_agg(id||'|'||coalesce(email,'')||'|'||coalesce(encrypted_password,'')||'|'||coalesce(role,'')||'|'||coalesce(aud,'')||'|'||coalesce(email_confirmed_at::text,''), ',' order by id),'')) from auth.users",
    'auth.identities(user_id,provider,provider_id)': "select md5(coalesce(string_agg(user_id||'|'||provider||'|'||provider_id, ',' order by provider_id),'')) from auth.identities",
    'public.families': "select md5(coalesce(string_agg(to_jsonb(f)::text, ',' order by id),'')) from public.families f",
    'public.family_members': "select md5(coalesce(string_agg(to_jsonb(m)::text, ',' order by family_id,user_id),'')) from public.family_members m",
    'public.children': "select md5(coalesce(string_agg(to_jsonb(c)::text, ',' order by id),'')) from public.children c",
    'public.devices': "select md5(coalesce(string_agg(to_jsonb(d)::text, ',' order by id),'')) from public.devices d",
    'public.learning_sources': "select md5(coalesce(string_agg(to_jsonb(s)::text, ',' order by id),'')) from public.learning_sources s",
    'storage.objects(id,bucket_id,name,version,owner_id,metadata)': "select md5(coalesce(string_agg(id||'|'||bucket_id||'|'||name||'|'||coalesce(version,'')||'|'||coalesce(owner_id,'')||'|'||coalesce(metadata::text,''), ',' order by id),'')) from storage.objects",
    'storage.buckets': "select md5(coalesce(string_agg(to_jsonb(b)::text, ',' order by id),'')) from storage.buckets b",
    'public.notes': "select md5(coalesce(string_agg(to_jsonb(n)::text, ',' order by id),'')) from public.notes n",
    'gina.note_changes': "select md5(coalesce(string_agg(to_jsonb(c)::text, ',' order by c.note_id, c.created_at, to_jsonb(c)::text),'')) from gina.note_changes c",
}
RELATIONS = {
    'family_member_parent_a_linked_to_auth_user': f"select count(*) from public.family_members m join auth.users u on u.id=m.user_id where m.family_id='{FAM['a']}' and u.email='{EMAIL['a']}'",
    'family_member_parent_b_linked_to_auth_user': f"select count(*) from public.family_members m join auth.users u on u.id=m.user_id where m.family_id='{FAM['b']}' and u.email='{EMAIL['b']}'",
    'identity_linked_to_user_a': f"select count(*) from auth.identities i join auth.users u on u.id=i.user_id where u.email='{EMAIL['a']}'",
    'device_user_linked': f"select count(*) from public.devices d join auth.users u on u.id=d.auth_user_id where d.id='{DEVICE}'",
    'source_a_has_storage_object': f"select count(*) from public.learning_sources s join storage.objects o on o.name=s.object_path and o.bucket_id='{BUCKET}' where s.id='{SOURCE['a']}' and s.family_id='{FAM['a']}'",
    'source_b_has_storage_object': f"select count(*) from public.learning_sources s join storage.objects o on o.name=s.object_path and o.bucket_id='{BUCKET}' where s.id='{SOURCE['b']}' and s.family_id='{FAM['b']}'",
    'storage_object_size_equals_source_bytes': f"select count(*) from public.learning_sources s join storage.objects o on o.name=s.object_path and o.bucket_id='{BUCKET}' where (o.metadata->>'size')::bigint=s.bytes",
    'note_history_rows_for_family_a': f"select count(*) from gina.note_changes c join public.notes n on n.id=c.note_id where n.family_id='{FAM['a']}'",
    # yetimler (0 beklenir)
    'orphan_family_members': "select count(*) from public.family_members m left join auth.users u on u.id=m.user_id where u.id is null",
    'orphan_identities': "select count(*) from auth.identities i left join auth.users u on u.id=i.user_id where u.id is null",
    'orphan_storage_objects_without_bucket': "select count(*) from storage.objects o left join storage.buckets b on b.id=o.bucket_id where b.id is null",
    'learning_sources_without_storage_object': f"select count(*) from public.learning_sources s left join storage.objects o on o.name=s.object_path and o.bucket_id='{BUCKET}' where o.id is null",
    'storage_objects_without_learning_source': f"select count(*) from storage.objects o left join public.learning_sources s on s.object_path=o.name where o.bucket_id='{BUCKET}' and s.id is null",
}


def counts(db, tables):
    return {t: int(sql(db, f'select count(*) from {t}', owner=True)) for t in tables}


def digests(db):
    return {k: sql(db, q, owner=True) for k, q in DIGESTS.items()}


def relations(db):
    return {k: int(sql(db, q, owner=True)) for k, q in RELATIONS.items()}


ACL_SQL = (ROOT / 'scripts/security/post-restore-acl-check.sql').read_text()


def acl_check(db):
    rows = [r for r in sql(db, ACL_SQL, owner=True).splitlines() if r]
    null_acl = int(sql(db, "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','gina') and p.prokind='f' and p.proacl is null and p.prorettype <> 'trigger'::regtype", owner=True))
    disabled = int(sql(db, "select count(*) from pg_trigger where not tgisinternal and tgenabled='D'", owner=True))
    beyond = [r for r in rows if r not in KNOWN_INTENTIONAL_ANON]
    return {'post_restore_acl_check_rows': len(rows), 'rows': rows[:20], 'rows_beyond_pgtap_102_allowlist': len(beyond),
            'null_acl_non_trigger_functions': null_acl, 'triggers_disabled': disabled}


# supabase/tests/102_rls_grant_hygiene.test.sql ve 116_channel_ui_support.test.sql bilinçli anon istisnası olarak
# get_shared_child_view + unsubscribe_with_token kabul eder; post-restore-acl-check.sql yalnız ilkini istisna sayar
# (S02 sonrası güncellenmemiş). Bu tatbikat ham satırı da, pgTAP allowlist'ini aşan satırı da ayrı yazar.
KNOWN_INTENTIONAL_ANON = {'public.unsubscribe_with_token(p_token text)'}


# ------------------------------------------------------------------------------------------------ servis kanıtları
def sign_in(ports, who, password=None):
    st, body, _ = http('POST', ports['auth'], '/token?grant_type=password', {'email': EMAIL[who], 'password': password or PW[who]})
    return st, (body or {}).get('access_token') if isinstance(body, dict) else None


def rest_rows(ports, path, token):
    st, body, _ = http('GET', ports['rest'], path, token=token)
    return st, (body if isinstance(body, list) else None)


def app_proof(ports, parent_ids, original_sha, object_paths):
    """Gerçek GoTrue girişi, PostgREST RLS ve Storage imzalı URL kanıtı. Sır yazmaz."""
    out = {}
    st, tok_a = sign_in(ports, 'a')
    out['gotrue_password_sign_in_parent_a_status'] = st
    claims = jwt_payload(tok_a) if tok_a else {}
    out['jwt_sub_equals_source_parent_a'] = claims.get('sub') == parent_ids['a']
    out['jwt_gina_family_id_equals_source_family_a'] = (claims.get('gina') or {}).get('family_id') == FAM['a']
    out['jwt_gina_role'] = (claims.get('gina') or {}).get('role')
    st_wrong, tok_wrong = sign_in(ports, 'a', password=secrets.token_urlsafe(18))
    out['gotrue_wrong_password_status'] = st_wrong
    out['gotrue_wrong_password_rejected'] = st_wrong in (400, 401) and not tok_wrong
    st_b, tok_b = sign_in(ports, 'b')
    out['gotrue_password_sign_in_parent_b_status'] = st_b
    claims_b = jwt_payload(tok_b) if tok_b else {}
    out['jwt_b_gina_family_id_equals_source_family_b'] = (claims_b.get('gina') or {}).get('family_id') == FAM['b']
    # --- PostgREST: kendi satırları
    st, rows = rest_rows(ports, '/learning_sources?select=id,family_id,sha256,object_path,bytes', tok_a)
    out['rest_parent_a_learning_sources'] = {'status': st, 'rows': len(rows or []),
        'all_own_family': bool(rows) and all(r['family_id'] == FAM['a'] for r in rows),
        'sha256_equals_original_upload': bool(rows) and rows[0]['sha256'] == original_sha['a'] and rows[0]['object_path'] == object_paths['a']}
    st, rows = rest_rows(ports, '/children?select=id,family_id', tok_a)
    out['rest_parent_a_children'] = {'status': st, 'rows': len(rows or []), 'is_child_a': [r['id'] for r in (rows or [])] == [CHILD['a']]}
    # --- PostgREST: yabancı (veli B) ve anon, A ailesinin satırlarını okuyamaz
    st, rows = rest_rows(ports, f"/learning_sources?select=id&family_id=eq.{FAM['a']}", tok_b)
    out['rest_foreign_parent_b_reads_family_a_learning_sources'] = {'status': st, 'rows': None if rows is None else len(rows)}
    st, rows = rest_rows(ports, f"/children?select=id&family_id=eq.{FAM['a']}", tok_b)
    out['rest_foreign_parent_b_reads_family_a_children'] = {'status': st, 'rows': None if rows is None else len(rows)}
    st, rows = rest_rows(ports, '/learning_sources?select=id', tok_b)
    out['rest_parent_b_sees_only_own_sources'] = {'status': st, 'rows': None if rows is None else len(rows)}
    st, rows = rest_rows(ports, '/learning_sources?select=id', ANON)
    out['rest_anon_learning_sources'] = {'status': st, 'rows': None if rows is None else len(rows)}
    st, rows = rest_rows(ports, '/children?select=id', ANON)
    out['rest_anon_children'] = {'status': st, 'rows': None if rows is None else len(rows)}
    # --- Storage: sunucu (service_role) kısa ömürlü imzalı URL üretir (uygulamanın tasarımı); URL kimliksiz açılır
    path_a = urllib.parse.quote(object_paths['a'])
    st, body, _ = http('POST', ports['storage'], f'/object/sign/{BUCKET}/{path_a}', {'expiresIn': 120}, token=SERVICE)
    signed = (body or {}).get('signedURL') if isinstance(body, dict) else None
    out['storage_sign_service_role_status'] = st
    if signed:
        st_get, content, hdr = http('GET', ports['storage'], signed if signed.startswith('/') else '/' + signed, raw=True)
        out['storage_signed_url_get_status'] = st_get
        out['storage_signed_url_bytes'] = len(content) if st_get == 200 else None
        out['storage_signed_url_sha256_equals_original'] = st_get == 200 and hashlib.sha256(content).hexdigest() == original_sha['a']
        out['storage_signed_url_content_type'] = hdr.get('Content-Type') or hdr.get('content-type')
        # kurcalanmış belirteç reddedilmeli
        tampered = signed[:-4] + ('AAAA' if not signed.endswith('AAAA') else 'BBBB')
        st_t, _, _ = http('GET', ports['storage'], tampered if tampered.startswith('/') else '/' + tampered, raw=True)
        out['storage_tampered_signed_url_status'] = st_t
    # B'nin dosyası da açılabilir mi (ikinci nesne bütünlüğü)
    path_b = urllib.parse.quote(object_paths['b'])
    st, body, _ = http('POST', ports['storage'], f'/object/sign/{BUCKET}/{path_b}', {'expiresIn': 120}, token=SERVICE)
    signed_b = (body or {}).get('signedURL') if isinstance(body, dict) else None
    if signed_b:
        st_get, content, _ = http('GET', ports['storage'], signed_b if signed_b.startswith('/') else '/' + signed_b, raw=True)
        out['storage_object_b_signed_get_status'] = st_get
        out['storage_object_b_sha256_equals_original'] = st_get == 200 and hashlib.sha256(content).hexdigest() == original_sha['b']
    # Negatif: veli A/B ve anon jetonları özel kovadan doğrudan imza alamaz ya da indiremez (storage.objects'te politika yok)
    for label, tok in (('parent_a', tok_a), ('foreign_parent_b', tok_b), ('anon', ANON)):
        st, _, _ = http('POST', ports['storage'], f'/object/sign/{BUCKET}/{path_a}', {'expiresIn': 120}, token=tok)
        st_dl, content, _ = http('GET', ports['storage'], f'/object/authenticated/{BUCKET}/{path_a}', token=tok, raw=True)
        out[f'storage_{label}_sign_family_a_object_status'] = st
        out[f'storage_{label}_download_family_a_object_status'] = st_dl
        out[f'storage_{label}_got_bytes'] = st_dl == 200 and hashlib.sha256(content).hexdigest() == original_sha['a']
    st_pub, _, _ = http('GET', ports['storage'], f'/object/public/{BUCKET}/{path_a}', raw=True)
    out['storage_public_url_status'] = st_pub
    out['pass'] = bool(
        out['gotrue_password_sign_in_parent_a_status'] == 200 and out['jwt_sub_equals_source_parent_a'] and out['jwt_gina_family_id_equals_source_family_a']
        and out['gotrue_wrong_password_rejected'] and out['gotrue_password_sign_in_parent_b_status'] == 200 and out['jwt_b_gina_family_id_equals_source_family_b']
        and out['rest_parent_a_learning_sources']['status'] == 200 and out['rest_parent_a_learning_sources']['rows'] == 1
        and out['rest_parent_a_learning_sources']['all_own_family'] and out['rest_parent_a_learning_sources']['sha256_equals_original_upload']
        and out['rest_parent_a_children']['rows'] == 1 and out['rest_parent_a_children']['is_child_a']
        and out['rest_foreign_parent_b_reads_family_a_learning_sources']['rows'] == 0 and out['rest_foreign_parent_b_reads_family_a_children']['rows'] == 0
        and out['rest_parent_b_sees_only_own_sources']['rows'] == 1
        and (out['rest_anon_learning_sources']['rows'] in (0, None)) and (out['rest_anon_children']['rows'] in (0, None))
        and out.get('storage_signed_url_get_status') == 200 and out.get('storage_signed_url_sha256_equals_original')
        and out.get('storage_object_b_sha256_equals_original') and out.get('storage_tampered_signed_url_status', 200) >= 400
        and not any(out[f'storage_{l}_got_bytes'] for l in ('parent_a', 'foreign_parent_b', 'anon'))
        and out['storage_public_url_status'] >= 400)
    return out


def storage_files(container):
    """tmpfs /mnt altındaki dosyaların listesi (yol, bayt) — yollar sentetik aile UUID'leri içerir, sır değil."""
    r = run(['docker', 'exec', container, 'find', '/mnt', '-type', 'f', '-exec', 'stat', '-c', '%n %s', '{}', '+'], allow_error=True)
    return sorted(l.replace('/mnt/', '', 1).replace(STORE, '<store>') for l in r.stdout.splitlines() if l)


def run_restore(target, mode):
    """scripts/restore-database.mjs: önce dry-run, sonra --execute. Bağlantı dizeleri parola içermez (kapsayıcı içi soket)."""
    conn = f'dbname={target} user=postgres'
    su = f'dbname={target} user=supabase_admin'
    base = ['node', str(ROOT / 'scripts/restore-database.mjs'), '--conn', conn, '--data-dump', DUMP, '--exec-prefix', PREFIX,
            '--expected-counts', str(SCRATCH / 'expected-counts.json'), '--trigger-mode', mode]
    if mode == 'replica':
        base += ['--superuser-conn', su]
    res = {}
    dry_report = SCRATCH / f'{mode}-dry.json'
    r = run(base + ['--report', str(dry_report)], allow_error=True, timeout=120)
    dry = json.loads(dry_report.read_text())
    res['dry_run'] = {'exit': r.returncode, 'mode': dry['mode'], 'steps': [s['step'] for s in dry['plan']],
                      'executed_nothing': dry['steps'] == {} and dry['mode'] == 'dry-run'}
    # yanlış --target-confirm reddedilmeli (çift kapı)
    r = run(base + ['--execute', '--target-confirm', target + '_x'], allow_error=True, timeout=120)
    res['wrong_target_confirm_exit'] = r.returncode
    t = time.time()
    exec_report = SCRATCH / f'{mode}-exec.json'
    r = run(base + ['--execute', '--target-confirm', target, '--report', str(exec_report)], allow_error=True, timeout=1800)
    res['execute_exit'] = r.returncode
    res['execute_seconds'] = round(time.time() - t, 1)
    res['execute_command'] = ('node scripts/restore-database.mjs --conn "dbname=<tgt> user=postgres" '
                              + ('--superuser-conn "dbname=<tgt> user=supabase_admin" ' if mode == 'replica' else '')
                              + f'--data-dump <dump> --exec-prefix "{PREFIX}" --expected-counts <src-counts.json> --trigger-mode {mode} --execute --target-confirm <tgt>')
    res['stdout_tail'] = [l.replace(TAG, '<tag>') for l in r.stdout.splitlines() if not l.startswith('  [')][-12:]
    res['stderr_tail'] = [l.replace(TAG, '<tag>') for l in r.stderr.splitlines()][-8:]
    res['data_step_exit'] = None
    if exec_report.exists():
        rep = json.loads(exec_report.read_text().replace(TAG, '<tag>'))
        for s in rep.get('plan', []):
            s.pop('migrations', None)
        res['script_report'] = rep
        res['data_step_exit'] = (rep.get('steps', {}).get('data') or {}).get('exit')
        res['script_ok'] = rep.get('ok')
    return res


# ------------------------------------------------------------------------------------------------ ana akış
tar_bytes = None
exit_code = 1
try:
    for db in (TEMPLATE,):
        if sql(db, 'select count(*) from public.families; select count(*) from auth.users; select count(*) from storage.objects;') != '0\n0\n0':
            raise RuntimeError('audit_template_is_not_empty')
    migrations_total = len(list((ROOT / 'supabase/migrations').glob('*.sql')))
    report['migrations'] = {'count': migrations_total, 'last': sorted(p.name for p in (ROOT / 'supabase/migrations').glob('*.sql'))[-1]}

    # 1) Kaynak ----------------------------------------------------------------------------------------------
    t = time.time()
    prepare_clone(SRC, 'migrations-on-template')
    src_base, sp = start_services(SRC, 'src')
    parent_ids = {}
    for who in ('a', 'b'):
        st, body, _ = http('POST', sp['auth'], '/signup', {'email': EMAIL[who], 'password': PW[who]})
        uid = ((body or {}).get('user') or {}).get('id') or (body or {}).get('id')
        if st != 200 or not uid:
            raise RuntimeError(f'source_signup_{who}_failed_{st}')
        parent_ids[who] = uid
    sql(SRC, f"""insert into auth.users(id,email,aud,role,instance_id,created_at,updated_at) values('{DEVICE_USER}','c13-restore-device@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000',now(),now());""", owner=True)
    sql(SRC, f"""insert into public.families(id,name,created_by) values('{FAM['a']}','C13 restore A','{parent_ids['a']}'),('{FAM['b']}','C13 restore B','{parent_ids['b']}');
      insert into public.family_members(family_id,user_id) values('{FAM['a']}','{parent_ids['a']}'),('{FAM['b']}','{parent_ids['b']}');
      insert into public.children(id,family_id,name) values('{CHILD['a']}','{FAM['a']}','Restore A child'),('{CHILD['b']}','{FAM['b']}','Restore B child');
      insert into public.devices(id,family_id,auth_user_id,name,active_child_id) values('{DEVICE}','{FAM['a']}','{DEVICE_USER}','Restore tablet','{CHILD['a']}');""")
    # Gerçek Storage API'ye yükleme (sunucu/service_role yolu; uygulamada yükleme sunucunun verdiği imzalı URL ile yapılır)
    original_sha, object_paths, sizes = {}, {}, {}
    for who in ('a', 'b'):
        content = b'%PDF-1.4\n% C13 restore drill synthetic\n' + secrets.token_bytes(48 * 1024 + (7 if who == 'a' else 13)) + b'\n%%EOF\n'
        object_paths[who] = f"{FAM[who]}/{SOURCE[who]}.pdf"
        st, body, _ = http('POST', sp['storage'], f'/object/{BUCKET}/{urllib.parse.quote(object_paths[who])}', content, token=SERVICE,
                           headers={'content-type': 'application/pdf', 'x-upsert': 'false'})
        if st != 200:
            raise RuntimeError(f'source_upload_{who}_failed_{st}')
        original_sha[who] = hashlib.sha256(content).hexdigest(); sizes[who] = len(content)
        sql(SRC, f"""insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent,verified_at)
          values('{SOURCE[who]}','{FAM[who]}','{parent_ids[who]}','document','c13-restore-{who}.pdf','application/pdf',{len(content)},'{original_sha[who]}','{object_paths[who]}','ready','v1',now());""")
    claims_a = json.dumps({'sub': parent_ids['a'], 'role': 'authenticated', 'gina': {'family_id': FAM['a'], 'role': 'parent'}}, separators=(',', ':'))
    for i in range(3):
        value = json.dumps({'title': f'C13 note {i}', 'body': 'Synthetic', 'subject': '', 'visibility': 'private'})
        sql(SRC, f"begin; set local role authenticated; set local request.jwt.claims='{claims_a}'; select public.save_parent_note('{uuid.uuid4()}',null,null,'save',null,'{value}'::jsonb); commit;")
    # Kaynakta aynı kanıt (taban çizgisi) — geri yükleme öncesi servis zinciri çalışıyor mu
    report['source']['app_proof_baseline'] = app_proof(sp, parent_ids, original_sha, object_paths)
    report['source']['uploads'] = {w: {'object_path': object_paths[w], 'bytes': sizes[w], 'sha256': original_sha[w]} for w in ('a', 'b')}
    report['source']['counts'] = counts(SRC, COUNT_TABLES)
    report['source']['extra_counts'] = counts(SRC, EXTRA_COUNT_TABLES)
    report['source']['relations'] = relations(SRC)
    src_digests = digests(SRC)
    report['source']['acl_check'] = acl_check(SRC)
    report['source']['storage_files'] = storage_files(src_base + '_storage')
    # 2) Storage nesne kopyası (bayt) — DB dökümünün dışında
    r = run(['docker', 'exec', src_base + '_storage', 'tar', '-C', '/mnt', '-cf', '-', '.'], binary=True)
    tar_bytes = r.stdout
    report['storage_snapshot'] = {'method': 'docker exec <src_storage> tar -C /mnt -cf - . (busybox tar; xattr taşımaz)', 'tar_bytes': len(tar_bytes),
                                  'files': len(report['source']['storage_files'])}
    report['source']['stop'] = stop_services(src_base)
    report['source']['seconds'] = round(time.time() - t, 1)

    # 3) Döküm ---------------------------------------------------------------------------------------------
    dump_args = ['--data-only', '-n', 'auth', '-n', 'storage', '-n', 'public', '-n', 'gina',
                 '--exclude-table-data=auth.schema_migrations', '--exclude-table-data=storage.migrations']
    run(['docker', 'exec', DBC, 'pg_dump', '-U', 'supabase_admin', '-d', SRC, '-Fc', *dump_args, '-f', DUMP])
    size = run(['docker', 'exec', DBC, 'stat', '-c', '%s', DUMP]).stdout.strip()
    report['dump'] = {'command': 'pg_dump -U supabase_admin -Fc ' + ' '.join(dump_args), 'bytes': int(size), 'taken_as': 'supabase_admin (yerel süper kullanıcı) — hosted kanıt değil',
                      'contains_storage_file_bytes': False}
    (SCRATCH / 'expected-counts.json').write_text(json.dumps(report['source']['counts']))

    # 4–6) Hedef(ler) ---------------------------------------------------------------------------------------
    plan = [(TGT, 'replica', 'tgt')] + ([(TGT2, 'disable-user', 'tgt2')] if WITH_DISABLE_USER else [])
    for target, mode, label in plan:
        res = {'trigger_mode': mode, 'superuser_for_data_load': mode == 'replica'}
        report['targets'][mode] = res
        try:
            prepare_clone(target, 'empty')
            res['before_restore_public_tables'] = int(sql(target, "select count(*) from pg_tables where schemaname in ('public','gina')", owner=True))
            res['restore_database'] = run_restore(target, mode)
            # Betik ok=false dönebilir (ör. ACL kontrolündeki eski allowlist); veri adımı başarılıysa kanıtlar yine koşulur
            res['restore_ok'] = res['restore_database']['data_step_exit'] == 0
            if not res['restore_ok']:
                res['note'] = 'restore-database.mjs veri adımı başarısız; uygulama kanıtı bu hedefte çalıştırılmadı'
                continue
            res['counts'] = counts(target, COUNT_TABLES)
            res['counts_equal_source'] = res['counts'] == report['source']['counts']
            res['extra_counts'] = counts(target, EXTRA_COUNT_TABLES)
            res['relations'] = relations(target)
            res['relations_equal_source'] = res['relations'] == report['source']['relations']
            tgt_digests = digests(target)
            res['content_digest_equal_source'] = {k: tgt_digests[k] == src_digests[k] for k in DIGESTS}
            res['acl_check'] = acl_check(target)
            tb, tp = start_services(target, label)
            r = run(['docker', 'exec', '-i', tb + '_storage', 'tar', '-C', '/mnt', '-xf', '-'], input=tar_bytes, binary=True, allow_error=True)
            res['storage_bytes_restore'] = {'tar_extract_exit': r.returncode, 'files': storage_files(tb + '_storage')}
            res['storage_bytes_restore']['files_equal_source'] = res['storage_bytes_restore']['files'] == report['source']['storage_files']
            res['app_proof'] = app_proof(tp, parent_ids, original_sha, object_paths)
            res['stop'] = stop_services(tb)
            res['pass'] = bool(res['restore_ok'] and res['counts_equal_source'] and res['relations_equal_source']
                               and all(res['content_digest_equal_source'].values())
                               and res['acl_check']['rows_beyond_pgtap_102_allowlist'] == 0 and res['acl_check']['triggers_disabled'] == 0
                               and res['acl_check']['null_acl_non_trigger_functions'] == 0
                               and res['acl_check']['rows'] == report['source']['acl_check']['rows']
                               and res['storage_bytes_restore']['files_equal_source'] and res['app_proof']['pass'])
        except Exception as e:  # bir hedefin hatası diğerini engellemesin; dürüstçe kaydet
            res['error'] = str(e).replace(TAG, '<tag>')[:900]
            res['pass'] = False
    report['ok'] = bool(report['targets'].get('replica', {}).get('pass'))
    exit_code = 0 if report['ok'] else 1
except Exception as e:
    report['error'] = str(e).replace(TAG, '<tag>')[:900]
finally:
    for name in list(containers):
        report['cleanup'][name.replace(TAG, '<tag>') + '_removed'] = stop(name)
    report['cleanup']['dump_file_removed'] = run(['docker', 'exec', DBC, 'rm', '-f', DUMP], allow_error=True).returncode == 0
    for db in created_dbs:
        ok, _ = admin_db(f'drop database if exists {db} with (force);', db)
        report['cleanup'][db.replace(TAG, '<tag>') + '_dropped'] = ok
    shutil.rmtree(SCRATCH, ignore_errors=True)
    tar_bytes = None
    # Doğrulama: hiçbir gina_c13r_ kapsayıcısı/DB'si/döküm dosyası kalmadı
    left_c = run(['docker', 'ps', '-a', '--filter', 'name=gina_c13r_', '--format', '{{.Names}}'], allow_error=True).stdout.split()
    left_db = sql('postgres', "select count(*) from pg_database where datname like 'gina\\_c13r\\_%'")
    left_dump = run(['docker', 'exec', DBC, 'ls', DUMP], allow_error=True).returncode != 0
    report['cleanup']['verified'] = {'containers_left': len(left_c), 'databases_left': int(left_db), 'dump_absent': left_dump, 'scratch_removed': not SCRATCH.exists()}
    report['duration_seconds'] = round(time.time() - T0, 1)
    report['run_tag'] = TAG
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'restore-drill.json').write_text(json.dumps(report, indent=1, ensure_ascii=False) + '\n')
    summary = {'ok': report.get('ok'), 'error': report.get('error'), 'duration_s': report['duration_seconds'], 'cleanup': report['cleanup']['verified']}
    for mode, res in report['targets'].items():
        summary[mode] = {'pass': res.get('pass'), 'restore_exit': (res.get('restore_database') or {}).get('execute_exit'), 'error': res.get('error'),
                         'script_error': ((res.get('restore_database') or {}).get('script_report') or {}).get('error')}
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    sys.exit(exit_code)
