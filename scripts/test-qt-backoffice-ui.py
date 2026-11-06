"""QT-AI: structured AI rows → real SQL chain + backoffice questions page screenshots, on disposable local services.

Clones the EMPTY audit template into its own `gina_qtai_<hex>_audit` database, applies migrations >= 20261103093000
(same cutoff as the other template-based runners), starts its own Auth + PostgREST containers (names prefixed with that
DB), and:
  1. Chain: rows produced by the real Edge pipeline from a mocked provider output (`scripts/qt-ai-sample-rows.ts`:
     validateGenerationResult + finishGeneration, no AI call) go through reserve_prova_generation_v3 →
     save_prova_provider_result → complete_prova_generation_v2 as service_role. Checks: the job completes, structured
     rows are stored with the key in question_answer_keys only, the child projection carries no key, a row whose key
     bypassed the Edge validator is refused by SQL with the same code, and legacy result fields stay unchanged.
  2. Seeds the same rows as GLOBAL questions (family_id null, via gina.qt_insert_structured) plus one legacy question,
     an example.invalid admin, and runs `scripts/test-qt-backoffice-ui.cjs` (Playwright, 1280x800 + 768x1024).
Everything it created is removed at the end. Other agents' databases/containers are never touched.
Usage: python3 scripts/test-qt-backoffice-ui.py --run-local   (needs apps/backoffice/out built with
NEXT_PUBLIC_SUPABASE_URL=http://gina-qtai.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=qtai-placeholder-anon)
"""
import base64, hashlib, hmac, json, os, re, secrets, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
DB = 'gina_qtai_' + secrets.token_hex(6) + '_audit'
FIXTURE = Path(tempfile.gettempdir()) / f'gina-qtai-{DB}.json'
containers, created = [], False
report = {'environment': 'disposable-local-auth-postgrest-no-edge-no-ai', 'database': DB, 'chain': {}, 'checks': {}, 'cleanup': {}}


def command(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, timeout=600, **kw)
    if r.returncode:
        if 'psql' in args:
            print('\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l or 'DETAIL' in l)[:3000], file=sys.stderr)
        raise RuntimeError('local_command_failed')
    return r.stdout


def sql(database, body, owner=False):
    if database != DB and not body.lstrip().lower().startswith(('select ', 'create database ', 'drop database ')):
        raise RuntimeError('writes_require_disposable_database')
    source_read = database in ('postgres', 'gina_completion_audit') and body.lstrip().lower().startswith('select ')
    if source_read:
        body = 'begin read only;\n' + body + '\ncommit;'
    return command(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin' if owner or source_read else 'postgres',
                    '-d', database, '-v', 'ON_ERROR_STOP=1'], input=body)


def sql_error(body):
    """Run in the disposable DB expecting an error; return the error line(s)."""
    r = subprocess.run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1'],
                       input=body, capture_output=True, text=True, timeout=120)
    return r.returncode, '\n'.join(l for l in r.stderr.splitlines() if 'ERROR' in l or 'DETAIL' in l)


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
    with tempfile.NamedTemporaryFile(mode='w', prefix='gina-qtai-env-') as f:
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


def lit(value):
    return '$q$' + json.dumps(value, ensure_ascii=False) + '$q$::jsonb'


FAM, JOB, BAD_JOB = 'c0000000-0000-4000-8000-0000000a1001', 'c0000000-0000-4000-8000-0000000a2001', 'c0000000-0000-4000-8000-0000000a2002'
JOB2 = 'c0000000-0000-4000-8000-0000000a2003'
PHASE2 = ['mark_text', 'error_fix', 'multi_choice', 'two_stage', 'region_select', 'clock']


