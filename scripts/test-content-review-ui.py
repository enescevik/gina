"""Backoffice content review UI binding (E01 + M01 + P05 + S06) against disposable local services.

Clones the EMPTY audit template into its own `gina_cqui_<hex>_audit` database, applies migrations
>= 20261103093000, starts its own Auth + PostgREST containers (names prefixed with that DB), seeds a
synthetic fixture (example.invalid admin, no real families), and runs the Playwright tour
`scripts/test-content-review-ui.cjs` against the static build in apps/backoffice/out.
No Edge functions run here: the tour proves the UI shows an explicit error for that case.
No paid AI call is made; AI verdicts are written through the service-role claim/finish RPCs.
Everything it created is removed at the end. Other agents' databases/containers are never touched.
Usage: python3 scripts/test-content-review-ui.py --run-local
"""
import base64, hashlib, hmac, json, os, re, secrets, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
DB = 'gina_cqui_' + secrets.token_hex(6) + '_audit'
FIXTURE = Path(os.environ.get('GINA_CQUI_FIXTURE', f'/tmp/gina-cqui-{DB}.json'))
containers, created = [], False
report = {'environment': 'disposable-local-auth-postgrest-no-edge', 'database': DB, 'checks': {}, 'cleanup': {}}


def command(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, timeout=300, **kw)
    if r.returncode:
        if 'psql' in args:
            print('\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l)[:2000], file=sys.stderr)
        raise RuntimeError('local_command_failed')
    return r.stdout


def sql(database, body, owner=False):
    if owner and database != DB:
        raise RuntimeError('ownership_changes_require_disposable_database')
    source_read = database in ('postgres', 'gina_completion_audit') and body.lstrip().lower().startswith('select ')
    if source_read:
        body = 'begin read only;\n' + body + '\ncommit;'
    return command(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin' if owner or source_read else 'postgres',
                    '-d', database, '-v', 'ON_ERROR_STOP=1'], input=body)


def inspect(name):
    data = json.loads(command(['docker', 'inspect', name]))[0]
    return data['Config']['Image'], dict(v.split('=', 1) for v in data['Config']['Env'])


def database_url(original):
    p = urllib.parse.urlsplit(original)
    if p.hostname != 'supabase_db_gina':
        raise RuntimeError('unexpected_local_database_host')
    return urllib.parse.urlunsplit(p._replace(path='/' + DB))


def jwt(role, secret):
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).decode().rstrip('=')
    body = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'role': role, 'iss': 'supabase', 'iat': int(time.time()), 'exp': int(time.time()) + 3600})
    return body + '.' + base64.urlsafe_b64encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def start(name, image, env, port):
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-cqui-env-') as f:
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
    raise RuntimeError('local_service_not_ready')


def http(method, url, token, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'apikey': token, 'authorization': 'Bearer ' + token, 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b'null')


