#!/usr/bin/env python3
"""Real concurrent credit races against disposable clones of an explicit audit DB.

Scenarios (two real connections, barrier-synchronised):
  acquire_same_request      – one receipt replayed twice at once: one acquisition, 3 charges
  acquire_other_request     – two different requests for one owned unit: still 3 charges
  acquire_two_units_quota   – two different units racing for a 3-question allowance: exactly one wins
  accept_twice              – two admins accept the same contribution copy at once: one approval, one grant set
  accept_and_publish        – acceptance races the publication of its draft package: publication needs reviews
  publish_same_version      – two publishers with the same expected version: one publication row, one version
The template must be an isolated *_audit database with migration 20261106110000 applied.
Only the clones are dropped; the template is never reset.
"""
import argparse, json, re, subprocess, threading, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
parser = argparse.ArgumentParser(); parser.add_argument('--template', required=True); args = parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit', args.template): parser.error('Explicit audit database required')
root = Path(__file__).resolve().parents[1]
def sql(db, body, check=True):
    r = subprocess.run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-U', 'postgres', '-d', db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=body, text=True, capture_output=True, timeout=60)
    if check and r.returncode: raise RuntimeError(r.stderr[-1500:])
    return r
# Fixtures come from the pgTAP file up to the first assertion; plan() is removed so the prefix commits.
test = (root / 'supabase/tests/098_library_credit_safety.test.sql').read_text()
prefix = test.split("-- 1. Lifecycle view")[0].replace('select no_plan();', '')
ADMIN = '00000000-0000-4000-8000-000000009801'; P1 = '00000000-0000-4000-8000-000000009802'; P2 = '00000000-0000-4000-8000-000000009803'
F1 = '10000000-0000-4000-8000-000000009801'; F2 = '10000000-0000-4000-8000-000000009802'
def claims(sub, family=None, admin=False):
    g = {'admin': True} if admin else {'role': 'parent', 'family_id': family}
    return json.dumps({'sub': sub, 'role': 'authenticated', 'gina': g}, separators=(',', ':'))