def phase2_sql(user_id, rows, job):
    """Faz 2A/2B rows through the same reserve → save → complete chain (one transaction)."""
    n = len(rows)
    ctx = {'schema': 'gina.generation-context.v1', 'promptHash': 'd' * 64, 'total': n, 'catalogueBound': False, 'subject': 'Hayat Bilgisi', 'grade': 2}
    return f"""
begin;
set local role service_role;
select set_config('request.jwt.claims','{{"role":"service_role"}}',true);
select public.reserve_prova_generation_v3('{job}','{FAM}','{user_id}',repeat('d',64),{n},'{{"subject":"Hayat Bilgisi","grade":2,"phase2":true}}'::jsonb,{lit(ctx)});
select public.save_prova_provider_result('{job}',(select lease from public.prova_generation_jobs where id='{job}'),'{{"output":{{"questions":[]}}}}');
select jsonb_array_length(public.complete_prova_generation_v2('{job}',(select lease from public.prova_generation_jobs where id='{job}'),{lit(rows)},'synthetic-local-model','prova-generate/v10-structured-phase2',10,20)->'questions');
commit;
select json_build_object(
 'job_status', (select status from public.prova_generation_jobs where id='{job}'),
 'types', (select jsonb_agg(q.interaction_type order by q.interaction_type) from public.question_bank q where q.provenance->>'prompt_version'='prova-generate/v10-structured-phase2' and q.family_id='{FAM}'),
 'stored_keys', (select count(*) from public.question_answer_keys k join public.question_bank q on q.id=k.question_id where q.family_id='{FAM}' and q.interaction_type in ({",".join("'" + t + "'" for t in PHASE2)})),
 'payload_has_no_key_fields', (select bool_and(q.payload::text !~ '"(targets|errors|correct|count|time|accept_12h|stage1_answer)"') from public.question_bank q where q.family_id='{FAM}' and q.interaction_type in ({",".join("'" + t + "'" for t in PHASE2)})),
 'stimulus_rows', (select count(*) from public.question_bank q where q.family_id='{FAM}' and q.payload ? 'stimulus'));
"""


def chain_sql(user_id, rows):
    n = len(rows)
    ctx = {'schema': 'gina.generation-context.v1', 'promptHash': 'e' * 64, 'total': n, 'catalogueBound': False, 'subject': 'Hayat Bilgisi', 'grade': 2}
    return f"""
update public.ai_operation_policies set per_minute=50 where action='generate';
insert into public.families(id,name,created_by) values('{FAM}','QT-AI sentetik aile','{user_id}');
insert into public.family_members(family_id,user_id) values('{FAM}','{user_id}');
insert into public.learning_credit_grants(family_id,kind,amount,ends_at,reason) values('{FAM}','ai_questions',50,now()+interval '1 day','Synthetic QT-AI chain');
create temp table chain(k text primary key, v jsonb);
grant all on chain to service_role;
begin;
set local role service_role;
select set_config('request.jwt.claims','{{"role":"service_role"}}',true);
insert into chain values('reserve', public.reserve_prova_generation_v3('{JOB}','{FAM}','{user_id}',repeat('e',64),{n},'{{"subject":"Hayat Bilgisi","grade":2,"interaction_types":["true_false"]}}'::jsonb,{lit(ctx)}));
select public.save_prova_provider_result('{JOB}',(select lease from public.prova_generation_jobs where id='{JOB}'),'{{"output":{{"questions":[]}}}}');
insert into chain values('result', public.complete_prova_generation_v2('{JOB}',(select lease from public.prova_generation_jobs where id='{JOB}'),{lit(rows)},'synthetic-local-model','prova-generate/v10-structured-phase2',10,20));
commit;
select json_build_object(
 'reserve_ok', (select v->>'ok' from chain where k='reserve'),
 'questions', (select jsonb_array_length(v->'questions') from chain where k='result'),
 'types', (select jsonb_agg(q->>'interaction_type' order by o) from chain, jsonb_array_elements(v->'questions') with ordinality x(q,o) where k='result'),
 'job_status', (select status from public.prova_generation_jobs where id='{JOB}'),
 'stored_keys', (select count(*) from public.question_answer_keys k join public.question_bank q on q.id=k.question_id where q.family_id='{FAM}'),
 'payload_has_no_key_fields', (select bool_and(q.payload::text !~ '"(answers|pairs|membership|orders|tokens|accepted|unit_factors)"') from public.question_bank q where q.family_id='{FAM}'),
 'student_projection_has_no_key', (select bool_and(gina.qt_student_payload_v1(q.interaction_type,q.payload,k.key,'seed')::text !~ '"(answers|pairs|membership|orders|tokens|accepted|unit_factors)"')
   from public.question_bank q join public.question_answer_keys k on k.question_id=q.id where q.family_id='{FAM}'),
 'solution_not_in_payload', (select bool_and(q.payload::text !~ 'ÇÖZÜM-GİZLİ') from public.question_bank q where q.family_id='{FAM}'),
 'provenance_prompt_version', (select array_agg(distinct q.provenance->>'prompt_version') from public.question_bank q where q.family_id='{FAM}'),
 'usage_rows', (select count(*) from public.prova_ai_usage where family_id='{FAM}')
);
"""


