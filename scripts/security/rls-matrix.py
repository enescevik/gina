"""Q03 — RLS/Storage/RPC matrisi. Bütün migration'ları boş, tek kullanımlık bir DB'ye uygular,
katalogdan tablo/fonksiyon/bucket yetki matrisini çıkarır ve sentetik aileyle kuşkulu noktaları
çalıştırarak sınar. Uygulama/demo/üretim DB'sine dokunmaz; sır yazdırmaz.
Kullanım: python3 scripts/security/rls-matrix.py --run-local [--out docs/release/q03-2026-11-06]
"""
from pathlib import Path
import json, re, subprocess, sys, uuid

if '--run-local' not in sys.argv[1:]:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[2]
out = root / (sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'docs/release/q03-2026-11-06')
db = 'gina_q03_' + uuid.uuid4().hex[:10] + '_audit'
created = False

def sql(database, body, owner=False, allow_error=False, role=None):
    role = role or ('supabase_admin' if owner or database != db else 'postgres')
    r = subprocess.run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', role, '-d', database, '-v', 'ON_ERROR_STOP=1'],
                       input=body, text=True, capture_output=True, timeout=300)
    if r.returncode:
        if allow_error:
            return 'ERROR:' + r.stderr.strip().splitlines()[0][:300] if r.stderr.strip() else 'ERROR:unknown'
        raise RuntimeError(r.stderr[-1800:])
    return r.stdout.strip()

def rows(body):
    text = sql(db, "select coalesce(jsonb_agg(t),'[]') from (" + body.rstrip(';') + ") t;")
    return json.loads(text or '[]')

