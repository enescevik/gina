"""H02 acceptance: isolated EMPTY catalogue → first download from a registered target → per-revision extraction →
draft review, all from the backoffice panel with the admin's own session (no copied token, no terminal step), plus
API checks for unauthorized/revoked role, concurrent clicks, same hash, changed source, network error and the
SSRF policy on the extraction path.

Environment (disposable, removed at the end):
- DB `gina_h02_<hex>_audit` cloned from the EMPTY `gina_completion_audit` template, migrations >= 20261103093000.
- Own Auth + PostgREST containers and the real Supabase edge-runtime image (v1.77.8) running the UNCHANGED
  curriculum-source-fetch and the new curriculum-source-extract (real network to odsgm.meb.gov.tr / meb.ai /
  cdn.eba.gov.tr). Storage is not started: revisions carry storage_path=null, extraction re-reads the official URL.
- Synthetic example.invalid admins/parent only. No AI call of any kind.
Usage: GINA_QA_PLAYWRIGHT_PATH=<playwright> python3 scripts/test-h02-panel-extraction.py --run-local [--with-ui]
(--with-ui needs apps/backoffice/out built with NEXT_PUBLIC_SUPABASE_URL=http://gina-c05ui.invalid
 NEXT_PUBLIC_SUPABASE_ANON_KEY=c05-placeholder-anon.)
"""
import base64, concurrent.futures, hashlib, hmac, json, os, secrets, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if sys.argv[1:] not in (['--run-local'], ['--run-local', '--with-ui']):
    raise SystemExit('Explicit --run-local required (optional --with-ui)')
WITH_UI = '--with-ui' in sys.argv
DB = 'gina_h02_' + secrets.token_hex(6) + '_audit'
EDGE_IMAGE = 'public.ecr.aws/supabase/edge-runtime:v1.77.8'
OUT = ROOT / 'docs/release/h02-2026-11-06'
containers, created = [], False
report = {'environment': 'disposable-db+auth+postgrest+supabase-edge-runtime(v1.77.8); real official network; no storage; no AI', 'database': DB, 'checks': [], 'cleanup': {}}


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'pass': bool(passed), 'detail': detail})
    print(('PASS ' if passed else 'FAIL ') + name, file=sys.stderr)
    if not passed:
        raise RuntimeError('check_failed:' + name + ':' + json.dumps(detail, ensure_ascii=False, default=str)[:800])