def bad_chain_sql(user_id, row):
    ctx = {'schema': 'gina.generation-context.v1', 'promptHash': 'f' * 64, 'total': 1, 'catalogueBound': False, 'subject': 'Hayat Bilgisi', 'grade': 2}
    return f"""
begin;
set local role service_role;
select set_config('request.jwt.claims','{{"role":"service_role"}}',true);
select public.reserve_prova_generation_v3('{BAD_JOB}','{FAM}','{user_id}',repeat('f',64),1,'{{"subject":"Hayat Bilgisi","grade":2,"bad":true}}'::jsonb,{lit(ctx)});
select public.save_prova_provider_result('{BAD_JOB}',(select lease from public.prova_generation_jobs where id='{BAD_JOB}'),'{{"output":{{"questions":[]}}}}');
select public.complete_prova_generation_v2('{BAD_JOB}',(select lease from public.prova_generation_jobs where id='{BAD_JOB}'),{lit([row])},'synthetic-local-model','prova-generate/v9-structured-types',1,1);
commit;
"""


def global_sql(admin_id, rows):
    out = [f"insert into public.admins(user_id) values('{admin_id}') on conflict do nothing;",
           """insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,choices,correct_key,expected_answer,solution,provenance)
 values('c0000000-0000-4000-8000-0000000b0001',null,2,'Hayat Bilgisi','Canlılar','multiple_choice','kolay','Hangisi bir bitkidir?',
 '[{"key":"A","text":"Kedi"},{"key":"B","text":"Papatya"},{"key":"C","text":"Serçe"},{"key":"D","text":"Taş"}]','B','Papatya','Papatya bir bitkidir.','{"generator":"library"}');"""]
    for i, r in enumerate(rows):
        row = {k: v for k, v in r.items() if k not in ('family_id', 'created_by')}
        prov = {'generator': 'ai', 'model': 'synthetic-local-model', 'prompt_version': 'prova-generate/v9-structured-types'}
        out.append(f"select gina.qt_insert_structured('c0000000-0000-4000-8000-0000000b01{i:02d}',null,{lit(row)},{lit(prov)},'{admin_id}');")
    out.append("select count(*) from public.question_bank where family_id is null;")
    return '\n'.join(out)