def fixture_sql(admin_id):
    test = (ROOT / 'supabase/tests/091_content_prereview.test.sql').read_text()
    bundle = re.search(r'\$fixture\$(.*?)\$fixture\$', test, re.S).group(1)
    curriculum = re.search(r"pg_temp\.curriculum\(\) returns jsonb language sql as \$\$select '(.*?)'::jsonb\$\$", test, re.S).group(1)
    fam, a, b = 'c0000000-0000-4000-8000-00000000c001', 'c0000000-0000-4000-8000-00000000c101', 'c0000000-0000-4000-8000-00000000c102'
    snap = lambda title, stem: json.dumps({'title': title, 'body': '', 'grade': 5, 'subject': 'Matematik', 'grouped': False, 'images': [],
                                           'questions': [{'key': 'q1', 'kind': 'open_ended', 'stem': stem, 'choices': [], 'topic': 'Çevre', 'grade': 5,
                                                          'subject': 'Matematik', 'difficulty': 'orta', 'correct_key': None}]}, ensure_ascii=False)
    claims = json.dumps({'sub': admin_id, 'role': 'authenticated', 'gina': {'role': 'parent', 'admin': True}})
    v = lambda conf, status_reason, findings, rec: json.dumps({'model': 'synthetic-local-model', 'prompt_version': 'prereview-v1', 'confidence': conf,
                                                             'recommendation': rec, 'decision_reason': status_reason, 'findings': findings,
                                                             'summary': 'Yerel sentetik sonuç; gerçek AI çağrısı yapılmadı.'}, ensure_ascii=False)
    approved = v(0.93, 'all_checks_passed', [{'code': 'other', 'severity': 'advisory', 'detail': 'Görsel açıklaması kısaltılabilir.'}], 'approve')
    rejected = v(0.9, 'blocking_finding', [{'code': 'answer_key_mismatch', 'severity': 'blocking', 'detail': 'Beklenen cevap çözümle uyuşmuyor.', 'item': 'q1'}], 'reject')
    low = v(0.61, 'low_confidence', [{'code': 'skill_mismatch', 'severity': 'advisory', 'detail': 'Kazanım eşleşmesi belirsiz.'}], 'admin_review')
    sources = []
    for i, (key, label, fresh, checked, err) in enumerate([
        ('oyss:2026-2027:1:matematik', 'İlköğretim Matematik', 'diff_review_required', "now()-interval '10 days'", 'null'),
        ('oyss:2026-2027:1:turkce', 'Türkçe', 'verified', 'now()', 'null'),
        ('oyss:2026-2027:1:fen-bilimleri', 'Fen Bilimleri', 'unverified', "now()-interval '1 day'", "'index:unavailable'")]):
        sid = f'c0000000-0000-4000-8000-00000000d00{i}'
        sources.append(f"insert into gina.curriculum_sources(id,source_key,exam_family,school_year,term,label,index_url,link_url,freshness,last_checked_at,last_check_error,index_published_on,index_updated_on,created_by) values('{sid}','{key}','oyss','2026-2027',1,'{label}','https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','https://meb.ai/ankmeb{i}','{fresh}',{checked},{err},'2026-09-07','2026-09-10','{admin_id}');")
        if fresh != 'unverified' or True:
            sources.append(f"insert into gina.curriculum_source_revisions(source_id,sha256,bytes,mime,resolved_url,retrieved_at,last_checked_at,status,extraction_status,review_note,created_by) values('{sid}',repeat('{'abc'[i]}',64),23454,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/qa{i}.xlsx',now()-interval '30 days',{checked},'approved','done','İlk kopya manifest ile aynı','{admin_id}');")
    sources.append(f"insert into gina.curriculum_source_revisions(source_id,sha256,bytes,mime,resolved_url,inspection,retrieved_at,last_checked_at,status,extraction_status,created_by) values('c0000000-0000-4000-8000-00000000d000',repeat('e',64),24120,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/qa0-v2.xlsx','{{\"entries\":12,\"flags\":[]}}',now()-interval '10 days',now()-interval '10 days','diff_review_required','queued','{admin_id}');")
    jobs = '\n'.join(
        f"insert into public.ai_operation_jobs(family_id,action,input_hash,lease,status,error_code,created_at,updated_at) values('{fam}','{'grade' if n % 2 else 'plan'}','cqui-{n}',gen_random_uuid(),'{['failed', 'uncertain', 'done'][n % 3]}',{'null' if n % 3 == 2 else repr('anthropic_529')},now()-interval '{n} hours',now()-interval '{n} hours');"
        for n in range(1, 41))
    return f"""
insert into public.admins(user_id) values('{admin_id}') on conflict do nothing;
insert into public.families(id,name,created_by) values('{fam}','CQUI sentetik aile','{admin_id}');
insert into gina.contribution_sets(id,family_id,actor_id,snapshot,fingerprint,status,consent_version,review_note,reviewed_at,reviewed_by,created_at)
 values('{a}','{fam}','{admin_id}',$j${snap('Çevre sorusu', 'Dikdörtgenin çevresi kaç metredir?')}$j$::jsonb,'cqui-fp-1','rejected','contribution-v1','Cevap anahtarı eksik; birimi ekleyin.',now()-interval '2 days','{admin_id}',now()-interval '3 days');
insert into gina.contribution_sets(id,family_id,actor_id,snapshot,fingerprint,status,consent_version,supersedes_id,chain_id,created_at)
 values('{b}','{fam}','{admin_id}',$j${snap('Çevre sorusu (düzeltilmiş)', 'Kenarları 3 m ve 5 m olan dikdörtgenin çevresi kaç metredir?')}$j$::jsonb,'cqui-fp-2','pending','contribution-v1','{a}','{a}',now()-interval '1 day');
{chr(10).join(sources)}
{jobs}
begin;
set local role authenticated;
select set_config('request.jwt.claims','{claims}',true);
select public.admin_import_library_bundle('c0000000-0000-4000-8000-00000000e001',$b${bundle}$b$::jsonb||'{{"package_key":"cqui-ai-approved","title":"Geometri havuzu (AI uygun)"}}');
select public.admin_import_library_bundle('c0000000-0000-4000-8000-00000000e002',$b${bundle}$b$::jsonb||'{{"package_key":"cqui-ai-reject","title":"Işın ve doğru (AI ret önerisi)"}}');
select public.admin_import_curriculum_candidates('c0000000-0000-4000-8000-00000000e003',$c${curriculum}$c$::jsonb);
select public.enqueue_content_prereview('all');
commit;
update public.app_settings set value='true' where key='content_prereview.enabled';
create temp table t(kind text,id uuid,status text,verdict jsonb,lease uuid default gen_random_uuid());
grant all on t to service_role;
insert into t(kind,id,status,verdict) select 'library_package',(select id from gina.library_import_packages where package_key='cqui-ai-approved'),'ai_approved',$v${approved}$v$::jsonb;
insert into t(kind,id,status,verdict) select 'library_package',(select id from gina.library_import_packages where package_key='cqui-ai-reject'),'ai_rejected_suggestion',$v${rejected}$v$::jsonb;
insert into t(kind,id,status,verdict) values('contribution_set','{b}','needs_admin',$v${low}$v$::jsonb);
begin;
set local role service_role;
select set_config('request.jwt.claims','{{"role":"service_role"}}',true);
select public.content_prereview_claim(kind,id,lease,'prereview-v1') from t;
select public.content_prereview_finish(kind,id,lease,status,verdict) from t;
commit;
update public.app_settings set value='false' where key='content_prereview.enabled';
select (select count(*) from gina.content_prereviews where prereview_status<>'pending')||'/'||(select count(*) from gina.content_prereviews);
"""


