"""Run B01 admin workqueue/override contracts in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_b01_' + uuid.uuid4().hex[:10] + '_audit'
created = False

# Session TimeZone follows the synthetic families (Europe/Istanbul): 083/088 compare current_date with the
# family-local day and fail between 21:00 and 24:00 UTC on a UTC session (pre-existing, not B01).
def sql(database, body, owner=False, allow_error=False):
    role = 'supabase_admin' if owner or database != db else 'postgres'
    result = subprocess.run(['docker','exec','-i','-e','PGTZ=Europe/Istanbul','supabase_db_gina','psql','-X','-qAt','-U',role,'-d',database,'-v','ON_ERROR_STOP=1'], input=body,text=True,capture_output=True,timeout=300)
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
    admin_a='00000000-0000-4000-8000-000000009751';admin_b='00000000-0000-4000-8000-000000009752';parent='00000000-0000-4000-8000-000000009753'
    family='10000000-0000-4000-8000-000000009751';other='10000000-0000-4000-8000-000000009752'
    sql(db,f"""insert into auth.users(id,email) values('{admin_a}','b01-race-a@example.invalid'),('{admin_b}','b01-race-b@example.invalid'),('{parent}','b01-race-parent@example.invalid');
    insert into public.admins(user_id) values('{admin_a}'),('{admin_b}');
    insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}'),('{other}','Synthetic other','{parent}');
    insert into public.family_members(family_id,user_id) values('{family}','{parent}'),('{other}','{parent}');""")
    def claims(user,admin=True): return json.dumps({'sub':user,'role':'authenticated','gina':{'family_id':family,'role':'parent','admin':admin}},separators=(',',':'))
    def call(expression,user=admin_a):
        return sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims(user)}';select {expression};commit;",allow_error=True)
    def race(expressions):
        with ThreadPoolExecutor(max_workers=2) as pool: return list(pool.map(lambda e: call(*e) if isinstance(e,tuple) else call(e),expressions))
    def apply(key,plan='plus',until="now()+interval '30 days'",reason='Race comp',fam=family,replace='false'):
        return f"public.admin_override_apply('{fam}','{plan}',{until},'{reason}','{key}',{replace})"
    def live(fam=family): return int(sql(db,f"select count(*) from public.entitlement_overrides where family_id='{fam}' and revoked_at is null;"))
    races=[]
    # 1. Same admin, same key, same input at once: identical receipts, one override row, one apply audit entry.
    key=str(uuid.uuid4())
    r=race([apply(key,until="'2027-03-01 00:00+03'"),apply(key,until="'2027-03-01 00:00+03'")])
    assert all(not x.startswith('ERROR:') for x in r),r
    a,b=json.loads(r[0]),json.loads(r[1])
    assert a['override_id']==b['override_id'] and sorted([a['replayed'],b['replayed']])==[False,True],r
    assert live()==1 and sql(db,f"select count(*) from public.audit_log where action='entitlement_overrides.apply' and family_id='{family}';")=='1'
    races.append({'check':'same_admin_same_key_concurrent_single_row_identical_receipt','passed':True})
    # 2. Two admins, different keys, same family and plan at once: exactly one grant, the other sees the conflict.
    sql(db,f"delete from public.entitlement_overrides where family_id='{family}';delete from gina.override_commands where family_id='{family}';")
    r=race([(apply(str(uuid.uuid4()),until="'2027-03-01 00:00+03'"),admin_a),(apply(str(uuid.uuid4()),until="'2027-03-01 00:00+03'"),admin_b)])
    oks=[x for x in r if not x.startswith('ERROR:')];errs=[x for x in r if x.startswith('ERROR:')]
    assert len(oks)==1 and len(errs)==1 and 'plan_not_above_current' in errs[0],r
    assert live()==1
    races.append({'check':'two_admins_same_family_same_plan_one_grant_other_blocked','passed':True,'blocker':'plan_not_above_current'})
    # 3. Two admins, one upgrades to pro with replacement while the other grants plus: never two live comps.
    sql(db,f"delete from public.entitlement_overrides where family_id='{family}';delete from gina.override_commands where family_id='{family}';")
    r=race([(apply(str(uuid.uuid4()),'plus',"'2027-03-01 00:00+03'"),admin_a),(apply(str(uuid.uuid4()),'pro',"'2027-02-01 00:00+03'",replace='true'),admin_b)])
    plus_ok=not r[0].startswith('ERROR:');pro_ok=not r[1].startswith('ERROR:')
    assert pro_ok,r
    assert live()==1
    if plus_ok:
        # plus first, then pro replaced it
        assert json.loads(r[1])['replaced']==[json.loads(r[0])['override_id']],r
        order='plus_first_then_replaced'
    else:
        # pro first; plus request then conflicts with the higher plan (preview blocker)
        assert 'plan_not_above_current' in r[0],r
        order='pro_first_plus_blocked'
    assert sql(db,f"select plan from public.entitlement_overrides where family_id='{family}' and revoked_at is null;")=='pro'
    races.append({'check':'replace_vs_grant_never_two_live_comps','passed':True,'order':order})
    # 4. Same key reused by another admin or with another family: refused, nothing written.
    key=str(uuid.uuid4())
    first=call(apply(key,'plus',"'2027-03-01 00:00+03'",fam=other),admin_a)
    assert not first.startswith('ERROR:'),first
    r=race([(apply(key,'plus',"'2027-03-01 00:00+03'",fam=other),admin_b),(apply(key,'plus',"'2027-03-01 00:00+03'",fam=family),admin_a)])
    assert all('request_conflict' in x for x in r),r
    assert live(other)==1
    races.append({'check':'foreign_admin_or_other_family_cannot_replay_key','passed':True})
    # 5. Admin revoked while a write is in flight: the write never lands after the admins row is gone.
    key=str(uuid.uuid4())
    before=live()
    with ThreadPoolExecutor(max_workers=2) as pool:
        w=pool.submit(call,apply(key,'pro',"'2027-06-01 00:00+03'",fam=other,replace='true'),admin_b)
        d=pool.submit(sql,db,f"delete from public.admins where user_id='{admin_b}';")
        r=[w.result(),d.result()]
    revoked_write=not r[0].startswith('ERROR:')
    assert revoked_write or 'forbidden' in r[0],r
    if revoked_write: assert live(other)==1 and sql(db,f"select plan from public.entitlement_overrides where family_id='{other}' and revoked_at is null;")=='pro'
    else: assert sql(db,f"select plan from public.entitlement_overrides where family_id='{other}' and revoked_at is null;")=='plus'
    assert sql(db,f"select count(*) from public.admins where user_id='{admin_b}';")=='0'
    after=call(apply(str(uuid.uuid4()),'pro',"'2027-07-01 00:00+03'",fam=other,replace='true'),admin_b)
    assert 'forbidden' in after,after
    assert live(other)==1
    races.append({'check':'revoked_admin_refused_on_server_write','passed':True,'order':'write_before_revoke' if revoked_write else 'revoke_before_write'})
    # 6. Keyset pagination stays disjoint and complete while new families are created between pages.
    sql(db,f"insert into public.families(id,name,created_by,created_at) select ('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Race page '||g,'{parent}',now()-make_interval(mins=>g) from generate_series(1,130) g;")
    seen=[];cursor='null';pages=0
    while True:
        page=json.loads(call(f"public.admin_families_search('Race page',{cursor},50)"))
        seen+= [r['id'] for r in page['rows']];pages+=1
        if pages==1: sql(db,f"insert into public.families(id,name,created_by,created_at) values('30000000-0000-4000-8000-000000000999','Race page new','{parent}',now());")
        if not page['has_more']: break
        cursor="'"+page['next_cursor']+"'"
    assert len(seen)==len(set(seen))==130 and pages==3,(len(seen),pages)
    races.append({'check':'keyset_pages_disjoint_complete_under_concurrent_insert','passed':True,'pages':pages})
    # 7. Parent with a forged admin claim gets nothing from the workqueue even while admins exist.
    r=sql(db,f"begin;set local role authenticated;set local request.jwt.claims='{claims(parent)}';select public.admin_workqueue();commit;",allow_error=True)
    assert 'forbidden' in r,r
    races.append({'check':'forged_admin_claim_without_row_refused','passed':True})
    out=root/'docs/release/admin-workqueue-2026-11-06'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'races':len(races),'files':len(results),'assertions':sum(x['passed'] for x in results),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