try:
    for name in ('supabase_db_gina', 'supabase_auth_gina', 'supabase_rest_gina'):
        inspect(name)
    if not (ROOT / 'apps/backoffice/out/questions.html').exists():
        raise RuntimeError('backoffice_build_missing')
    rows = json.loads(command(['deno', 'run', '--no-lock', '--config', 'supabase/functions/deno.json', 'scripts/qt-ai-sample-rows.ts'], cwd=ROOT))
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
    applied = 0
    for m in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if m.name >= '20261103093000':
            sql(DB, m.read_text())
            applied += 1
    report['migrations_applied'] = applied
    report['last_migration'] = sorted((ROOT / 'supabase/migrations').glob('*.sql'))[-1].name
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
    email, password = f'gina-qtai-{secrets.token_hex(6)}@example.invalid', secrets.token_urlsafe(18)
    user = http('POST', f'http://127.0.0.1:{auth_port}/admin/users', service, {'email': email, 'password': password, 'email_confirm': True})
    if not re.fullmatch(r'[0-9a-f-]{36}', user.get('id', '')):
        raise RuntimeError('admin_fixture_failed')

    # 1) Edge rows → SQL chain
    chain = json.loads(sql(DB, chain_sql(user['id'], rows)).strip().splitlines()[-1])
    report['chain'] = chain
    expected_types = [r['interaction_type'] for r in rows]
    assert chain['reserve_ok'] == 'true' and chain['questions'] == len(rows) and chain['types'] == expected_types, 'chain_result'
    assert chain['job_status'] == 'done' and chain['stored_keys'] == len(rows) and chain['usage_rows'] == 1, 'chain_state'
    assert chain['payload_has_no_key_fields'] and chain['student_projection_has_no_key'] and chain['solution_not_in_payload'], 'chain_privacy'
    bad = json.loads(json.dumps(rows[2]))
    bad['answer_key'] = {'pairs': {'l1': 'r9', 'l2': 'r2'}}  # bypasses the Edge validator on purpose
    code, err = sql_error(bad_chain_sql(user['id'], bad))
    report['chain']['sql_rejects_bypassed_bad_key'] = {'exit': code, 'error': err}
    assert code != 0 and 'question_structure_invalid' in err and 'key_value_invalid' in err, 'sql_same_code'
    left = sql(DB, f"select count(*) from public.question_bank q where q.family_id='{FAM}';").strip()
    report['chain']['rows_after_rejected_job'] = int(left)
    assert int(left) == len(rows), 'rejected_job_left_no_rows'

    # 1b) Faz 2A/2B: types ship enabled=false → SQL refuses the whole job; after enabling (ONLY in this disposable DB)
    # the same Edge rows complete. This mirrors the Edge pre-check (409 interaction_type_unavailable before any charge).
    rows2 = json.loads(command(['deno', 'run', '--no-lock', '--config', 'supabase/functions/deno.json', 'scripts/qt-ai-sample-rows.ts', '--phase2'], cwd=ROOT))
    # Yayın migration'ı (20261107040000) türleri açar; kapalı durum burada açıkça yeniden kurulur.
    sql(DB, "update public.interaction_types set enabled=false where type in (" + ",".join("'" + t + "'" for t in PHASE2) + ");")
    enabled = sql(DB, "select string_agg(type||'='||enabled, ',' order by type) from public.interaction_types where type in (" + ",".join("'" + t + "'" for t in PHASE2) + ");").strip()
    report['chain']['phase2_enabled_before'] = enabled
    code, err = sql_error(phase2_sql(user['id'], rows2, JOB2))
    report['chain']['phase2_refused_while_disabled'] = {'exit': code, 'error': err}
    assert code != 0 and 'interaction_type_unavailable' in err, 'phase2_disabled_refused'
    sql(DB, "update public.interaction_types set enabled=true where type in (" + ",".join("'" + t + "'" for t in PHASE2) + ");")
    p2 = json.loads(sql(DB, phase2_sql(user['id'], rows2, JOB2)).strip().splitlines()[-1])
    report['chain']['phase2_after_enable'] = p2
    assert p2['job_status'] == 'done' and p2['stored_keys'] == 6 and p2['payload_has_no_key_fields'] and p2['stimulus_rows'] == 2, 'phase2_chain'

    # 2) Global seed + UI tour
    report['global_questions'] = int(sql(DB, global_sql(user['id'], rows + rows2)).strip().splitlines()[-1])
    FIXTURE.write_text(json.dumps({'auth': auth_port, 'rest': rest_port, 'anon': anon, 'email': email, 'password': password, 'db': DB, 'total': report['global_questions']}))
    os.chmod(FIXTURE, 0o600)
    env = {**os.environ, 'GINA_QTAI_FIXTURE': str(FIXTURE)}
    out = subprocess.run(['node', 'scripts/test-qt-backoffice-ui.cjs'], cwd=ROOT, env=env, capture_output=True, text=True, timeout=600)
    sys.stderr.write(out.stderr[-3000:])
    try:
        report['checks'] = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception:
        report['checks'] = {'raw': out.stdout[-2000:]}
    if out.returncode:
        raise RuntimeError('ui_tour_failed')
except AssertionError as e:
    report['error'] = 'check_failed:' + str(e)
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
