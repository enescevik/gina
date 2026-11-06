"""C05 chain acceptance: official MEB/ÖDSGM source → server download → hash/revision → extraction (queued → done) →
idempotent candidate import → source approval → candidate review/publication → family selection → (deterministic)
question generation → block/count/outcome trace → reasoned content-fit review; plus repeat/changed/stale/
unreachable/wrong-term cases and the DNS/SSRF probe inside the Supabase edge-runtime image.

Environment (all disposable, removed at the end):
- DB `gina_c05_<hex>_audit` cloned from the EMPTY audit template, migrations >= 20261103093000 applied.
- Own Auth + PostgREST containers, and the real Supabase edge-runtime image running the UNCHANGED
  curriculum-source-fetch function (real network to odsgm.meb.gov.tr / meb.ai / cdn.eba.gov.tr).
- prova-generate (unchanged handler) under `deno run` with a deterministic provider boundary
  (scripts/c05-generation-edge.ts). No paid/real AI call; real-provider acceptance stays with C08/C14.
Synthetic example.invalid users only. Usage: python3 scripts/test-curriculum-pipeline-chain.py --run-local
"""
import base64, hashlib, hmac, json, os, re, secrets, signal, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
DB = 'gina_c05_' + secrets.token_hex(6) + '_audit'
EDGE_IMAGE = 'public.ecr.aws/supabase/edge-runtime:v1.77.8'
OUT = ROOT / 'docs/release/c05-2026-11-06'
containers, created, deno = [], False, None
report = {'environment': 'disposable-db+auth+postgrest+supabase-edge-runtime(v1.77.8)+deno-run(prova-generate, deterministic provider)', 'database': DB, 'checks': [], 'cleanup': {}}


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'pass': bool(passed), 'detail': detail})
    if not passed:
        raise RuntimeError('check_failed:' + name + ':' + json.dumps(detail, ensure_ascii=False, default=str)[:600])


def command(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, timeout=300, **kw)
    if r.returncode:
        if 'psql' in args:
            print('\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l)[:2000], file=sys.stderr)
        else:
            print(r.stderr[-1500:], file=sys.stderr)
        raise RuntimeError('local_command_failed')
    return r.stdout


def sql(database, body, owner=False):
    if owner and database != DB:
        raise RuntimeError('ownership_changes_require_disposable_database')
    source_read = database in ('postgres', 'gina_completion_audit') and body.lstrip().lower().startswith('select ')
    if source_read:
        body = 'begin read only;\n' + body + '\ncommit;'
    return command(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin' if owner or source_read else 'postgres',
                    '-d', database, '-v', 'ON_ERROR_STOP=1'], input=body).strip()


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


def start(name, image, env, port, extra=(), args=()):
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-c05-env-') as f:
        os.chmod(f.name, 0o600)
        for k, v in env.items():
            f.write(k + '=' + v + '\n')
        f.flush()
        containers.append(name)
        command(['docker', 'run', '-d', '--name', name, '--network', 'supabase_network_gina', '-p', f'127.0.0.1::{port}', '--env-file', f.name, *extra, image, *args])
    return int(json.loads(command(['docker', 'inspect', name]))[0]['NetworkSettings']['Ports'][f'{port}/tcp'][0]['HostPort'])


def healthy(port, path, accept=(200,)):
    for _ in range(120):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=3) as r:
                if r.status in accept:
                    return
        except urllib.error.HTTPError as e:
            if e.code in accept:
                return
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('local_service_not_ready')


def http(method, url, token, body=None, apikey=None, timeout=60):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'apikey': apikey or token, 'authorization': 'Bearer ' + token, 'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b'null')
        except Exception:
            return e.code, {'raw': raw[:300].decode('utf-8', 'replace')}


