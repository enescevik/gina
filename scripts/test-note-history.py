"""Run report contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_notes_' + uuid.uuid4().hex[:10] + '_audit'
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
    parent='00000000-0000-4000-8000-000000008801';family='10000000-0000-4000-8000-000000008801'
    sql(db,f"insert into auth.users(id,email) values('{parent}','note-race@example.invalid');insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');insert into public.family_members(family_id,user_id) values('{family}','{parent}');")
    claims=json.dumps({'sub':parent,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select {expression};commit;",allow_error=True)
    def race(expressions):
        with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(call,expressions))
    value="jsonb_build_object('title','Observation','body','Private content','subject','','visibility','private')"
    key=str(uuid.uuid4());expression=f"public.save_parent_note('{key}',null,null,'save',null,{value})"
    r=race([expression,expression]);assert r[0]==r[1] and not r[0].startswith('ERROR:'),r
    note=json.loads(r[0])['id'];assert sql(db,'select count(*) from public.notes')=='1'
    races=[{'check':'concurrent_create_one_receipt_one_note','passed':True}]
    def change(rev,action,value="'{}'"):
        return f"public.save_parent_note('{uuid.uuid4()}','{note}',{rev},'{action}',null,{value})"
    r=race([change(1,'save',value.replace('Private content','First edit')),change(1,'save',value.replace('Private content','Second edit'))])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('note_changed' in x for x in r),r
    assert sql(db,f"select revision from public.notes where id='{note}'")=='2'
    races.append({'check':'competing_edits_never_overwrite','passed':True})
    r=race([change(2,'archive'),change(2,'save',value.replace('Private content','Last edit'))])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('note_changed' in x for x in r),r
    assert sql(db,f"select count(*) from gina.note_changes where note_id='{note}'")=='3'
    races.append({'check':'archive_and_edit_are_serialized','passed':True})
    sql(db,f"insert into public.notes(family_id,author_user_id,body,visibility) select '{family}','{parent}','Quota fixture','private' from generate_series(1,18);")
    a=f"public.save_parent_note('{uuid.uuid4()}',null,null,'save',null,{value})"
    b=f"public.save_parent_note('{uuid.uuid4()}',null,null,'save',null,{value})"
    r=race([a,b]);assert sum(not x.startswith('ERROR:') for x in r)==1 and any('plan_limit_notes' in x for x in r),r
    assert sql(db,'select count(*) from public.notes')=='20'
    races.append({'check':'last_plan_slot_consumed_once_including_archive','passed':True})
    out=root/'docs/release/note-history-2026-11-05'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
