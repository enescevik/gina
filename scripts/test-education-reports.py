"""Run report contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_reports_' + uuid.uuid4().hex[:10] + '_audit'
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
    for file in sorted((root/'supabase/tests').glob('*.sql')):
        output = sql(db,file.read_text())
        failures = [line for line in output.splitlines() if line.startswith('not ok') or line.startswith('# Looks like')]
        assert not failures, str(file.name) + '\n' + '\n'.join(failures)
        count = len(re.findall(r'^ok \d+',output,re.M))
        assert count > 0, file.name + ': no test assertions'
        results.append({'file':file.name,'passed':count})
    parent='00000000-0000-4000-8000-000000008401';family='10000000-0000-4000-8000-000000008401';child='20000000-0000-4000-8000-000000008401';grade='30000000-0000-4000-8000-000000008401'
    sql(db,f"insert into auth.users(id,email) values('{parent}','score-race@example.invalid');insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');insert into public.family_members(family_id,user_id) values('{family}','{parent}');insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic',5);")
    claims=json.dumps({'sub':parent,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select {expression};commit;",allow_error=True)
    def race(expressions):
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(call,expressions))
    def save(request,revision,score=80):
        return f"public.change_school_grade('{request}','{grade}','{child}',{revision},'save',jsonb_build_object('subject','Matematik','kind','exam','score',{score},'max_score',100,'graded_on',current_date))"
    request=str(uuid.uuid4());r=race([save(request,0),save(request,0)])
    assert all(not x.startswith('ERROR:') for x in r) and r[0]==r[1],r
    assert sql(db,f"select count(*) from public.grades where id='{grade}';select count(*) from gina.school_grade_changes where grade_id='{grade}';")=='1\n1'
    races=[{'check':'same_request_create_one_score_one_history_entry','passed':True}]
    r=race([save(str(uuid.uuid4()),1,90),save(str(uuid.uuid4()),1,70)])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('school_grade_changed' in x for x in r),r
    races.append({'check':'two_parent_corrections_require_latest_revision','passed':True})
    r=race([save(str(uuid.uuid4()),2,85),f"public.change_school_grade('{uuid.uuid4()}','{grade}','{child}',2,'withdraw')"])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('school_grade_changed' in x for x in r),r
    assert sql(db,f"select revision from public.grades where id='{grade}';select count(*) from gina.school_grade_changes where grade_id='{grade}';")=='3\n3'
    races.append({'check':'withdraw_vs_correction_has_one_winner_with_history','passed':True})
    out=root/'docs/release/education-reports-2026-11-05' 
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