try:
    for name in ('supabase_db_gina', 'supabase_auth_gina', 'supabase_rest_gina'):
        inspect(name)
    if sql('gina_completion_audit', 'select count(*) from public.families; select count(*) from auth.users;') != '0\n0':
        raise RuntimeError('audit_template_is_not_empty')
    sql('postgres', f'create database {DB} template gina_completion_audit;')
    created = True
    auth_columns = "select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='auth' order by table_name,ordinal_position;"
    if sql('postgres', auth_columns) != sql(DB, auth_columns, owner=True):
        raise RuntimeError('auth_template_schema_mismatch')
    versions = sql('postgres', 'select version from auth.schema_migrations order by version;').splitlines()
    sql(DB, 'insert into auth.schema_migrations(version) values ' + ','.join("('" + v + "')" for v in versions) + ' on conflict do nothing;')
    sql(DB, """alter schema auth owner to supabase_auth_admin;
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname='auth' loop execute format('alter table auth.%I owner to supabase_auth_admin', r.tablename); end loop;
      for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind='S' loop execute format('alter sequence auth.%I owner to supabase_auth_admin', r.relname); end loop;
      for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' loop execute format('alter function %s owner to supabase_auth_admin', r.signature); end loop;
    end $$;
    grant select, delete, references on auth.users to postgres;
    create publication supabase_realtime;""", owner=True)
    for m in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if m.name >= '20261103093000':
            sql(DB, m.read_text())
    auth_image, auth_base = inspect('supabase_auth_gina')
    rest_image, rest_base = inspect('supabase_rest_gina')
    secret = secrets.token_urlsafe(48)
    service, anon = jwt('service_role', secret), jwt('anon', secret)
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
    edge_port = start(DB + '_edge', EDGE_IMAGE, {
        'QA_AUTH_UPSTREAM': f'http://{DB}_auth:9999', 'QA_REST_UPSTREAM': f'http://{DB}_rest:3000',
        'SUPABASE_URL': f'http://{DB}_edge:9000', 'SUPABASE_ANON_KEY': anon, 'SUPABASE_SERVICE_ROLE_KEY': service,
    }, 9000, extra=['-v', f'{ROOT}/supabase/functions:/home/deno/functions:ro', '-v', f'{ROOT}/packages:/home/packages:ro', '-v', f'{ROOT}/scripts/c05-edge-runtime/main:/home/deno/main:ro',
                    '-v', f'{ROOT}/scripts/c05-edge-runtime/probe:/home/deno/qa/probe:ro'],
        args=['start', '--main-service', '/home/deno/main', '--port', '9000'])
    healthy(edge_port, '/rest/v1/', accept=(200,))
    gateway = f'http://127.0.0.1:{edge_port}'

    # --- DNS/SSRF in the Supabase edge-runtime image (user worker sandbox, real DNS, no protection disabled).
    status, probe = http('GET', gateway + '/c05-probe', anon, timeout=120)
    report['edge_runtime_probe'] = probe
    check('edge_runtime_dns_ssrf_probe', status == 200 and probe.get('passed') is True and probe['runtime']['edge_runtime'] is True,
          {c['name']: c['pass'] for c in probe.get('checks', [])} | {'runtime': probe.get('runtime')})

    # --- Synthetic users: admin (not a family member) and a parent with a grade-5 child.
    def user(prefix):
        email, password = f'gina-c05-{prefix}-{secrets.token_hex(5)}@example.invalid', secrets.token_urlsafe(18)
        _, u = http('POST', f'http://127.0.0.1:{auth_port}/admin/users', service, {'email': email, 'password': password, 'email_confirm': True})
        return u['id'], email, password
    admin_id, admin_email, admin_pw = user('admin')
    parent_id, parent_email, parent_pw = user('parent')
    fam, child, draft, draft_bad = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    sql(DB, f"""insert into public.admins(user_id) values('{admin_id}');
    insert into public.families(id,name,created_by) values('{fam}','C05 sentetik aile','{parent_id}');
    insert into public.family_members(user_id,family_id) values('{parent_id}','{fam}');
    insert into public.children(id,family_id,name,grade) values('{child}','{fam}','Sentetik çocuk',5);
    insert into public.entitlement_overrides(family_id,plan,reason,ends_at) values('{fam}','plus','C05 synthetic chain',now()+interval '1 day');
    update public.app_settings set value='true' where key='curriculum_catalog.enabled';""")

    def login(email, password):
        _, t = http('POST', f'http://127.0.0.1:{auth_port}/token?grant_type=password', anon, {'email': email, 'password': password})
        return t['access_token']
    admin_token, parent_token = login(admin_email, admin_pw), login(parent_email, parent_pw)
    rest = lambda token, fn, args: http('POST', f'http://127.0.0.1:{rest_port}/rpc/{fn}', token, args, apikey=anon)
    edge = lambda token, body: http('POST', gateway + '/functions/v1/curriculum-source-fetch', token, body, apikey=anon, timeout=120)
    target = {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 1, 'subject': 'Türkçe', 'grade': 5}

    # --- 1. Real official download through the unchanged Edge function in the edge-runtime image.
    status, parent_try = edge(parent_token, {'request_id': str(uuid.uuid4()), 'target': target})
    check('edge_fetch_refuses_parent', status == 403, parent_try)
    status, first = edge(admin_token, {'request_id': str(uuid.uuid4()), 'target': target})
    manifest = {e['file']: e for e in json.loads((ROOT / 'docs/learning/catalog/2026-2027-term1/sources/manifest.json').read_text())}
    check('official_download_new_revision', status == 200 and first.get('outcome') == 'new_revision' and first.get('status') == 'pending_review' and first.get('extraction_status') == 'queued',
          {k: first.get(k) for k in ('outcome', 'status', 'extraction_status', 'sha256', 'index', 'officially_verified', 'stored')})
    check('downloaded_hash_matches_repository_manifest', first['sha256'] == manifest['turkce2.xlsx']['sha256'], first['sha256'])
    status, again = edge(admin_token, {'request_id': str(uuid.uuid4()), 'target': target})
    check('unchanged_file_no_duplicate_revision', status == 200 and again.get('outcome') == 'unchanged' and again.get('revision_id') == first.get('revision_id')
          and sql(DB, 'select count(*) from gina.curriculum_source_revisions') == '1', {'outcome': again.get('outcome')})
    _, sources = rest(admin_token, 'admin_list_curriculum_sources', {})
    rev = sources[0]['revisions'][0]
    check('revision_records_chain_mime_size', rev['redirect_chain'][0]['url'].startswith('https://meb.ai/') and rev['redirect_chain'][-1]['status'] == 200
          and rev['resolved_url'].startswith('https://cdn.eba.gov.tr/') and rev['bytes'] == manifest['turkce2.xlsx']['bytes'], {'chain': rev['redirect_chain'], 'bytes': rev['bytes'], 'mime': rev['mime'], 'inspection': rev['inspection']})

    # --- 2. Wrong/future term and unreachable source: explicit, never substituted.
    status, t2 = edge(admin_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'term': 2}})
    check('term2_without_registered_index_unpublished', status == 200 and t2.get('outcome') == 'unpublished' and t2.get('requested') == {'school_year': '2026-2027', 'term': 2}, t2)
    status, y2 = edge(admin_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'school_year': '2027-2028'}})
    check('next_year_unpublished_no_guess', status == 200 and y2.get('outcome') == 'unpublished', y2)
    status, bad_target = rest(admin_token, 'admin_save_curriculum_source_target', {'p_request_id': str(uuid.uuid4()), 'p_target': {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 2, 'index_url': 'https://example.com/odsgm', 'status': 'active', 'note': 'yanlış alan adı'}})
    check('target_foreign_host_rejected', status >= 400 and 'curriculum_target_host' in json.dumps(bad_target), bad_target)
    missing_page = 'https://odsgm.meb.gov.tr/www/c05-qa-bu-sayfa-yok/icerik/0'
    status, saved = rest(admin_token, 'admin_save_curriculum_source_target', {'p_request_id': str(uuid.uuid4()), 'p_target': {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 2, 'index_url': missing_page, 'status': 'active', 'note': 'QA: henüz yayımlanmamış 2. dönem sayfası (erişilemez kaynak testi)'}})
    check('admin_registers_term2_target', status == 200 and saved['action'] == 'created', saved)
    status, unreachable = edge(admin_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'term': 2}})
    check('unreachable_official_page_unverified_no_revision', status == 200 and unreachable.get('outcome') == 'unverified' and str(unreachable.get('error', '')).startswith('index:')
          and unreachable.get('alternative') == 'free_study' and sql(DB, "select count(*) from gina.curriculum_source_revisions r join gina.curriculum_sources s on s.id=r.source_id where s.term=2") == '0', unreachable)
    status, parent_t2 = rest(parent_token, 'get_curriculum_source_status', {'p_year': '2026-2027', 'p_term': 2, 'p_subject': 'Türkçe'})
    check('parent_term2_unverified_free_study_not_term1', parent_t2.get('status') == 'unverified' and parent_t2.get('alternative') == 'free_study' and parent_t2['requested']['term'] == 2 and parent_t2.get('substituted') is False, parent_t2)
    rest(admin_token, 'admin_save_curriculum_source_target', {'p_request_id': str(uuid.uuid4()), 'p_target': {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 2, 'index_url': missing_page, 'status': 'retired', 'note': 'QA: emekliye ayrıldı'}})

    # --- 3. Visible operator step: queued → done, idempotent import.
    env = {**os.environ, 'GINA_SUPABASE_ANON_KEY': anon, 'GINA_ADMIN_ACCESS_TOKEN': admin_token}
    bundles = Path(tempfile.mkdtemp(prefix='gina-c05-bundles-'))
    run = subprocess.run([sys.executable, '-I', str(ROOT / 'scripts/fetch-curriculum-sources.py'), '--process-queue', '--api-url', f'http://127.0.0.1:{edge_port}', '--out', str(bundles)],
                         capture_output=True, text=True, timeout=300, env=env)
    queue_report = json.loads(run.stdout) if run.stdout.strip().startswith('[') else run.stdout[-1500:]
    check('operator_step_extracts_queued_revision', run.returncode == 0 and len(queue_report) == 1 and queue_report[0]['outcome'] == 'done', {'report': queue_report, 'stderr': run.stderr[-800:]})
    imported = queue_report[0]
    repo = [s for s in json.loads((ROOT / 'docs/learning/catalog/2026-2027-term1/scenario-candidates.json').read_text())['scenarios'] if s['source_sha256'] == first['sha256']]
    check('import_count_equals_repository_extraction', imported['created'] == len(repo) and imported['scenarios'] == len(repo)
          and sql(DB, f"select count(*) from gina.curriculum_candidates where source_sha256='{first['sha256']}'") == str(len(repo)), {'created': imported['created'], 'repository': len(repo)})
    rerun = subprocess.run([sys.executable, '-I', str(ROOT / 'scripts/fetch-curriculum-sources.py'), '--process-queue', '--api-url', f'http://127.0.0.1:{edge_port}'], capture_output=True, text=True, timeout=300, env=env)
    check('operator_rerun_no_work', rerun.returncode == 0 and json.loads(rerun.stdout) == [], rerun.stdout[-300:])
    bundle = json.loads(next(bundles.glob('bundle-*.json')).read_text())
    status, replay = rest(admin_token, 'admin_record_curriculum_extraction', {'p_request_id': str(uuid.uuid4()), 'p_revision_id': first['revision_id'],
                          'p_result': {'outcome': 'done', 'extractor': 'extract-meb-scenarios@c05', 'scenarios': len(bundle['candidates']), 'issues': imported.get('issues', 0) or 0, 'error': None, 'bundle': bundle}})
    # issues count differs from the operator's? Then the payload differs but the bundle is the same → still 'unchanged'.
    check('same_bundle_again_unchanged_no_duplicates', status == 200 and replay.get('outcome') == 'unchanged'
          and sql(DB, 'select count(*) from gina.curriculum_candidates') == str(len(repo)), replay)
    for f in bundles.glob('*'):
        f.unlink()
    bundles.rmdir()

    # --- 4. Review: source approval, then candidate review/publication (separate steps).
    _, cands = rest(admin_token, 'admin_list_curriculum_candidates', {})
    pick = next(c for c in cands if c['grade'] == 5 and c['exam'] == 1 and c['question_count'] >= 3)
    _, detail = rest(admin_token, 'admin_get_curriculum_candidate', {'p_id': pick['id']})
    review = {'programme': 'Türkçe Dersi Öğretim Programı (2024)', 'school_scope': 'C05 sentetik doğrulama: yalnız test', 'programme_url': 'https://tymm.meb.gov.tr/ogretim-programlari',
              'source_checked': True, 'counts_checked': True, 'applicability_checked': True, 'issues_resolution': 'Hücreler resmî dosya ile karşılaştırıldı (sentetik test).', 'note': 'C05 zincir testi; gerçek katalog onayı değildir.'}
    status, r = rest(admin_token, 'admin_change_curriculum_candidate', {'p_request_id': str(uuid.uuid4()), 'p_id': pick['id'], 'p_revision': 0, 'p_action': 'review', 'p_review': review, 'p_note': 'Sentetik inceleme', 'p_confirmed': True})
    check('candidate_reviewed', status == 200 and r['status'] == 'reviewed', r)
    status, blocked = rest(admin_token, 'admin_change_curriculum_candidate', {'p_request_id': str(uuid.uuid4()), 'p_id': pick['id'], 'p_revision': 1, 'p_action': 'publish', 'p_review': None, 'p_note': 'Yayın', 'p_confirmed': True})
    check('publish_blocked_until_source_approved', status >= 400 and 'curriculum_source_not_approved' in json.dumps(blocked), blocked)
    status, approved = rest(admin_token, 'admin_review_curriculum_source_revision', {'p_request_id': str(uuid.uuid4()), 'p_revision_id': first['revision_id'], 'p_action': 'approve', 'p_note': 'Özet manifest ile aynı; hücreler kontrol edildi (sentetik).', 'p_confirmed': True})
    check('source_revision_approved', status == 200 and approved['status'] == 'approved', approved)
    status, pub = rest(admin_token, 'admin_change_curriculum_candidate', {'p_request_id': str(uuid.uuid4()), 'p_id': pick['id'], 'p_revision': 1, 'p_action': 'publish', 'p_review': None, 'p_note': 'Yayın', 'p_confirmed': True})
    check('candidate_published_separately', status == 200 and pub['status'] == 'published', pub)

    # --- 5. Family selection.
    status, fresh = rest(parent_token, 'get_curriculum_source_status', {'p_year': '2026-2027', 'p_term': 1, 'p_subject': 'Türkçe'})
    check('parent_sees_verified_not_endorsed', fresh['status'] == 'verified' and fresh['officially_verified'] is False and fresh['stale'] is False, fresh)
    status, scenarios = rest(parent_token, 'get_curriculum_scenarios', {'p_child_id': child, 'p_year': '2026-2027', 'p_term': 1, 'p_exam': 1, 'p_subject': 'Türkçe'})
    check('family_sees_only_published', status == 200 and [s['id'] for s in scenarios] == [pick['id']], [s['id'] for s in scenarios])
    status, bp = rest(parent_token, 'save_catalog_blueprint', {'p_request_id': str(uuid.uuid4()), 'p_input': {'child_id': child, 'catalogue_id': pick['id'], 'revision': 2, 'subject': 'Türkçe', 'confirmed': True}})
    check('family_selects_frozen_copy', status == 200 and re.fullmatch(r'[0-9a-f-]{36}', str(bp)), bp)
    sql(DB, f"""insert into public.prova_drafts(id,family_id,created_by,content) values
     ('{draft}','{fam}','{parent_id}','{{"childId":"{child}","grade":5,"subjects":["Türkçe"],"purpose":"written"}}'),
     ('{draft_bad}','{fam}','{parent_id}','{{"childId":"{child}","grade":5,"subjects":["Türkçe"],"purpose":"written"}}');""")

    # --- 6. Generation through the unchanged prova-generate handler (deterministic provider boundary).
    deno = subprocess.Popen(['deno', 'run', '--frozen', '--config', 'supabase/functions/deno.json', '--allow-net=127.0.0.1',
                             '--allow-env=GINA_QA_ISOLATED,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,OPENAI_API_KEY,GEMINI_API_KEY',
                             'scripts/c05-generation-edge.ts'], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True,
                            env={**os.environ, 'GINA_QA_ISOLATED': '1', 'SUPABASE_URL': gateway, 'SUPABASE_ANON_KEY': anon, 'SUPABASE_SERVICE_ROLE_KEY': service, 'ANTHROPIC_API_KEY': 'synthetic-local-only'})
    line = deno.stdout.readline()
    gen_port = json.loads(line)['port']
    gen = lambda body: http('POST', f'http://127.0.0.1:{gen_port}/prova-generate', parent_token, body, apikey=anon, timeout=120)
    base_req = {'subject': 'Türkçe', 'grade': 5, 'assessment': 'written', 'difficulty': 'orta', 'blueprint_id': bp, 'locale': 'tr'}
    status, wrong = gen({**base_req, 'request_id': str(uuid.uuid4()), 'draft_id': draft_bad, 'note': 'QA:wrong-count'})
    check('wrong_count_rejected_no_rows', status >= 400 and sql(DB, 'select count(*) from public.question_bank') == '0', {'status': status, 'body': wrong})
    status, done = gen({**base_req, 'request_id': str(uuid.uuid4()), 'draft_id': draft})
    check('generation_completed', status == 200, {'status': status, 'body': done})
    _, stats = http('GET', f'http://127.0.0.1:{gen_port}/__qa-provider-stats', anon)
    sent = stats['received'][-1]
    cand_blocks = detail['candidate']['blocks']
    check('provider_received_full_outcome_text_not_url', not sent['hasUrlOnly'] and len(sent['blocks']) == len(cand_blocks)
          and all(all(o['text'].split()[0].rstrip('.') in b['normalized_text'] or o['text'][:20] in b['normalized_text'] for o in cb['outcomes']) for b, cb in zip(sent['blocks'], cand_blocks)),
          {'blocks': [{'block_id': b['block_id'], 'count': b['count'], 'outcome_ids': b['outcome_ids']} for b in sent['blocks']]})
    rows = json.loads(sql(DB, f"select coalesce(json_agg(json_build_object('id',id,'topic',topic,'prov',provenance) order by created_at,id),'[]') from public.question_bank where family_id='{fam}'"))
    expected = {f'B{i + 1}': b['count'] for i, b in enumerate(cand_blocks)}
    got = {}
    for q in rows:
        got[q['prov']['block_id']] = got.get(q['prov']['block_id'], 0) + 1
    check('question_count_equals_scenario_total', len(rows) == detail['candidate']['question_count'], {'questions': len(rows), 'scenario_total': detail['candidate']['question_count']})
    check('per_block_counts_match', got == expected, {'got': got, 'expected': expected})
    block_ids = {f'B{i + 1}': [(o.get('code') or 'cell:' + o['cell']) for o in b['outcomes']] for i, b in enumerate(cand_blocks)}
    check('every_question_traces_block_outcomes_source', all(q['prov']['catalogue_id'] == pick['id'] and q['prov']['source_sha256'] == first['sha256']
          and set(q['prov']['outcome_ids']) <= set(block_ids[q['prov']['block_id']]) and q['prov'].get('rubric', {}).get('criteria') for q in rows),
          [{'block': q['prov']['block_id'], 'outcomes': q['prov']['outcome_ids'], 'cells': q['prov'].get('source_cells')} for q in rows])
    shared = [q for q in rows if q['prov'].get('shared_source_id')]
    check('shared_source_one_identity_questions_counted_separately', len({q['prov']['shared_source_id'] for q in shared}) <= 1 and len(shared) == (expected.get('B1', 0) if expected.get('B1', 0) >= 2 else 0), len(shared))
    check('content_fit_pending_not_success', all(q['prov']['content_fit'] == 'pending_human_review' for q in rows), None)
    ids = [q['id'] for q in rows]
    _, fit = rest(parent_token, 'get_scenario_question_fit', {'p_question_ids': ids})
    check('fit_review_queue_pending_unaccepted', fit['summary']['pending_human_review'] == len(ids) and fit['summary']['accepted'] is False, fit['summary'])
    q0 = rows[0]
    status, reviewed = rest(parent_token, 'review_scenario_question_fit', {'p_request_id': str(uuid.uuid4()), 'p_question_id': q0['id'], 'p_input': {
        'decision': 'fit', 'reason': 'Soru blok çıktısını doğrudan ölçüyor; beklenen cevap ve rubrik tutarlı (sentetik inceleme).', 'measured_outcome_ids': q0['prov']['outcome_ids'], 'revision': 0, 'confirmed': True}})
    _, fit2 = rest(parent_token, 'get_scenario_question_fit', {'p_question_ids': ids})
    check('reasoned_fit_recorded_set_still_unaccepted', status == 200 and reviewed['decision'] == 'fit' and fit2['summary']['fit'] == 1 and fit2['summary']['accepted'] is (len(ids) == 1), fit2['summary'])

    # --- 7. Changed source must not break the assigned copy; old/stale source is visible.
    before = sql(DB, f"select md5(coalesce((select json_agg(q order by id)::text from public.question_bank q),'')||(select snapshot::text from gina.catalog_blueprint_links)||(select row_to_json(b)::text from public.exam_blueprints b))")
    sql(DB, f"""begin; set local role service_role; select set_config('request.jwt.claims','{{"role":"service_role"}}',true);
     select public.record_curriculum_source_fetch(gen_random_uuid(),'{admin_id}',jsonb_build_object('source_key','oyss:2026-2027:1:turkce','exam_family','oyss','school_year','2026-2027','term',1,'label','Türkçe',
      'index_url','https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','link_url','https://meb.ai/ankmeb4','index_published_on','2026-09-07','index_updated_on','2026-09-10','error',null),
      jsonb_build_object('sha256',repeat('d',64),'bytes',31500,'mime','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','resolved_url','https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx','redirect_chain','[]'::jsonb,'inspection','{{}}'::jsonb,'storage_path',null)); commit;""")
    after = sql(DB, f"select md5(coalesce((select json_agg(q order by id)::text from public.question_bank q),'')||(select snapshot::text from gina.catalog_blueprint_links)||(select row_to_json(b)::text from public.exam_blueprints b))")
    _, changed = rest(parent_token, 'get_curriculum_source_status', {'p_year': '2026-2027', 'p_term': 1, 'p_subject': 'Türkçe'})
    check('changed_source_diff_review_assigned_copy_unchanged', before == after and changed['status'] == 'diff_review_required' and changed['last_approved_sha256'] == first['sha256'], changed)
    sql(DB, "update gina.curriculum_sources set last_checked_at=now()-interval '9 days'")
    _, stale = rest(parent_token, 'get_curriculum_source_status', {'p_year': '2026-2027', 'p_term': 1, 'p_subject': 'Türkçe'})
    check('old_check_shown_stale', stale['stale'] is True and stale['stale_days'] == 9, {k: stale[k] for k in ('stale', 'stale_days', 'status')})
    report['summary'] = {'source': {'url': rev['resolved_url'], 'sha256': first['sha256'], 'bytes': rev['bytes'], 'chain': rev['redirect_chain']},
                         'candidates_imported': imported['created'], 'published_candidate': {'key': pick['key'], 'question_count': detail['candidate']['question_count'], 'blocks': expected},
                         'generated_questions': len(rows), 'per_block': got, 'fit_summary_after_one_review': fit2['summary']}
except Exception as e:
    report['error'] = str(e) if isinstance(e, RuntimeError) else 'setup_failed:' + type(e).__name__ + ':' + str(e)[:400]
finally:
    if deno:
        try:
            os.killpg(deno.pid, signal.SIGTERM)
            deno.wait(timeout=5)
        except Exception:
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
    report['passed'] = sum(c['pass'] for c in report['checks'])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'chain-checks.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'edge_runtime_probe'}, indent=2, ensure_ascii=False))
    if 'error' in report or not all(report['cleanup'].values()):
        sys.exit(1)
