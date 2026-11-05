"""Q03 — yedek/geri yükleme tatbikatı. Yalnız tek kullanımlık yerel DB klonları ve geçici GoTrue
kapsayıcılarıyla çalışır; mevcut uygulama/demo/üretim verisine dokunmaz; sır yazdırmaz.

Akış: kaynak DB (şablon + migration'lar) → gerçek GoTrue ile sentetik veli kaydı → aile/çocuk/cihaz/
kaynak dosyası/not geçmişi satırları → üç döküm/geri yükleme varyantı:
  A) yalnız public+gina (mevcut yaklaşım) → boş hedefe
  B) auth+storage+public+gina, tetikleyiciler açık → boş hedefe
  C) auth+storage+public+gina, --disable-triggers (süper kullanıcı) → boş hedefe
Her varyantta satır sayısı, FK/ilişki, fonksiyon ACL ve tetikleyici paritesi; başarılı hedefte GoTrue ile
parola girişi ve JWT'deki gina.family_id doğrulanır.
Kullanım: python3 scripts/security/restore-drill.py --run-local [--out docs/release/q03-2026-11-06]
"""
import base64, json, os, secrets, subprocess, sys, tempfile, time, urllib.request, urllib.error, uuid
from pathlib import Path

if '--run-local' not in sys.argv[1:]:
    raise SystemExit('Explicit --run-local required')
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / (sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'docs/release/q03-2026-11-06')
TAG = 'gina_q03r_' + secrets.token_hex(5)
SRC = TAG + '_src_audit'
TARGETS = {'A': TAG + '_a_audit', 'B': TAG + '_b_audit', 'C': TAG + '_c_audit', 'D': TAG + '_d_audit'}
created, containers = [], []
report = {'environment': 'disposable-local-postgres-gotrue', 'variants': {}, 'cleanup': {}}
PASSWORD = secrets.token_urlsafe(18)
EMAIL = 'restore-drill@test.local'
FAMILY = '10000000-0000-4000-8000-00000000d0d0'
CHILD = '20000000-0000-4000-8000-00000000d0d0'
DEVICE = '30000000-0000-4000-8000-00000000d0d0'
DEVICE_USER = '40000000-0000-4000-8000-00000000d0d0'