setup = prefix + f"""
set local role authenticated;select pg_temp.as_admin();
insert into state select 'pkg',(public.admin_import_library_bundle(gen_random_uuid(),pg_temp.bundle())->>'id')::uuid;
select public.admin_review_library_question(gen_random_uuid(),pg_temp.id('pkg'),k,1,0,'suitable','race fixture') from unnest(array['question-1','question-2','question-3','question-4']) k;
reset role;select pg_temp.as_service();
select public.prepare_library_delivery_media('{ADMIN}',pg_temp.id('pkg'),jsonb_build_array(jsonb_build_object('source_hash',pg_temp.bundle()#>>'{{assets,0,sha256}}','base64',pg_temp.bundle()#>>'{{assets,0,base64}}')));
set local role authenticated;select pg_temp.as_admin();
select public.admin_set_library_publication(gen_random_uuid(),pg_temp.id('pkg'),0,public.admin_library_publication(pg_temp.id('pkg'))#>>'{{checks,review_fingerprint}}','Race package','Test',array['free']::public.plan_code[],'Test curriculum',true,'published');
reset role;
insert into public.question_bank(id,family_id,grade,subject,topic,kind,difficulty,stem,expected_answer,solution) values('40000000-0000-4000-8000-000000009801','{F2}',5,'Matematik','Çevre','open_ended','orta','Dikdörtgenin çevresi kaç metredir?','28','Kenarlar toplanır.');
create table public.race_state as select id from state where name='pkg';
set local role authenticated;select pg_temp.as_parent2();
select public.begin_question_contribution('61000000-0000-4000-8000-000000009802','40000000-0000-4000-8000-000000009801',true,true);
reset role;
commit;
"""
teacher = """jsonb_build_object('q1',jsonb_build_object('correct_key',null,'expected_answer','28','solution','Çözüm: 28','explanation','Açıklama.','common_misconception','Yanılgı.','next_step','Sonraki adım.','rubric',jsonb_build_object('max_points',2,'scoring','Ölçüt başına bir puan.','criteria',jsonb_build_array(jsonb_build_object('id','c1','points',1,'criterion','Sonuç doğru.'),jsonb_build_object('id','c2','points',1,'criterion','Gerekçe var.')),'missing_answer','not_answered','review_required',true)))"""
results = []
scenarios = ['acquire_same_request', 'acquire_other_request', 'acquire_two_units_quota', 'accept_twice', 'accept_and_publish', 'publish_same_version']
for scenario in scenarios:
    db = 'gina_credit_' + uuid.uuid4().hex[:12] + '_audit'
    sql('postgres', f'create database {db} template {args.template};')
    try:
        sql(db, setup)
        pkg = sql(db, 'select id from public.race_state;').stdout.strip()
        req = str(uuid.uuid4()); pub_req = str(uuid.uuid4())
        fingerprint = sql(db, f"begin;set local role authenticated;set local request.jwt.claims='{claims(ADMIN, admin=True)}';select public.admin_library_publication('{pkg}')#>>'{{checks,review_fingerprint}}';commit;").stdout.strip()
        contribution_pkg = None
        acquire = lambda r, unit: (f"select public.acquire_library_units('{r}','{pkg}',1,array['{unit}']);", claims(P1, F1))
        accept = lambda r: (f"select public.admin_decide_contribution_set('{r}','61000000-0000-4000-8000-000000009802',true,'Race acceptance',{teacher},true);", claims(ADMIN, admin=True))
        publish = lambda r, target, expected: (f"select public.admin_set_library_publication('{r}','{target}',{expected},(public.admin_library_publication('{target}')#>>'{{checks,review_fingerprint}}'),'Race package','Test',array['free']::public.plan_code[],'Test curriculum',true,'published');", claims(ADMIN, admin=True))
        if scenario == 'acquire_same_request': calls = [acquire(req, 'source:segments'), acquire(req, 'source:segments')]
        elif scenario == 'acquire_other_request': calls = [acquire(req, 'source:segments'), acquire(str(uuid.uuid4()), 'source:segments')]
        elif scenario == 'acquire_two_units_quota': calls = [acquire(req, 'source:segments'), acquire(str(uuid.uuid4()), 'question:question-4')]
        elif scenario == 'accept_twice': calls = [accept(req), accept(str(uuid.uuid4()))]
        elif scenario == 'accept_and_publish':
            # Publication of the contribution's package can only be attempted once the package exists; race the
            # acceptance against a publisher that reads the fresh package id in its own transaction.
            calls = [accept(req), (f"select public.admin_set_library_publication('{pub_req}',(public.admin_get_contribution_set('61000000-0000-4000-8000-000000009802')->>'package_id')::uuid,0,'x','Contribution','Test',array['free']::public.plan_code[],'Test curriculum',true,'published');", claims(ADMIN, admin=True))]
        else: calls = [publish(req, pkg, 1), publish(str(uuid.uuid4()), pkg, 1)]
        barrier = threading.Barrier(2)
        def send(i):
            stmt, jwt = calls[i]; barrier.wait(timeout=10)
            return sql(db, f"begin;set local lock_timeout='15s';set local role authenticated;set local request.jwt.claims='{jwt}';{stmt}select pg_sleep(0.1);commit;", False)
        with ThreadPoolExecutor(max_workers=2) as pool: pair = list(pool.map(send, [0, 1]))
        successes = sum(r.returncode == 0 for r in pair); errors = sorted(re.findall(r'ERROR:\s+([a-z_]+)', ' '.join(r.stderr for r in pair)))
        used = int(sql(db, f"select gina.library_month_used('{F1}');").stdout.strip())
        acquisitions = int(sql(db, 'select count(*) from gina.library_acquisitions;').stdout.strip())
        charges = int(sql(db, 'select count(*) from gina.library_acquisition_charges;').stdout.strip())
        grants = int(sql(db, f"select count(*) from public.learning_credit_grants where family_id='{F2}';").stdout.strip())
        credits = int(sql(db, f"select count(*) from gina.contribution_question_credits where family_id='{F2}';").stdout.strip())
        publications = sql(db, "select count(*)||':'||coalesce(max(version),0) from gina.library_publications;").stdout.strip()
        integrity = sql(db, f"begin;set local role authenticated;set local request.jwt.claims='{claims(ADMIN, admin=True)}';select public.admin_library_group_integrity();commit;").stdout.strip()
        detail = [(r.returncode, r.stderr.strip()[-200:]) for r in pair]
        if scenario == 'acquire_same_request': assert successes == 2 and used == 3 and acquisitions == 1 and charges == 3, detail
        elif scenario == 'acquire_other_request': assert successes == 2 and used == 3 and acquisitions == 1 and charges == 3, detail
        elif scenario == 'acquire_two_units_quota': assert successes == 1 and used in (1, 3) and acquisitions == 1 and 'library_quota_exceeded' in errors, detail
        elif scenario == 'accept_twice': assert successes == 1 and grants == 1 and credits == 1 and 'contribution_changed' in errors, detail
        elif scenario == 'accept_and_publish':
            assert grants == 1 and credits == 1, detail
            assert pair[0].returncode == 0 and pair[1].returncode != 0 and any(e in errors for e in ['library_publication_input', 'library_review_not_found', 'library_publication_review_required', 'library_publication_review_changed']), detail
            assert publications == '1:1', publications
        else: assert successes == 1 and publications == '1:2' and 'library_publication_changed' in errors, detail
        assert integrity == '[]', integrity
        results.append({'scenario': scenario, 'successfulRequests': successes, 'errors': errors, 'questionCreditsUsed': used, 'acquisitions': acquisitions, 'charges': charges, 'contributionGrants': grants, 'creditedQuestions': credits, 'publications': publications, 'groupIntegrityIssues': 0, 'passed': True})
    finally: sql('postgres', f'drop database {db};')
print(json.dumps(results, indent=1, ensure_ascii=False))
