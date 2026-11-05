"""Run period-transfer contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_transfer_' + uuid.uuid4().hex[:10] + '_audit'
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
    parent='00000000-0000-4000-8000-000000008801';second='00000000-0000-4000-8000-000000008802';family='10000000-0000-4000-8000-000000008801';child='20000000-0000-4000-8000-000000008801'
    r1='30000000-0000-4000-8000-000000008801';r2='30000000-0000-4000-8000-000000008802';plan='60000000-0000-4000-8000-000000008801'
    sql(db,f"""insert into auth.users(id,email) values('{parent}','transfer-race@example.invalid'),('{second}','transfer-race-2@example.invalid');
insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');
insert into public.family_members(family_id,user_id) values('{family}','{parent}'),('{family}','{second}');
insert into public.children(id,family_id,name,grade) values('{child}','{family}','Synthetic',4);
insert into public.task_templates(id,family_id,child_id,title,stars,starts_on) values('{r1}','{family}','{child}','Kitap oku',2,current_date-40),('{r2}','{family}','{child}','Çanta',1,current_date-40);
insert into gina.learning_plan(id,child_id,revision,content) values('{plan}','{child}',1,jsonb_build_object('kind','homework','title','Ödev','subject','Matematik','topic','','planned_on',to_char(current_date-3,'YYYY-MM-DD'),'due_on',null,'time',null,'steps','[]'::jsonb,'done',false,'archived',false));""")
    def claims(user):return json.dumps({'sub':user,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression,user=parent):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims(user)}';select {expression};commit;",allow_error=True)
    def race(calls):
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(lambda c: call(*c),calls))
    year=int(sql(db,"select extract(year from current_date)::int"))
    call(f"public.change_child_education('{uuid.uuid4()}','{child}',0,'initial',{year-1},4,'Okul',make_date({year-1},9,1),0,true)")
    assert not call(f"public.change_child_education('{uuid.uuid4()}','{child}',1,'new_year',{year},5,'Okul',current_date,0,true)").startswith('ERROR:')
    frm,to=sql(db,f"select id from gina.child_education_periods where child_id='{child}' and ends_on is not null;select id from gina.child_education_periods where child_id='{child}' and ends_on is null;").split('\n')
    def items(a1,a2,ap):return (f"jsonb_build_object('routines',jsonb_build_array(jsonb_build_object('id','{r1}','revision',1,'action','{a1}'),jsonb_build_object('id','{r2}','revision',1,'action','{a2}')),"
        f"'plans',jsonb_build_array(jsonb_build_object('id','{plan}','revision',1,'action','{ap}')))")
    def transfer(request,revision,decisions,user=parent):return (f"public.transfer_education_period_items('{request}','{child}','{frm}','{to}',{revision},{items(*decisions)})",user)
    # Same request twice at once: one copy, one result.
    request=str(uuid.uuid4());r=race([transfer(request,2,('copy','pause','copy')),transfer(request,2,('copy','pause','copy'))])
    assert all(not x.startswith('ERROR:') for x in r) and r[0]==r[1],r
    assert sql(db,f"select count(*) from public.task_templates where source_routine_id='{r1}';select count(*) from gina.learning_plan where source_item_id='{plan}';select revision from gina.child_education_state where child_id='{child}';")=='1\n1\n3'
    races=[{'check':'same_request_twice_one_copy_one_result','passed':True}]
    # Reset only this disposable fixture, then race two parents with different decisions on the same revision.
    sql(db,f"delete from public.task_templates where source_routine_id is not null;delete from gina.learning_plan where source_item_id is not null;update public.task_templates set active=true where id in('{r1}','{r2}');update gina.learning_plan set content=content||'{{\"archived\":false}}' where id='{plan}';")
    rev=int(sql(db,f"select revision from gina.child_education_state where child_id='{child}'"))
    rr1,rr2,rp=sql(db,f"select revision from public.task_templates where id='{r1}';select revision from public.task_templates where id='{r2}';select revision from gina.learning_plan where id='{plan}';").split('\n')
    def items2(a1,a2,ap):return (f"jsonb_build_object('routines',jsonb_build_array(jsonb_build_object('id','{r1}','revision',{rr1},'action','{a1}'),jsonb_build_object('id','{r2}','revision',{rr2},'action','{a2}')),"
        f"'plans',jsonb_build_array(jsonb_build_object('id','{plan}','revision',{rp},'action','{ap}')))")
    def transfer2(request,revision,decisions,user):return (f"public.transfer_education_period_items('{request}','{child}','{frm}','{to}',{revision},{items2(*decisions)})",user)
    r=race([transfer2(str(uuid.uuid4()),rev,('copy','keep','copy'),parent),transfer2(str(uuid.uuid4()),rev,('pause','copy','archive'),second)])
    assert sum(not x.startswith('ERROR:') for x in r)==1 and any('education_changed' in x for x in r),r
    assert sql(db,f"select count(*) from public.task_templates where source_routine_id is not null;select count(*) from gina.child_education_changes where child_id='{child}' and action='transfer_items';")=='1\n2'
    races.append({'check':'two_parents_same_revision_one_winner_other_sees_education_changed','passed':True})
    # Transfer racing a routine edit: one of them sees a version conflict; no half copy.
    sql(db,f"delete from public.task_templates where source_routine_id is not null;delete from gina.learning_plan where source_item_id is not null;update public.task_templates set active=true where id in('{r1}','{r2}');update gina.learning_plan set content=content||'{{\"archived\":false}}' where id='{plan}';")
    rev=int(sql(db,f"select revision from gina.child_education_state where child_id='{child}'"))
    rr1,rr2,rp=sql(db,f"select revision from public.task_templates where id='{r1}';select revision from public.task_templates where id='{r2}';select revision from gina.learning_plan where id='{plan}';").split('\n')
    value="jsonb_build_object('title','Edited','icon','task-custom','stars',8,'days_of_week',jsonb_build_array(1,2,3,4,5,6,7),'time_of_day','any','requires_approval',true)"
    r=race([transfer2(str(uuid.uuid4()),rev,('copy','pause','copy'),parent),(f"public.change_task_routine('{uuid.uuid4()}','{r1}',{rr1},'save',{value})",second)])
    assert sum(not x.startswith('ERROR:') for x in r)>=1 and (all(not x.startswith('ERROR:') for x in r) or any('task_routine_changed' in x for x in r)),r
    copies=sql(db,f"select count(*) from public.task_templates where source_routine_id='{r1}';select coalesce((select title from public.task_templates where source_routine_id='{r1}'),'-');select title from public.task_templates where id='{r1}'").split('\n')
    assert copies[0] in('0','1') and (copies[0]=='0' or copies[1]==copies[2]),copies
    races.append({'check':'transfer_and_routine_edit_serialize_without_half_copy','passed':True})
    out=root/'docs/release/period-transfer-2026-11-06'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