def run(args, input=None, allow_error=False, timeout=600):
    r = subprocess.run(args, input=input, text=True, capture_output=True, timeout=timeout)
    if r.returncode and not allow_error:
        raise RuntimeError('command_failed: ' + ' '.join(args[:4]) + ' :: ' + '\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l or 'error' in l)[-1500:])
    return r

def sql(database, body, owner=False, allow_error=False):
    role = 'supabase_admin' if owner or database == 'postgres' else 'postgres'
    r = run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', role, '-d', database, '-v', 'ON_ERROR_STOP=1'], input=body, allow_error=True)
    if r.returncode:
        if allow_error: return 'ERROR:' + (r.stderr.strip().splitlines() or ['unknown'])[0][:300]
        raise RuntimeError(r.stderr[-1500:])
    return r.stdout.strip()

def build_schema(db):
    """Boş DB: şablon (auth/storage DDL, veri yok) + uygulama migration'ları; Auth/Storage sahiplikleri servis rollerine."""
    sql('postgres', f'create database {db} owner postgres template gina_completion_audit;')
    created.append(db)
    auth_cols = "select table_name,column_name,data_type from information_schema.columns where table_schema='auth' order by 1,2;"
    if sql('postgres', 'begin read only;' + auth_cols + 'commit;') != sql(db, auth_cols, owner=True):
        raise RuntimeError('auth_template_schema_mismatch')
    versions = sql('postgres', 'begin read only; select version from auth.schema_migrations order by version; commit;').splitlines()
    if not versions or not all(v.isdigit() for v in versions): raise RuntimeError('unexpected_auth_migration_metadata')
    sql(db, 'insert into auth.schema_migrations(version) values ' + ','.join(f"('{v}')" for v in versions) + ' on conflict do nothing;', owner=True)
    sql(db, """alter schema auth owner to supabase_auth_admin;
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname='auth' loop execute format('alter table auth.%I owner to supabase_auth_admin', r.tablename); end loop;
      for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind='S' loop execute format('alter sequence auth.%I owner to supabase_auth_admin', r.relname); end loop;
      for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' loop execute format('alter function %s owner to supabase_auth_admin', r.s); end loop;
    end $$;
    alter schema storage owner to supabase_storage_admin;
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname='storage' loop execute format('alter table storage.%I owner to supabase_storage_admin', r.tablename); end loop;
    end $$;
    grant references on auth.users to postgres; create publication supabase_realtime;""", owner=True)
    for m in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if m.name < '20261103093000':
            for line in m.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '): sql(db, line)
        else:
            sql(db, m.read_text())

def inspect(name):
    data = json.loads(run(['docker', 'inspect', name]).stdout)[0]
    return data['Config']['Image'], dict(v.split('=', 1) for v in data['Config']['Env'])

def db_url(original, db):
    import urllib.parse
    p = urllib.parse.urlsplit(original)
    if p.hostname != 'supabase_db_gina': raise RuntimeError('unexpected_local_database_host')
    return urllib.parse.urlunsplit(p._replace(path='/' + db))

def start_auth(db, jwt_secret):
    image, base = inspect('supabase_auth_gina')
    name = db + '_auth'
    env = {
        'GOTRUE_API_HOST': '0.0.0.0', 'GOTRUE_API_PORT': '9999', 'API_EXTERNAL_URL': 'http://127.0.0.1', 'GOTRUE_SITE_URL': 'http://127.0.0.1',
        'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL': db_url(base['GOTRUE_DB_DATABASE_URL'], db),
        'GOTRUE_DB_MIGRATIONS_PATH': '/usr/local/etc/auth/migrations',
        'GOTRUE_JWT_SECRET': jwt_secret, 'GOTRUE_JWT_EXP': '3600', 'GOTRUE_JWT_AUD': 'authenticated', 'GOTRUE_JWT_ADMIN_ROLES': 'service_role',
        'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated', 'GOTRUE_DISABLE_SIGNUP': 'false', 'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true',
        'GOTRUE_MAILER_AUTOCONFIRM': 'true', 'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED': 'true',
        'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI': 'pg-functions://postgres/public/custom_access_token_hook',
    }
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-q03-env-') as f:
        os.chmod(f.name, 0o600)
        f.write(''.join(f'{k}={v}\n' for k, v in env.items())); f.flush()
        containers.append(name)
        run(['docker', 'run', '-d', '--name', name, '--network', 'supabase_network_gina', '-p', '127.0.0.1::9999', '--env-file', f.name, image])
    port = int(json.loads(run(['docker', 'inspect', name]).stdout)[0]['NetworkSettings']['Ports']['9999/tcp'][0]['HostPort'])
    for _ in range(80):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=2) as r:
                if r.status == 200: return name, port
        except Exception: time.sleep(0.5)
    raise RuntimeError('auth_not_ready')

def stop(name):
    run(['docker', 'rm', '-f', name], allow_error=True)
    if name in containers: containers.remove(name)