try:
    for name in ('supabase_db_gina', 'supabase_auth_gina', 'supabase_rest_gina'):
        inspect(name)
    if not (ROOT / 'apps/backoffice/out/library.html').exists():
        raise RuntimeError('backoffice_build_missing')
    if sql('gina_completion_audit', 'select count(*) from public.families; select count(*) from auth.users;').strip() != '0\n0':
        raise RuntimeError('audit_template_is_not_empty')
    sql('postgres', f'create database {DB} template gina_completion_audit;')
    created = True
    auth_columns = "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='auth' order by table_name,ordinal_position;"
    if sql('postgres', auth_columns) != sql(DB, auth_columns, owner=True):
        raise RuntimeError('auth_template_schema_mismatch')
    versions = sql('postgres', 'select version from auth.schema_migrations order by version;').splitlines()
    if not versions or not all(v.isdigit() and len(v) <= 14 for v in versions):
        raise RuntimeError('unexpected_auth_migration_metadata')
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
        if m.name >= '20261103093000':
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
    healthy(auth_port, '/health')
    healthy(rest_port, '/')
    service, anon = jwt('service_role', secret), jwt('anon', secret)
    email, password = f'gina-cqui-{secrets.token_hex(6)}@example.invalid', secrets.token_urlsafe(18)
    user = http('POST', f'http://127.0.0.1:{auth_port}/admin/users', service, {'email': email, 'password': password, 'email_confirm': True})
    if not re.fullmatch(r'[0-9a-f-]{36}', user.get('id', '')):
        raise RuntimeError('admin_fixture_failed')
    seeded = sql(DB, fixture_sql(user['id'])).strip().splitlines()[-1]
    report['fixture'] = {'prereviews_with_verdict': seeded}
    FIXTURE.write_text(json.dumps({'auth': auth_port, 'rest': rest_port, 'anon': anon, 'email': email, 'password': password, 'db': DB}))
    os.chmod(FIXTURE, 0o600)
    env = {**os.environ, 'GINA_CQUI_FIXTURE': str(FIXTURE)}
    out = subprocess.run(['node', 'scripts/test-content-review-ui.cjs'], cwd=ROOT, env=env, capture_output=True, text=True, timeout=600)
    sys.stderr.write(out.stderr[-3000:])
    try:
        report['checks'] = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception:
        report['checks'] = {'raw': out.stdout[-2000:]}
    if out.returncode:
        raise RuntimeError('ui_tour_failed')
except Exception as e:
    report['error'] = str(e) if isinstance(e, RuntimeError) else 'setup_failed:' + type(e).__name__ + ':' + str(e)[:300]
finally:
    try:
        FIXTURE.unlink()
    except FileNotFoundError:
        pass
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
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if 'error' in report or not all(report['cleanup'].values()):
        sys.exit(1)
