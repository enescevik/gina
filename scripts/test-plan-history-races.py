"""Run dated-plan-history contracts (L04) in a disposable empty DB; never reset app/demo data.

  python3 scripts/test-plan-history-races.py --run-local            # all pgTAP files + races
  python3 scripts/test-plan-history-races.py --run-local --only 096 # one pgTAP file + races
"""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
args = sys.argv[1:]
if '--run-local' not in args:
    raise SystemExit('Explicit --run-local required')
only = args[args.index('--only') + 1] if '--only' in args else None
root = Path(__file__).resolve().parents[1]
db = 'gina_planhist_' + uuid.uuid4().hex[:10] + '_audit'
created = False

def sql(database, body, owner=False, allow_error=False):
    role = 'supabase_admin' if owner or database != db else 'postgres'
    result = subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-X','-qAt','-U',role,'-d',database,'-v','ON_ERROR_STOP=1'], input=body,text=True,capture_output=True,timeout=300)
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
        if only and not file.name.startswith(only): continue
        output = sql(db,file.read_text())
        failures = [line for line in output.splitlines() if line.startswith('not ok') or line.startswith('# Looks like')]
        assert not failures, str(file.name) + '\n' + '\n'.join(failures)
        count = len(re.findall(r'^ok \d+',output,re.M))
        assert count > 0, file.name + ': no test assertions'
        results.append({'file':file.name,'passed':count})
    parent='00000000-0000-4000-8000-000000009901';second='00000000-0000-4000-8000-000000009902';family='10000000-0000-4000-8000-000000009901';child='20000000-0000-4000-8000-000000009901'
    r1='30000000-0000-4000-8000-000000009901'
    sql(db,f"""insert into auth.users(id,email) values('{parent}','plan-history-race@example.invalid'),('{second}','plan-history-race-2@example.invalid');
insert into public.families(id,name,timezone,created_by) values('{family}','Synthetic race','Europe/Istanbul','{parent}');
insert into public.family_members(family_id,user_id) values('{family}','{parent}'),('{family}','{second}');
insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic',4);
insert into public.task_templates(id,family_id,child_id,title,stars,starts_on) values('{r1}','{family}','{child}','Kitap oku',2,current_date-40);""")
    today = sql(db,f"select gina.family_today('{family}')")
    def claims(user):return json.dumps({'sub':user,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression,user=parent):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims(user)}';select {expression};commit;",allow_error=True)
    def race(calls):
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(lambda c: call(*c),calls))
    def value(stars):return f"jsonb_build_object('title','Kitap oku','icon','read-book','stars',{stars},'days_of_week',jsonb_build_array(1,2,3,4,5,6,7),'time_of_day','any','requires_approval',true)"
    def edit(request,revision,stars,offset,user=parent):return (f"public.change_task_routine('{request}','{r1}',{revision},'save',{value(stars)},date '{today}'+{offset})",user)
    races=[]
    # Two parents, same revision, different effective days at once: one version, the other sees the conflict.
    r=race([edit(str(uuid.uuid4()),1,5,0,parent),edit(str(uuid.uuid4()),1,9,7,second)])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('task_routine_changed' in x for x in r),r
    rev,count=sql(db,f"select revision from public.task_templates where id='{r1}';select count(*) from gina.task_routine_changes where template_id='{r1}' and revision>1").split('\n')
    assert rev=='2' and count=='1',(rev,count)
    races.append({'check':'two_parents_same_revision_different_effective_days_one_version','passed':True})
    # Same request twice at once with a scheduled day: one version, identical result, no second schedule.
    request=str(uuid.uuid4());r=race([edit(request,2,7,3),edit(request,2,7,3)])
    assert all(not x.startswith('ERROR:') for x in r) and r[0]==r[1],r
    assert sql(db,f"select count(*) from gina.task_routine_changes where template_id='{r1}' and effective_from=date '{today}'+3")=='1'
    races.append({'check':'same_scheduled_request_twice_one_version_same_result','passed':True})
    # Scheduled edit racing a submission for today: the submission freezes today's version, never the scheduled one.
    pending_stars=sql(db,f"select stars from public.task_templates where id='{r1}'")  # row shows the scheduled 7 (known boundary)
    r=race([(f"public.complete_task('{r1}',date '{today}','{uuid.uuid4()}','{child}')",parent),edit(str(uuid.uuid4()),3,1,10,second)])
    assert all(not x.startswith('ERROR:') for x in r),r
    snap=sql(db,f"select task_snapshot->>'stars' from public.task_completions where template_id='{r1}' and due_date=gina.family_today('{family}')")
    today_version=sql(db,f"select (gina.task_routine_version_on('{r1}',gina.family_today('{family}'))->'value'->>'stars')")
    assert snap==today_version,(snap,today_version)
    races.append({'check':'submission_racing_scheduled_edit_freezes_todays_version','passed':True,'snapshot_stars':snap,'live_row_stars_at_submission':pending_stars})
    # Immediate edit after a schedule supersedes it, even under a concurrent read.
    rev=sql(db,f"select revision from public.task_templates where id='{r1}'")
    r=race([edit(str(uuid.uuid4()),int(rev),4,0,parent),(f"public.plan_for_day('{child}',date '{today}'+30)",second)])
    assert all(not x.startswith('ERROR:') for x in r),r
    later=sql(db,f"select (gina.task_routine_version_on('{r1}',gina.family_today('{family}')+30)->'value'->>'stars'),(select count(*) from gina.task_routine_changes where template_id='{r1}' and superseded_by is not null)")
    assert later in('4|2','4|3'),later  # 3 when the scheduled parent won race 1
    races.append({'check':'immediate_edit_supersedes_pending_schedules','passed':True})
    # Timetable: two saves, same revision, different effective days; one wins, one timetable_conflict.
    lessons="jsonb_build_array(jsonb_build_object('id','l1','day',1,'title','Matematik','start','09:00','end','09:40'))"
    settings="'{\"start\":\"09:00\",\"duration\":40,\"break\":10}'::jsonb"
    r=race([(f"public.save_school_timetable_request('{uuid.uuid4()}','{child}',0,{lessons},{settings},date '{today}')",parent),(f"public.save_school_timetable_request('{uuid.uuid4()}','{child}',0,{lessons},{settings},date '{today}'+5)",second)])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('timetable_conflict' in x for x in r),r
    assert sql(db,f"select count(*) from gina.school_timetable_versions where child_id='{child}'")=='1'
    races.append({'check':'two_timetable_saves_same_revision_different_days_one_version','passed':True})
    # Evidence after everything: the old submission keeps its stars; no star event was touched.
    assert sql(db,f"select count(*) from public.star_events where child_id='{child}'")=='0'
    races.append({'check':'no_star_event_created_or_changed_by_edits','passed':True})
    out=root/'docs/release/plan-history-2026-11-06'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','only':only,'results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