def http(port, path, body, token=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=data, method='POST', headers={'content-type': 'application/json', **({'authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, {}

def jwt_payload(token):
    part = token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))

COUNT_TABLES = ['auth.users', 'auth.identities', 'public.families', 'public.family_members', 'public.children', 'public.devices',
                'public.learning_sources', 'storage.objects', 'public.notes', 'gina.note_changes', 'public.audit_log']

def counts(db):
    return {t: sql(db, f'select count(*) from {t}', owner=True, allow_error=True) for t in COUNT_TABLES}

def acl_signature(db):
    return sql(db, """select coalesce(string_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')='||coalesce(p.proacl::text,'NULL'), E'\\n' order by 1), '')
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','gina')""")

def trigger_signature(db):
    return sql(db, "select coalesce(string_agg(tgrelid::regclass::text||'.'||tgname||'='||tgenabled::text, E'\\n' order by 1),'') from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'auth.%' and tgrelid::regclass::text not like 'storage.%'")

def relation_checks(db):
    return {
        'auth_user_linked_to_family_member': sql(db, f"select count(*) from public.family_members m join auth.users u on u.id=m.user_id where m.family_id='{FAMILY}'", owner=True),
        'identity_linked_to_user': sql(db, f"select count(*) from auth.identities i join auth.users u on u.id=i.user_id where u.email='{EMAIL}'", owner=True),
        'device_user_linked': sql(db, f"select count(*) from public.devices d join auth.users u on u.id=d.auth_user_id where d.id='{DEVICE}'", owner=True),
        'storage_object_matches_learning_source': sql(db, f"select count(*) from storage.objects o join public.learning_sources s on s.object_path=o.name and o.bucket_id='gina-private-sources' where s.family_id='{FAMILY}'", owner=True),
        'note_history_rows_for_family': sql(db, f"select count(*) from gina.note_changes c join public.notes n on n.id=c.note_id where n.family_id='{FAMILY}'", owner=True),
        'orphan_family_members': sql(db, "select count(*) from public.family_members m left join auth.users u on u.id=m.user_id where u.id is null", owner=True),
    }

try:
    if sql('gina_completion_audit', 'begin read only; select count(*) from public.families; select count(*) from auth.users; commit;', owner=True) != '0\n0':
        raise RuntimeError('audit_template_is_not_empty')
    # --- Kaynak ortam ---------------------------------------------------------------------------
    build_schema(SRC)
    jwt_secret = secrets.token_urlsafe(48)
    auth_name, auth_port = start_auth(SRC, jwt_secret)
    status, body = http(auth_port, '/signup', {'email': EMAIL, 'password': PASSWORD})
    if status != 200 or not body.get('user', {}).get('id'): raise RuntimeError(f'source_signup_failed_{status}')
    parent = body['user']['id']
    stop(auth_name)
    sql(SRC, f"""insert into auth.users(id,email,aud,role,instance_id,created_at,updated_at) values('{DEVICE_USER}','drill-device@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000',now(),now());""", owner=True)
    sql(SRC, f"""insert into public.families(id,name,created_by) values('{FAMILY}','Restore drill','{parent}');
      insert into public.family_members(family_id,user_id) values('{FAMILY}','{parent}');
      insert into public.children(id,family_id,name) values('{CHILD}','{FAMILY}','Drill child');
      insert into public.devices(id,family_id,auth_user_id,name,active_child_id) values('{DEVICE}','{FAMILY}','{DEVICE_USER}','Drill tablet','{CHILD}');
      insert into public.learning_sources(id,family_id,uploaded_by,kind,name,mime,bytes,sha256,object_path,status,storage_consent,verified_at)
        values('50000000-0000-4000-8000-00000000d0d0','{FAMILY}','{parent}','document','drill.pdf','application/pdf',1024,repeat('a',64),'{FAMILY}/drill.pdf','ready','v1',now());""")
    sql(SRC, f"""insert into storage.objects(bucket_id,name,owner_id,metadata) values('gina-private-sources','{FAMILY}/drill.pdf','{parent}','{{"size":1024,"mimetype":"application/pdf"}}'::jsonb);""", owner=True)
    claims = json.dumps({'sub': parent, 'role': 'authenticated', 'gina': {'family_id': FAMILY, 'role': 'parent'}}, separators=(',', ':'))
    for i in range(3):
        key = uuid.uuid4()
        value = json.dumps({'title': f'Note {i}', 'body': 'Synthetic', 'subject': '', 'visibility': 'private'})
        sql(SRC, f"begin; set local role authenticated; set local request.jwt.claims='{claims}'; select public.save_parent_note('{key}',null,null,'save',null,'{value}'::jsonb); commit;")
    report['source'] = {'counts': counts(SRC), 'relations': relation_checks(SRC)}
    src_acl, src_trg = acl_signature(SRC), trigger_signature(SRC)

    # --- Dökümler (kapsayıcı içinde pg_dump; dosya kapsayıcı /tmp'de kalır, sonunda silinir) --------
    # Auth/Storage servislerinin kendi migration metadata tabloları hedefte zaten vardır; dökümden çıkarılır.
    META = ['--exclude-table-data=auth.schema_migrations', '--exclude-table-data=storage.migrations']
    PG = ['docker', 'exec', 'supabase_db_gina']
    dump = lambda key, args: run([*PG, 'pg_dump', '-U', 'supabase_admin', '-d', SRC, '-Fc', *args, '-f', f'/tmp/{TAG}_{key}.dump'])
    dump('A', ['--data-only', '-n', 'public', '-n', 'gina'])
    dump('B', ['--data-only', '-n', 'auth', '-n', 'storage', '-n', 'public', '-n', 'gina', *META])
    dump('D_schema', ['-n', 'public', '-n', 'gina'])                                  # şema + veri + ACL
    dump('D_services', ['--data-only', '-n', 'auth', '-n', 'storage', *META])          # yalnız veri
    sizes = run([*PG, 'sh', '-c', f'wc -c /tmp/{TAG}_*.dump']).stdout.strip().splitlines()
    report['dump_bytes'] = {s.split()[1].split(f'{TAG}_', 1)[-1].split('.')[0]: int(s.split()[0]) for s in sizes if 'total' not in s}
    report['dump_contents'] = {'A': 'public+gina (yalnız veri) — mevcut yaklaşım', 'B': 'auth+storage+public+gina (yalnız veri), tetikleyiciler açık',
                               'C': 'B ile aynı döküm, pg_restore --disable-triggers (süper kullanıcı)',
                               'D': 'public+gina şema+veri+ACL dökümü + auth/storage veri dökümü; hedefte public/gina sıfırdan'}

    def truncate_app_tables(db):
        sql(db, """do $$ declare r record; begin
          for r in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','gina') loop
            execute format('truncate table %I.%I cascade', r.nspname, r.relname);  -- TRUNCATE satır tetikleyicisi çalıştırmaz; tgenabled dokunulmaz
          end loop; end $$;
          truncate table storage.objects, storage.buckets cascade;  -- migration kovayı tohumlar; döküm kendi satırını getirir""", owner=True)

    # --- Geri yükleme varyantları ---------------------------------------------------------------
    for key, target in TARGETS.items():
        v = {'variant': report['dump_contents'][key], 'disable_triggers': key == 'C'}
        build_schema(target)
        v['counts_after_migrations_before_restore'] = counts(target)  # migration tohumları (audit_log vb.) burada görünür
        if key in ('B', 'C'):
            truncate_app_tables(target)  # migration'ların tohum satırları (plans, app_settings, audit_log…) dökümle çakışmasın
            v['app_tables_truncated_before_restore'] = True
        if key == 'D':
            sql(target, """drop schema public cascade; drop schema gina cascade; create schema public authorization postgres;
              grant usage, create on schema public to postgres; grant usage on schema public to anon, authenticated, service_role;
              alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
              alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
              alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;""", owner=True)
            sql(target, 'truncate table storage.objects, storage.buckets cascade;', owner=True)
            v['public_gina_dropped_before_restore'] = True
            # İlk koşuda görülen bulgu: hedefin varsayılan fonksiyon ayrıcalığı (anon/authenticated/service_role EXECUTE)
            # döküm GRANT'lerine EKLENİR; pg_dump anon için REVOKE üretmez → 260 fonksiyon anon'a açıldı. Çare: şema
            # geri yüklemesi boyunca varsayılan fonksiyon ayrıcalığını kaldır, sonra geri ver.
            sql(target, 'alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;', owner=True)
            v['default_function_privileges_removed_during_schema_restore'] = True
        # D: önce Auth/Storage verisi (şablonda şema hazır), sonra public+gina şema+veri (FK'ler auth.users'a bakar).
        steps = {'A': [('A', ['--data-only'])], 'B': [('B', ['--data-only'])], 'C': [('B', ['replica'])],
                 'D': [('D_services', ['--data-only']), ('D_schema', ['--no-owner', '--role=postgres'])]}[key]
        v['restore_exit'] = 0; v['restore_errors'] = []
        for dk, extra in steps:
            if extra == ['replica']:
                # Tetikleyici ve FK denetimlerini oturum düzeyinde kapat (session_replication_role=replica):
                # pg_restore SQL üretir, aynı psql oturumunda yüklenir. Süper kullanıcı gerekir.
                v['method'] = 'pg_restore -f - | psql (session_replication_role=replica)'
                r = run([*PG, 'sh', '-c', f"(echo 'set session_replication_role = replica;'; pg_restore --data-only -f - /tmp/{TAG}_{dk}.dump) | psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d {target}"], allow_error=True)
                errors = [l.split('ERROR:', 1)[-1].strip()[:200] for l in r.stderr.splitlines() if 'ERROR:' in l]
                v['restore_exit'] = v['restore_exit'] or r.returncode
                v['restore_errors'] += [dk + ': ' + e for e in errors][:5]
                if v['restore_exit']: break
                continue
            # Şema dökümünde 'public' şeması zaten var; bu tek beklenen hata dışında her hata durdurur.
            strict = [] if dk == 'D_schema' else ['--exit-on-error']
            r = run([*PG, 'pg_restore', '-U', 'supabase_admin', '-d', target, *strict, *extra, f'/tmp/{TAG}_{dk}.dump'], allow_error=True)
            errors = [l.split('ERROR:', 1)[-1].strip()[:200] for l in r.stderr.splitlines() if 'ERROR:' in l]
            benign = [e for e in errors if 'schema "public" already exists' in e]
            real = [e for e in errors if e not in benign]
            v['restore_exit'] = v['restore_exit'] or (r.returncode if dk != 'D_schema' else (1 if real else 0))
            v['restore_errors'] += [dk + ': ' + e for e in real][:5]
            if benign: v['benign_errors'] = v.get('benign_errors', []) + [dk + ': ' + e for e in benign]
            if v['restore_exit']: break
        v['counts'] = counts(target)
        v['counts_match_source'] = v['counts'] == report['source']['counts']
        v['relations'] = relation_checks(target)
        if key == 'D':
            sql(target, 'alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;', owner=True)
        tgt_acl, tgt_trg = acl_signature(target), trigger_signature(target)
        v['function_acl_parity'] = set(tgt_acl.splitlines()) == set(src_acl.splitlines())
        v['trigger_parity'] = set(tgt_trg.splitlines()) == set(src_trg.splitlines())
        if not v['function_acl_parity']:
            s, t = set(src_acl.splitlines()), set(tgt_acl.splitlines())
            v['acl_diff'] = {'only_in_source': sorted(s - t)[:25], 'only_in_target': sorted(t - s)[:25], 'differing_total': len(s ^ t)}
        if not v['trigger_parity']:
            s, t = set(src_trg.splitlines()), set(tgt_trg.splitlines())
            v['trigger_diff'] = {'only_in_source': sorted(s - t)[:25], 'only_in_target': sorted(t - s)[:25], 'differing_total': len(s ^ t)}
        v['triggers_disabled_left'] = sql(target, "select count(*) from pg_trigger where not tgisinternal and tgenabled='D'")
        if v['restore_exit'] == 0 and v['counts_match_source']:
            name, port = start_auth(target, jwt_secret)
            status, body = http(port, '/token?grant_type=password', {'email': EMAIL, 'password': PASSWORD})
            v['login_status'] = status
            if status == 200 and body.get('access_token'):
                p = jwt_payload(body['access_token'])
                v['jwt_gina_family_matches'] = p.get('gina', {}).get('family_id') == FAMILY and p.get('gina', {}).get('role') == 'parent'
                v['jwt_sub_is_parent'] = p.get('sub') == parent
            stop(name)
        report['variants'][key] = v
    # Hedef A'da auth yok: aile üyesi FK'si kaynağa bağlı değil → ilişki kontrolü sayıları bunu gösterir.
    report['conclusion'] = {
        'public_gina_only_is_full_backup': False,
        'variant_with_login_proof': [k for k, v in report['variants'].items() if v.get('jwt_gina_family_matches')],
        'storage_blob_bytes_included_in_db_dump': False,
    }
finally:
    for name in list(containers):
        report['cleanup'][name.rsplit('_', 2)[-2] + '_auth_removed'] = run(['docker', 'rm', '-f', name], allow_error=True).returncode == 0
    run(['docker', 'exec', 'supabase_db_gina', 'sh', '-c', f'rm -f /tmp/{TAG}_*.dump'], allow_error=True)
    for db in created:
        report['cleanup'][db.rsplit('_', 2)[-2] + '_db_removed'] = not sql('postgres', f'drop database {db} with(force);', allow_error=True).startswith('ERROR:')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'restore-drill.json').write_text(json.dumps(report, indent=1, ensure_ascii=False) + '\n')
    print(json.dumps({k: {'exit': v.get('restore_exit'), 'counts_match': v.get('counts_match_source'), 'login': v.get('login_status'), 'jwt_ok': v.get('jwt_gina_family_matches'), 'acl_parity': v.get('function_acl_parity'), 'errors': v.get('restore_errors')} for k, v in report['variants'].items()}, ensure_ascii=False))
    print(json.dumps(report['cleanup']))
