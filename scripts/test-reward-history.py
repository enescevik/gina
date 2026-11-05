"""Run report contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_rewards_' + uuid.uuid4().hex[:10] + '_audit'
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
    parent='00000000-0000-4000-8000-000000008701';family='10000000-0000-4000-8000-000000008701';child='20000000-0000-4000-8000-000000008701';reward='30000000-0000-4000-8000-000000008701'
    sql(db,f"insert into auth.users(id,email) values('{parent}','reward-race@example.invalid');insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');insert into public.family_members(family_id,user_id) values('{family}','{parent}');insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic',5);insert into public.family_rewards(id,family_id,title,cost_stars) values('{reward}','{family}','Original',20);insert into public.star_events(family_id,child_id,delta,reason) values('{family}','{child}',100,'adjust');")
    claims=json.dumps({'sub':parent,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select {expression};commit;",allow_error=True)
    def race(expressions):
        with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(call,expressions))
    def change(key,rev,action,value="'{}'"):return f"public.change_reward('{key}','{reward}',{rev},'{action}',{value})"
    key=str(uuid.uuid4());r=race([change(key,1,'pause'),change(key,1,'pause')]);assert r[0]==r[1] and not r[0].startswith('ERROR:'),r
    races=[{'check':'same_receipt_one_revision','passed':True}]
    assert sql(db,f"select revision from public.family_rewards where id='{reward}'")=='2'
    assert not call(change(str(uuid.uuid4()),2,'resume')).startswith('ERROR:')
    key=str(uuid.uuid4());request=f"public.request_reward('{reward}','{key}','{child}')"
    r=race([request,request]);assert r[0]==r[1] and not r[0].startswith('ERROR:'),r
    assert sql(db,f"select count(*) from public.reward_requests where idempotency_key='{key}'")=='1'
    races.append({'check':'concurrent_request_one_result','passed':True})
    value="'{\"title\":\"Edited\",\"cost_stars\":40}'"
    r=race([change(str(uuid.uuid4()),3,'save',value),f"public.request_reward('{reward}','{uuid.uuid4()}','{child}')"])
    assert all(not x.startswith('ERROR:') for x in r),r
    assert sql(db,f"select bool_and((reward_snapshot->>'title'='Original' and cost_snapshot=20) or (reward_snapshot->>'title'='Edited' and cost_snapshot=40)) from public.reward_requests where reward_id='{reward}'")=='t'
    races.append({'check':'request_and_edit_one_consistent_snapshot','passed':True})
    r=race([change(str(uuid.uuid4()),4,'archive'),f"public.set_child_goal('{reward}','{child}')"])
    assert sum(not x.startswith('ERROR:') for x in r)==1,r
    assert sql(db,f"select count(*) from public.child_goals g join public.family_rewards r on r.id=g.reward_id where r.id='{reward}' and r.archived_at is not null and g.status='active'")=='0'
    races.append({'check':'goal_and_archive_do_not_leave_orphan_goal','passed':True})
    out=root/'docs/release/reward-history-2026-11-05'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