def command(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, timeout=300, **kw)
    if r.returncode:
        print((r.stderr if 'psql' not in args else '\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l))[-2000:], file=sys.stderr)
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
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-h02-env-') as f:
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


def http(method, url, token, body=None, apikey=None, timeout=150):
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


def counts():
    return dict(zip(('sources', 'revisions', 'candidates', 'published', 'approved'), map(int, sql(DB, """select count(*) from gina.curriculum_sources;
      select count(*) from gina.curriculum_source_revisions; select count(*) from gina.curriculum_candidates;
      select count(*) from gina.curriculum_candidates where status='published'; select count(*) from gina.curriculum_source_revisions where status='approved';""").splitlines())))


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

    def user(prefix, admin=False):
        email, password = f'gina-h02-{prefix}-{secrets.token_hex(5)}@example.invalid', secrets.token_urlsafe(18)
        _, u = http('POST', f'http://127.0.0.1:{auth_port}/admin/users', service, {'email': email, 'password': password, 'email_confirm': True})
        if admin:
            sql(DB, f"insert into public.admins(user_id) values('{u['id']}');")
        return u['id'], email, password

    def login(email, password):
        _, t = http('POST', f'http://127.0.0.1:{auth_port}/token?grant_type=password', anon, {'email': email, 'password': password})
        return t['access_token']

    admin_id, admin_email, admin_pw = user('admin', admin=True)
    admin2_id, admin2_email, admin2_pw = user('admin2', admin=True)
    parent_id, parent_email, parent_pw = user('parent')
    fam = str(uuid.uuid4())
    sql(DB, f"""insert into public.families(id,name,created_by) values('{fam}','H02 sentetik aile','{parent_id}');
    insert into public.family_members(user_id,family_id) values('{parent_id}','{fam}');""")
    admin_token, admin2_token, parent_token = login(admin_email, admin_pw), login(admin2_email, admin2_pw), login(parent_email, parent_pw)
    rest = lambda token, fn, args: http('POST', f'http://127.0.0.1:{rest_port}/rpc/{fn}', token, args, apikey=anon)
    fetch = lambda token, body: http('POST', gateway + '/functions/v1/curriculum-source-fetch', token, body, apikey=anon)
    extract = lambda token, revision, request=None: http('POST', gateway + '/functions/v1/curriculum-source-extract', token,
                                                          {'request_id': request or str(uuid.uuid4()), 'revision_id': revision}, apikey=anon)
    manifest = {e['file']: e for e in json.loads((ROOT / 'docs/learning/catalog/2026-2027-term1/sources/manifest.json').read_text())}
    repo = json.loads((ROOT / 'docs/learning/catalog/2026-2027-term1/scenario-candidates.json').read_text())['scenarios']
    catalog_flag = lambda: sql(DB, "select value from public.app_settings where key='curriculum_catalog.enabled'")

    check('isolated_catalogue_empty', counts() == {'sources': 0, 'revisions': 0, 'candidates': 0, 'published': 0, 'approved': 0}, counts())
    check('global_catalogue_off_at_start', catalog_flag() == 'false', catalog_flag())

    # --- Unauthorized roles never reach the network or the database.
    status, r = fetch(parent_token, {'request_id': str(uuid.uuid4()), 'action': 'list_links', 'target': {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 1}})
    check('parent_cannot_list_index_links', status == 403, r)
    status, r = extract(parent_token, str(uuid.uuid4()))
    check('parent_cannot_extract', status == 403, r)
    status, r = extract(anon, str(uuid.uuid4()))
    check('anon_cannot_extract', status in (401, 403), r)

    # --- Panel (UI tours) from the empty catalogue: download → extraction → draft review, 1280×800 and 768×1024.
    if WITH_UI:
        if not (ROOT / 'apps/backoffice/out/library.html').exists():
            raise RuntimeError('backoffice_build_missing')
        fixture = Path(tempfile.mkstemp(prefix='gina-h02-ui-', suffix='.json')[1])
        os.chmod(fixture, 0o600)
        fixture.write_text(json.dumps({'auth': auth_port, 'rest': rest_port, 'edge': edge_port, 'anon': anon, 'email': admin_email, 'password': admin_pw, 'db': DB}))
        try:
            tour = subprocess.run(['node', 'scripts/test-h02-backoffice-ui.cjs'], cwd=ROOT, env={**os.environ, 'GINA_H02_UI_FIXTURE': str(fixture)}, capture_output=True, text=True, timeout=900)
            sys.stderr.write(tour.stderr[-3000:])
            try:
                ui = json.loads(tour.stdout.strip().splitlines()[-1])
            except Exception:
                ui = {'raw': tour.stdout[-1500:]}
            report['ui_checks'] = ui
            check('backoffice_ui_tours_desktop_and_tablet', tour.returncode == 0 and ui and all(ui.values()), ui)
        finally:
            fixture.unlink()
        c = counts()
        check('ui_left_drafts_only', c['candidates'] == 86 and c['published'] == 0 and c['approved'] == 0 and c['revisions'] == 2, c)

    # --- API: first download of a subject, same hash, concurrent clicks, repeat.
    status, links = fetch(admin_token, {'request_id': str(uuid.uuid4()), 'action': 'list_links', 'target': {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 1}})
    by_text = {}
    for l in links.get('links', []):
        by_text.setdefault(l['text'], []).append(l)
    check('index_links_from_registered_page', status == 200 and links.get('outcome') == 'links' and 'Fizik' in by_text and len(by_text.get('İngilizce', [])) == 2
          and all(l['ambiguous'] for l in by_text['İngilizce']), {'texts': sorted(by_text), 'index': links.get('index')})
    before = counts()
    target = {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 1, 'subject': 'Fizik', 'link_url': by_text['Fizik'][0]['href']}
    status, first = fetch(admin_token, {'request_id': str(uuid.uuid4()), 'target': target})
    check('first_download_new_revision_queued', status == 200 and first.get('outcome') == 'new_revision' and first.get('extraction_status') == 'queued'
          and first.get('sha256') == manifest['fizik2.xlsx']['sha256'], {k: first.get(k) for k in ('outcome', 'status', 'extraction_status', 'sha256', 'stored')})
    status, again = fetch(admin_token, {'request_id': str(uuid.uuid4()), 'target': target})
    check('same_hash_no_new_revision', status == 200 and again.get('outcome') == 'unchanged' and counts()['revisions'] == before['revisions'] + 1, again)
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: extract(admin_token, first['revision_id']), range(2)))
    outcomes = sorted([(s, b.get('outcome') or b.get('error')) for s, b in results])
    fizik = [s for s in repo if s['source_sha256'] == first['sha256']]
    check('concurrent_clicks_one_extraction', (200, 'done') in outcomes and outcomes.count((200, 'done')) == 1
          and all(o in ((200, 'done'), (409, 'extraction_in_progress'), (200, 'already_done')) for o in outcomes), outcomes)
    done = next(b for s, b in results if b.get('outcome') == 'done')
    check('extraction_matches_repository_python_extraction', done['scenarios'] == len(fizik) == 36 and done['extraction']['created'] == 36
          and sql(DB, f"select count(*) from gina.curriculum_candidates where source_sha256='{first['sha256']}'") == '36', {'scenarios': done['scenarios'], 'repo': len(fizik), 'origin': done.get('origin')})
    keys_db = set(sql(DB, f"select external_key from gina.curriculum_candidates where source_sha256='{first['sha256']}'").splitlines())
    check('same_candidate_keys_as_python', keys_db == {s['id'] for s in fizik}, sorted(keys_db ^ {s['id'] for s in fizik})[:5])
    status, repeat = extract(admin_token, first['revision_id'])
    check('repeat_click_already_done', status == 200 and repeat.get('outcome') == 'already_done' and sql(DB, f"select count(*) from gina.curriculum_candidates where source_sha256='{first['sha256']}'") == '36', repeat)
    check('review_only_no_approval_no_publish', sql(DB, f"select string_agg(distinct status,',') from gina.curriculum_candidates where source_sha256='{first['sha256']}'") == 'draft'
          and sql(DB, f"select status from gina.curriculum_source_revisions where id='{first['revision_id']}'") == 'pending_review' and catalog_flag() == 'false', counts())

    # --- Per-level subject: the two İngilizce files are two sources; the same bytes under another card are refused.
    eng = by_text['İngilizce']
    status, orta = fetch(admin_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'subject': 'İngilizce', 'link_url': eng[0]['href'], 'level': 'ortaokul'}})
    if WITH_UI:
        check('ui_created_level_source_reused', status == 200 and orta.get('outcome') == 'unchanged', orta)
    else:
        check('level_source_new_revision', status == 200 and orta.get('outcome') == 'new_revision', orta)
    status, dup = fetch(admin_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'subject': 'İngilizce', 'link_url': eng[0]['href'], 'level': 'lise'}})
    check('same_bytes_other_card_refused', status == 409 and dup.get('error') == 'source_duplicate' and sql(DB, "select count(*) from gina.curriculum_sources where source_key like '%ingilizce-lise'") == '0', dup)
    status, lise = fetch(admin_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'subject': 'İngilizce', 'link_url': eng[1]['href'], 'level': 'lise'}})
    check('other_level_file_is_its_own_source', status == 200 and lise.get('outcome') == 'new_revision' and lise.get('sha256') == manifest['ingilizce_lise2.xlsx']['sha256'], lise)

    # --- Revoked role: JWT still says admin, admins row removed → extraction and download refuse; nothing changes.
    status, ok_before = fetch(admin2_token, {'request_id': str(uuid.uuid4()), 'action': 'list_links', 'target': {'exam_family': 'oyss', 'school_year': '2026-2027', 'term': 1}})
    check('second_admin_can_list_before_revocation', status == 200, ok_before.get('outcome'))
    sql(DB, f"delete from public.admins where user_id='{admin2_id}';")
    before = counts()
    status, r = extract(admin2_token, lise['revision_id'])
    check('revoked_admin_cannot_extract', status == 403 and r.get('error') == 'forbidden', r)
    status, r = fetch(admin2_token, {'request_id': str(uuid.uuid4()), 'target': {**target, 'subject': 'Kimya', 'link_url': by_text['Kimya'][0]['href']}})
    check('revoked_admin_cannot_download', status == 403, r)
    check('revoked_admin_changed_nothing', counts() == before and sql(DB, f"select extraction_attempts from gina.curriculum_source_revisions where id='{lise['revision_id']}'") == '0', counts())

    # --- Changed source / network error / SSRF on the extraction path (synthetic revisions on a real target).
    src = sql(DB, f"select source_id from gina.curriculum_source_revisions where id='{lise['revision_id']}'")
    def synthetic(url, sha):
        return sql(DB, f"""insert into gina.curriculum_source_revisions(source_id,sha256,bytes,mime,resolved_url,retrieved_at,last_checked_at,status,created_by)
          values('{src}','{sha}',1000,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','{url}',now(),now(),'diff_review_required','{admin_id}') returning id;""").splitlines()[0]
    changed = synthetic(manifest['ingilizce_lise2.xlsx']['resolved_url'], '1' * 64)
    status, r = extract(admin_token, changed)
    check('changed_source_failed_verdict', status == 200 and r.get('outcome') == 'failed' and r.get('error') == 'hash_changed_since_fetch'
          and sql(DB, f"select extraction_status from gina.curriculum_source_revisions where id='{changed}'") == 'failed', r)
    status, r = extract(admin_token, changed)
    check('failed_verdict_retry_is_deterministic', status == 200 and r.get('outcome') in ('failed', 'unchanged') and r.get('error') == 'hash_changed_since_fetch'
          and sql(DB, f"select extraction_attempts from gina.curriculum_source_revisions where id='{changed}'") == '2', r)
    missing = synthetic('https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/h02-qa-bu-dosya-yok.xlsx', '2' * 64)
    status, r = extract(admin_token, missing)
    row = sql(DB, f"select extraction_status||'|'||coalesce(extraction_last_error,'')||'|'||(extraction_started_at is null) from gina.curriculum_source_revisions where id='{missing}'")
    check('network_error_not_a_verdict', status == 502 and r.get('error') == 'source_unreachable' and row.startswith('queued|source_unreachable:') and row.endswith('|true'), {'response': r, 'row': row})
    for name, url in (('ssrf_lookalike_host', 'https://cdn.eba.gov.tr.h02-qa.invalid/x.xlsx'), ('ssrf_http_scheme', 'http://cdn.eba.gov.tr/x.xlsx'),
                      ('ssrf_metadata_ip', 'https://169.254.169.254/latest/meta-data'), ('ssrf_userinfo', 'https://user@cdn.eba.gov.tr/x.xlsx')):
        rid = synthetic(url, secrets.token_hex(32))
        status, r = extract(admin_token, rid)
        check(name + '_refused', status == 502 and r.get('error') == 'source_unreachable' and any(k in str(r.get('reason')) for k in ('host_not_allowed', 'https_required', 'url_authority_rejected'))
              and sql(DB, f"select extraction_status from gina.curriculum_source_revisions where id='{rid}'") == 'queued', r)
    status, pipe = rest(admin_token, 'admin_curriculum_pipeline', {})
    check('pipeline_has_no_token_command', status == 200 and pipe['operator_step'] == 'panel:curriculum-source-extract' and 'TOKEN' not in json.dumps(pipe), pipe.get('operator_step'))
    final = counts()
    check('final_no_publication_no_approval_catalogue_off', final['published'] == 0 and final['approved'] == 0 and catalog_flag() == 'false', final)
    report['final_counts'] = final
except Exception as e:
    report['error'] = str(e) if isinstance(e, RuntimeError) else 'setup_failed:' + type(e).__name__ + ':' + str(e)[:400]
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
    report['passed'] = sum(c['pass'] for c in report['checks'])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'chain-checks.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'checks'} | {'checks': [c['name'] for c in report['checks'] if not c['pass']] or 'all passed'}, indent=2, ensure_ascii=False))
    if 'error' in report or not all(report['cleanup'].values()):
        sys.exit(1)
