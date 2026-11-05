"""Run report contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_routines_' + uuid.uuid4().hex[:10] + '_audit'
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
    parent='00000000-0000-4000-8000-000000008501';family='10000000-0000-4000-8000-000000008501';child='20000000-0000-4000-8000-000000008501';task='30000000-0000-4000-8000-000000008501'
    sql(db,f"insert into auth.users(id,email) values('{parent}','task-race@example.invalid');insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');insert into public.family_members(family_id,user_id) values('{family}','{parent}');insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic',5);insert into public.task_templates(id,family_id,child_id,title,stars) values('{task}','{family}','{child}','Original',2);")
    claims=json.dumps({'sub':parent,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select {expression};commit;",allow_error=True)
    def race(expressions):
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(call,expressions))
    def change(request,revision,action):return f"public.change_task_routine('{request}','{task}',{revision},'{action}')"
    request=str(uuid.uuid4());r=race([change(request,1,'pause'),change(request,1,'pause')])
    assert all(not x.startswith('ERROR:') for x in r) and r[0]==r[1],r
    assert sql(db,f"select revision from public.task_templates where id='{task}';select count(*) from gina.task_routine_changes where template_id='{task}';")=='2\n2'
    races=[{'check':'same_request_pause_one_revision_one_change','passed':True}]
    r=race([change(str(uuid.uuid4()),2,'resume'),change(str(uuid.uuid4()),2,'archive')])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('task_routine_changed' in x for x in r),r
    races.append({'check':'concurrent_resume_and_archive_one_winner','passed':True})
    # Reset only this disposable fixture as its owner, then race new work against archive.
    sql(db,f"update public.task_templates set archived_at=null,active=false where id='{task}';update public.task_templates set active=true where id='{task}';")
    rev=sql(db,f"select revision from public.task_templates where id='{task}';")
    r=race([change(str(uuid.uuid4()),int(rev),'archive'),f"public.complete_task('{task}',current_date,'{uuid.uuid4()}','{child}')"])
    assert not r[0].startswith('ERROR:'),r
    assert not r[1].startswith('ERROR:') or 'template_inactive' in r[1],r
    assert sql(db,f"select count(*) from public.task_completions where template_id='{task}' and task_snapshot->>'stars' is distinct from '2';")=='0'
    races.append({'check':'archive_and_submission_serialize_without_partial_work','passed':True})
    sql(db,f"update public.task_templates set archived_at=null,active=false where id='{task}';update public.task_templates set active=true where id='{task}';")
    rev=int(sql(db,f"select revision from public.task_templates where id='{task}';"))
    value="jsonb_build_object('title','Edited','icon','task-custom','stars',8,'days_of_week',jsonb_build_array(1,2,3,4,5,6,7),'time_of_day','any','requires_approval',true)"
    r=race([f"public.change_task_routine('{uuid.uuid4()}','{task}',{rev},'save',{value})",f"public.complete_task('{task}',current_date+1,'{uuid.uuid4()}','{child}')"])
    assert all(not x.startswith('ERROR:') for x in r),r
    assert sql(db,f"select (task_snapshot->>'title'='Original' and task_snapshot->>'stars'='2') or (task_snapshot->>'title'='Edited' and task_snapshot->>'stars'='8') from public.task_completions where template_id='{task}' and due_date=current_date+1;")=='t'
    races.append({'check':'edit_and_submission_freeze_one_consistent_version','passed':True})
    out=root/'docs/release/task-routines-2026-11-05'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
