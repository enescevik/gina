"""Run bulk archive contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_bulk_' + uuid.uuid4().hex[:10] + '_audit'
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
    parent='00000000-0000-4000-8000-000000008951';partner='00000000-0000-4000-8000-000000008952';family='10000000-0000-4000-8000-000000008951';child='20000000-0000-4000-8000-000000008951'
    reward='30000000-0000-4000-8000-000000008951';task='31000000-0000-4000-8000-000000008951';note='32000000-0000-4000-8000-000000008951'
    sql(db,f"""insert into auth.users(id,email) values('{parent}','bulk-race@example.invalid'),('{partner}','bulk-race-partner@example.invalid');
    insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');
    insert into public.family_members(family_id,user_id) values('{family}','{parent}'),('{family}','{partner}');
    insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic',5);
    insert into public.family_rewards(id,family_id,title,icon,cost_stars) values('{reward}','{family}','Race reward','reward-book',5);
    insert into public.task_templates(id,family_id,child_id,title,stars) values('{task}','{family}','{child}','Race routine',2);
    insert into public.notes(id,family_id,child_id,author_user_id,title,body,visibility) values('{note}','{family}','{child}','{parent}','Race note','Shared text','family');
    insert into public.star_events(family_id,child_id,delta,reason) values('{family}','{child}',50,'adjust');""")
    def claims(user): return json.dumps({'sub':user,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression,user=parent):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims(user)}';select {expression};commit;",allow_error=True)
    def race(expressions):
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(lambda e: call(*e) if isinstance(e,tuple) else call(e),expressions))
    def items(*specs): return json.dumps([{'type':t,'id':i,'revision':r} for t,i,r in specs]).replace("'","''")
    def apply(key,*specs): return f"public.bulk_archive_apply('{items(*specs)}','{key}')"
    def restore(key,*specs): return f"public.bulk_restore_apply('{items(*specs)}','{key}')"
    races=[]
    # 1. Same key twice at once: one archive, identical responses, one history row.
    key=str(uuid.uuid4());batch=[('reward',reward,1),('task_routine',task,1),('note',note,1)]
    r=race([apply(key,*batch),apply(key,*batch)])
    assert all(not x.startswith('ERROR:') for x in r) and r[0]==r[1],r
    assert json.loads(r[0])['summary']=={'ok':3,'skipped':0,'reasons':{}},r[0]
    assert sql(db,f"select count(*) from gina.reward_changes where reward_id='{reward}' and action='archive';select count(*) from gina.bulk_archive_runs;select count(*) from gina.bulk_archive_items;")=='1\n1\n3'
    races.append({'check':'same_key_concurrent_apply_single_run_identical_result','passed':True})
    # 2. Two parents restore the same records with different keys: one wins, the other sees not_archived.
    r=race([(restore(str(uuid.uuid4()),('reward',reward,2),('task_routine',task,2)),parent),(restore(str(uuid.uuid4()),('reward',reward,2),('task_routine',task,2)),partner)])
    assert all(not x.startswith('ERROR:') for x in r),r
    outcomes=sorted(json.loads(x)['summary']['ok'] for x in r)
    assert outcomes==[0,2],r
    assert sql(db,f"select archived_at is null and not active from public.family_rewards where id='{reward}';select archived_at is null and not active from public.task_templates where id='{task}';select count(*) from gina.reward_changes where reward_id='{reward}';")=='t\nt\n3'
    races.append({'check':'competing_restores_one_winner_other_not_archived_or_changed','passed':True})
    # 3. Archive races a child's reward request: never both an archived reward and a live request.
    sql(db,f"update public.family_rewards set active=true where id='{reward}';")
    rev=sql(db,f"select revision from public.family_rewards where id='{reward}';")
    r=race([apply(str(uuid.uuid4()),('reward',reward,int(rev))),f"public.request_reward('{reward}','{uuid.uuid4()}','{child}')"])
    assert not r[0].startswith('ERROR:'),r
    archived=sql(db,f"select archived_at is not null from public.family_rewards where id='{reward}';")=='t'
    pending=int(sql(db,f"select count(*) from public.reward_requests where reward_id='{reward}' and status='requested';"))
    assert (archived and pending==0 and 'reward_not_found' in r[1]) or (not archived and pending==1 and not r[1].startswith('ERROR:') and json.loads(r[0])['items'][0]['reason'] in('reward_pending_request','changed')),(r,archived,pending)
    races.append({'check':'archive_vs_child_request_never_both','passed':True,'order':'archive_first' if archived else 'request_first'})
    # 4. Bulk archive races a single-record edit on the same revision: exactly one commits.
    rev=int(sql(db,f"select revision from public.task_templates where id='{task}';"))
    sql(db,f"update public.task_templates set active=true where id='{task}';");rev=int(sql(db,f"select revision from public.task_templates where id='{task}';"))
    value="jsonb_build_object('title','Edited','icon','task-custom','stars',4,'days_of_week',jsonb_build_array(1,2,3,4,5),'time_of_day','any','requires_approval',true)"
    r=race([apply(str(uuid.uuid4()),('task_routine',task,rev)),f"public.change_task_routine('{uuid.uuid4()}','{task}',{rev},'save',{value})"])
    assert not r[0].startswith('ERROR:'),r
    bulk_ok=json.loads(r[0])['summary']['ok']==1
    assert (bulk_ok and 'task_routine_changed' in r[1]) or (not bulk_ok and not r[1].startswith('ERROR:') and json.loads(r[0])['items'][0]['reason']=='changed'),r
    assert sql(db,f"select revision from public.task_templates where id='{task}';")==str(rev+1)
    races.append({'check':'bulk_archive_vs_single_edit_same_revision_one_commit','passed':True,'order':'bulk_first' if bulk_ok else 'edit_first'})
    out=root/'docs/release/bulk-archive-2026-11-06'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
