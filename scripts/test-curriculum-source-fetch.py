#!/usr/bin/env python3
"""Source acquisition contracts (pgTAP 056/057/087 + concurrency) in a disposable empty DB; never touches app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_sourcefetch_' + uuid.uuid4().hex[:10] + '_audit'
created = False

def sql(database, body, owner=False, allow_error=False):
    role = 'supabase_admin' if owner or database != db else 'postgres'
    result = subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-X','-qAt','-U',role,'-d',database,'-v','ON_ERROR_STOP=1'], input=body,text=True,capture_output=True,timeout=180)
    if result.returncode:
        if allow_error: return 'ERROR:'+result.stderr.strip()
        raise RuntimeError(result.stderr[-1800:])
    return result.stdout.strip()

try:
    assert sql('gina_completion_audit','begin read only; select count(*) from public.families; select count(*) from auth.users; commit;') == '0\n0'
    sql('postgres', f'create database {db} owner postgres template gina_completion_audit;')
    created = True
    sql(db, 'grant references on auth.users to postgres;create publication supabase_realtime;', owner=True)
    for migration in sorted((root/'supabase/migrations').glob('*.sql')):
        if migration.name < '20261103093000':
            for line in migration.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '): sql(db,line)
        else: sql(db,migration.read_text())
    results = []
    for name in ['056_curriculum_source_review.test.sql','057_catalogue_family_selection.test.sql','087_curriculum_source_fetch.test.sql']:
        file = root/'supabase/tests'/name
        output = sql(db,file.read_text())
        failures = [line for line in output.splitlines() if line.startswith('not ok') or line.startswith('# Looks like')]
        assert not failures, name + '\n' + '\n'.join(failures) + '\n' + output[-3000:]
        count = len(re.findall(r'^ok \d+',output,re.M))
        assert count > 0, name + ': no test assertions'
        results.append({'file':name,'passed':count})
    # Concurrency: two fetch results for the same bytes arrive at once → exactly one revision, one queued extraction.
    admin='00000000-0000-4000-8000-000000008802'
    sql(db,f"insert into auth.users(id,email) values('{admin}','fetch-race@example.invalid');insert into public.admins(user_id) values('{admin}');")
    source=json.dumps({'source_key':'oyss:2026-2027:1:ilkmat2','exam_family':'oyss','school_year':'2026-2027','term':1,'label':'İlköğretim Matematik','index_url':'https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724','link_url':'https://meb.ai/ankmeb3','index_published_on':'2026-09-07','index_updated_on':'2026-09-10','error':None},ensure_ascii=False)
    def rev(sha): return json.dumps({'sha256':sha,'bytes':23454,'mime':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','resolved_url':'https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/ilkmat2.xlsx','redirect_chain':[],'inspection':{},'storage_path':None})
    def call(expression):
        return sql(db,"begin;set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';select "+expression+";commit;",allow_error=True)
    def record(sha): return f"public.record_curriculum_source_fetch('{uuid.uuid4()}','{admin}','{source}'::jsonb,'{rev(sha)}'::jsonb)->>'outcome'"
    sha='d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf'
    with ThreadPoolExecutor(max_workers=2) as pool: pair=list(pool.map(call,[record(sha),record(sha)]))
    assert sorted(pair)==['new_revision','unchanged'], pair
    assert sql(db,"select count(*) from gina.curriculum_source_revisions where sha256='"+sha+"'")=='1'
    assert sql(db,"select count(*) from public.audit_log where action='curriculum.source_revision'")=='1'
    races=[{'check':'concurrent_same_hash_single_revision','results':pair,'passed':True}]
    with ThreadPoolExecutor(max_workers=2) as pool: pair=list(pool.map(call,[record('e'*64),record('f'*64)]))
    assert pair==['new_revision','new_revision'], pair
    assert sql(db,"select count(*) from gina.curriculum_source_revisions")=='3'
    assert sql(db,"select freshness from gina.curriculum_sources where source_key='oyss:2026-2027:1:ilkmat2'")=='pending_review'
    races.append({'check':'concurrent_distinct_hashes_both_recorded_none_approved','passed':True})
    print(json.dumps({'database':db,'pgtap':results,'races':races},ensure_ascii=False,indent=2))
finally:
    if created: sql('postgres', f'drop database {db};')