try:
    assert sql('gina_completion_audit', 'begin read only; select count(*) from public.families; select count(*) from auth.users; commit;') == '0\n0'
    sql('postgres', f'create database {db} owner postgres template gina_completion_audit;')
    created = True
    sql(db, 'grant references on auth.users to postgres; create publication supabase_realtime;', owner=True)
    fresh = '--fresh' in sys.argv
    if fresh:
        # Şablondaki hazır public/gina şemasını atıp 108 migration'ı sıfırdan uygula. Barındırılan
        # Supabase'in public şeması için verdiği varsayılan ayrıcalıklar (fonksiyonlara anon/authenticated
        # EXECUTE) burada da kurulur; böylece "revoke edilmemiş fonksiyon" üretimdeki gibi görünür.
        sql(db, """drop schema public cascade; drop schema if exists gina cascade; create schema public authorization postgres;
          grant usage, create on schema public to postgres; grant usage on schema public to anon, authenticated, service_role;
          alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
          alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
          alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
          drop publication if exists supabase_realtime; create publication supabase_realtime;""", owner=True)
    applied = 0
    for migration in sorted((root / 'supabase/migrations').glob('*.sql')):
        if migration.name < '20261103093000' and not fresh:
            for line in migration.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '):
                    sql(db, line)
        else:
            sql(db, migration.read_text())
        applied += 1

    report = {'environment': 'empty-disposable-database' + ('-fresh-public-schema-all-migrations' if fresh else '-template-plus-recent-migrations'),
              'migrations_applied': applied, 'tables': [], 'views': [], 'functions': [], 'storage': {}, 'synthetic': []}
    report['null_acl_functions'] = rows("""select n.nspname as schema, p.proname as name, p.prosecdef as security_definer, p.prorettype::regtype::text = 'trigger' as is_trigger
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','gina') and p.prokind = 'f' and p.proacl is null order by 1,2""")

    # --- Tablolar: RLS, zorlama, doğrudan yetki, politika sayıları --------------------------
    report['tables'] = rows("""
      select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
        (select jsonb_object_agg(r, jsonb_build_object(
            'select', has_table_privilege(r, c.oid, 'SELECT'), 'insert', has_table_privilege(r, c.oid, 'INSERT'),
            'update', has_table_privilege(r, c.oid, 'UPDATE'), 'delete', has_table_privilege(r, c.oid, 'DELETE')))
          from unnest(array['anon','authenticated']) r) as grants,
        (select coalesce(jsonb_object_agg(p.polcmd, p.cnt), '{}') from (
            select case polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end as polcmd, count(*) as cnt
            from pg_policy where polrelid = c.oid group by 1) p) as policies,
        (select count(*) from pg_policy where polrelid = c.oid and (polroles = '{0}' or 'anon'::regrole::oid = any(polroles))) as anon_policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r','p') and n.nspname in ('public','gina') order by 1,2""")

    report['views'] = rows("""
      select n.nspname as schema, c.relname as view,
        coalesce((select true from unnest(c.reloptions) o where o = 'security_invoker=true' or o = 'security_invoker=on'), false) as security_invoker,
        has_table_privilege('anon', c.oid, 'SELECT') as anon_select, has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'v' and n.nspname in ('public','gina') order by 1,2""")

    # --- Fonksiyonlar: security definer, search_path, çalıştırma yetkisi -----------------------
    report['functions'] = rows("""
      select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
        p.prosecdef as security_definer,
        exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%') as search_path_set,
        (select c from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%' limit 1) as search_path,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
        p.prorettype::regtype::text = 'trigger' as is_trigger,
        p.prosrc ~* 'gina\\.is_device\\(\\)' as uses_is_device,
        p.prosrc ~* 'role\\(\\)\\s*=\\s*''device''' as uses_raw_device_role,
        p.prosrc ~* 'revoked_at' as mentions_revoked_at,
        p.prosrc ~* 'gina\\.(is_parent|is_admin|is_admin_strict|assert_admin|is_service|is_device)\\(\\)|auth\\.uid\\(\\)|gina\\.family_id\\(\\)|gina\\.child_id\\(\\)|gina\\.(has_operation_role|has_any_operation_role|assert_operation_role)\\(' as has_caller_check,
        -- C13: dar operatör kapısı (destek/içerik/finans/yayın) — fonksiyon gövdesindeki rol adları
        (select coalesce(jsonb_agg(distinct m[1]), '[]') from regexp_matches(p.prosrc, '''(support|content|finance|release)''', 'g') m
          where p.prosrc ~* 'gina\\.(has_operation_role|has_any_operation_role|assert_operation_role)\\(') as operator_roles
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public','gina') and p.prokind = 'f' order by 1,2,3""")

    # --- Storage -------------------------------------------------------------------------------
    report['storage']['buckets'] = rows("select id, public, file_size_limit, allowed_mime_types from storage.buckets")
    report['storage']['object_policies'] = rows("""
      select polname as name, case polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end as cmd,
        (select array_agg(r::regrole::text) from unnest(polroles) r) as roles
      from pg_policy where polrelid = 'storage.objects'::regclass""")
    report['storage']['objects_rls'] = sql(db, "select relrowsecurity from pg_class where oid='storage.objects'::regclass") == 't'
    report['storage']['grants'] = rows("""select r as role, has_table_privilege(r, 'storage.objects', 'SELECT') as select, has_table_privilege(r, 'storage.objects', 'INSERT') as insert,
      has_table_privilege(r, 'storage.objects', 'UPDATE') as update, has_table_privilege(r, 'storage.objects', 'DELETE') as delete from unnest(array['anon','authenticated']) r""")
    report['storage']['signed_url_seconds'] = {}
    for f in (root / 'supabase/functions').rglob('*.ts'):
        if '.test.' in f.name: continue
        for m in re.finditer(r'createSignedUrl\([^,]+,\s*(\d+)', f.read_text()):
            report['storage']['signed_url_seconds'][str(f.relative_to(root))] = int(m.group(1))

    # --- Sentetik aile ile çalıştırmalı kontroller ---------------------------------------------
    pa = '00000000-0000-4000-8000-0000000000a1'; fa = '10000000-0000-4000-8000-0000000000a1'
    pb = '00000000-0000-4000-8000-0000000000b1'; fb = '10000000-0000-4000-8000-0000000000b1'
    ca = '20000000-0000-4000-8000-0000000000a1'; da = '30000000-0000-4000-8000-0000000000a1'; dua = '40000000-0000-4000-8000-0000000000a1'
    sql(db, f"""insert into auth.users(id,email) values('{pa}','q03-a@example.invalid'),('{pb}','q03-b@example.invalid'),('{dua}','q03-device@example.invalid');
      insert into public.families(id,name,created_by) values('{fa}','Synthetic A','{pa}'),('{fb}','Synthetic B','{pb}');
      insert into public.family_members(family_id,user_id) values('{fa}','{pa}'),('{fb}','{pb}');
      insert into public.children(id,family_id,name) values('{ca}','{fa}','Child A');
      insert into public.devices(id,family_id,auth_user_id,name,active_child_id) values('{da}','{fa}','{dua}','Tablet A','{ca}');""")
    def claims(sub, role, family, extra=None):
        return json.dumps({'sub': sub, 'role': 'authenticated', 'gina': {'family_id': family, 'role': role, **(extra or {})}}, separators=(',', ':'))
    def as_role(pgrole, jwt, statement):
        c = f"set local request.jwt.claims='{jwt}';" if jwt else ''
        return sql(db, f"begin; set local role {pgrole}; {c} {statement}; rollback;", allow_error=True)

    def check(name, passed, detail):
        report['synthetic'].append({'check': name, 'passed': bool(passed), 'detail': detail})

    # anon: her public tablo için select denenir; başarı = bulgu
    anon_leaks = []
    for t in report['tables']:
        if t['schema'] != 'public': continue
        r = as_role('anon', None, f"select count(*) from public.{t['table']}")
        if not r.startswith('ERROR:'): anon_leaks.append(t['table'])
    check('anon_cannot_read_any_public_table', not anon_leaks, anon_leaks)

    # authenticated: gina.* tabloları doğrudan okunamaz
    gina_leaks = []
    for t in report['tables']:
        if t['schema'] != 'gina': continue
        r = as_role('authenticated', claims(pa, 'parent', fa), f"select count(*) from gina.{t['table']}")
        if not r.startswith('ERROR:'): gina_leaks.append(t['table'])
    check('authenticated_cannot_read_gina_schema_tables', not gina_leaks, gina_leaks)

    # aile sınırı: B velisi A ailesinin çocuğunu göremez; kendi ailesi görünür
    r_b = as_role('authenticated', claims(pb, 'parent', fb), f"select count(*) from public.children where family_id='{fa}'")
    r_a = as_role('authenticated', claims(pa, 'parent', fa), f"select count(*) from public.children where family_id='{fa}'")
    check('cross_family_children_hidden', r_b == '0' and r_a == '1', {'other_family': r_b, 'own_family': r_a})

    # çocuk/cihaz: aktif cihaz kendi çocuğunu görür; iptal sonrası görmez
    dev = claims(dua, 'device', fa, {'child_id': ca, 'device_id': da})
    before = as_role('authenticated', dev, "select count(*) from public.children")
    sql(db, f"update public.devices set revoked_at=now() where id='{da}'")
    after = as_role('authenticated', dev, "select count(*) from public.children")
    check('revoked_device_loses_row_access_with_stale_claims', before == '1' and after == '0', {'before': before, 'after': after})
    # iptal edilen cihazın authenticated yetkili RPC çağrıları: is_device kullananlar reddetmeli
    device_rpcs = [f for f in report['functions'] if f['schema'] == 'public' and f['authenticated_execute'] and f['uses_is_device'] and not f['is_trigger'] and f['args'] == '']
    rpc_results = {}
    for f in device_rpcs[:40]:
        r = as_role('authenticated', dev, f"select public.{f['name']}()")
        rpc_results[f['name']] = 'denied' if r.startswith('ERROR:') else 'allowed:' + r[:60]
    sql(db, f"update public.devices set revoked_at=null where id='{da}'")
    check('revoked_device_zero_arg_rpcs_denied', all(v == 'denied' for v in rpc_results.values()) if rpc_results else True, rpc_results)

    # anon tarafından çalıştırılabilen public fonksiyonlar (bulgu listesi; beklenen: yalnız bilinçli paylaşım/okuma)
    anon_fns = [f"{f['schema']}.{f['name']}({f['args']})" for f in report['functions'] if f['anon_execute'] and not f['is_trigger']]
    check('anon_executable_functions_listed', True, anon_fns)

    # authenticated'in doğrudan yazabildiği tablolar (RLS politikası olmayan + grant olan = açık)
    direct_write = []
    for t in report['tables']:
        g = t['grants']['authenticated']
        for cmd in ('insert', 'update', 'delete'):
            if g[cmd] and not t['policies'].get(cmd) and not t['policies'].get('all'):
                direct_write.append(f"{t['schema']}.{t['table']}:{cmd}")
    check('authenticated_write_grants_without_matching_policy', not direct_write, direct_write)

    # security definer + search_path yok
    sd_no_sp = [f"{f['schema']}.{f['name']}({f['args']})" for f in report['functions'] if f['security_definer'] and not f['search_path_set']]
    check('security_definer_without_search_path', not sd_no_sp, sd_no_sp)

    # security definer + authenticated çalıştırabilir + çağıran kontrolü yok (heuristik)
    no_check = [f"{f['schema']}.{f['name']}({f['args']})" for f in report['functions'] if f['security_definer'] and f['authenticated_execute'] and not f['is_trigger'] and not f['has_caller_check']]
    check('security_definer_authenticated_without_caller_check_heuristic', True, no_check)

    # RLS kapalı tablo
    no_rls = [f"{t['schema']}.{t['table']}" for t in report['tables'] if not t['rls_enabled']]
    check('tables_without_rls', not no_rls, no_rls)

    # C13: persona × fonksiyon/tablo sızıntı taraması (scripts/security/c13-rpc-fuzz.sql; tek kullanımlık DB'de, geri alınır)
    fuzz = None
    if '--with-fuzz' in sys.argv:
        fuzz_out = sql(db, (root / 'scripts/security/c13-rpc-fuzz.sql').read_text())
        fuzz = json.loads(fuzz_out.strip().splitlines()[-1])
        report['c13_rpc_fuzz'] = fuzz
        unexpected = [l for l in fuzz['leaks'] if l['leak'] not in ('operator_family_meta',)]
        check('c13_persona_fuzz_no_unexpected_leak', not unexpected, unexpected)
        check('c13_persona_fuzz_positive_control', len(fuzz['positive_control_a_parent_sees_family_data']) > 0 and len(fuzz['positive_control_dev_a1_sees_child1_data']) > 0,
              {'a_parent': len(fuzz['positive_control_a_parent_sees_family_data']), 'dev_a1': len(fuzz['positive_control_dev_a1_sees_child1_data'])})

    report['summary'] = {
        'tables': len(report['tables']), 'tables_without_rls': len(no_rls), 'functions': len(report['functions']),
        'security_definer_functions': sum(1 for f in report['functions'] if f['security_definer']),
        'security_definer_without_search_path': len(sd_no_sp), 'anon_executable_functions': len(anon_fns),
        'authenticated_write_grants_without_policy': len(direct_write),
        'operator_gated_functions': sum(1 for f in report['functions'] if f.get('operator_roles')),
        'c13_fuzz': None if fuzz is None else {'functions': fuzz['functions'], 'tables': fuzz['tables'], 'calls': fuzz['calls'], 'leaks': len(fuzz['leaks'])},
        'synthetic_failed': [c['check'] for c in report['synthetic'] if not c['passed']],
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / ('rls-matrix-fresh.json' if fresh else 'rls-matrix.json')).write_text(json.dumps(report, indent=1, ensure_ascii=False) + '\n')
    print(json.dumps(report['summary'], ensure_ascii=False))
finally:
    if created and '--keep' in sys.argv:
        print('KEPT_DATABASE', db, '(drop manually: drop database ... with(force))')
    elif created:
        sql('postgres', f'drop database {db} with(force);')
