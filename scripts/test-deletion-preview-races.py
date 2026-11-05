"""Run deletion-preview contracts and races in a disposable empty DB; never reset app/demo data."""
from pathlib import Path
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_delprev_' + uuid.uuid4().hex[:10] + '_audit'
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
    parent='00000000-0000-4000-8000-000000008901';partner='00000000-0000-4000-8000-000000008902';family='10000000-0000-4000-8000-000000008901'
    kids={'ece':'20000000-0000-4000-8000-000000008901','can':'20000000-0000-4000-8000-000000008902','dut':'20000000-0000-4000-8000-000000008903'}
    sql(db,f"""insert into auth.users(id,email) values('{parent}','del-race@example.invalid'),('{partner}','del-race-partner@example.invalid');
insert into public.families(id,name,created_by) values('{family}','Synthetic race','{parent}');
insert into public.family_members(family_id,user_id) values('{family}','{parent}'),('{family}','{partner}');
insert into public.children(id,family_id,name,grade) values('{kids['ece']}','{family}','Ece',5),('{kids['can']}','{family}','Can',3),('{kids['dut']}','{family}','Dut',1);
insert into public.notes(family_id,child_id,author_user_id,body,visibility) select '{family}',id,'{partner}','Partner private '||name,'private' from public.children where family_id='{family}';
insert into public.task_templates(family_id,child_id,title) select '{family}',id,'Read' from public.children where family_id='{family}';""")
    def claims(sub):
        return json.dumps({'sub':sub,'role':'authenticated','gina':{'family_id':family,'role':'parent'}},separators=(',',':'))
    def call(expression, sub=parent, role='authenticated', jwt=None, raw=False):
        statement = expression if raw else f"select {expression}"
        return sql(db,f"begin;set local role {role};set local request.jwt.claims='{jwt or claims(sub)}';{statement};commit;",allow_error=True)
    def race(jobs):
        with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(lambda j: call(*j) if isinstance(j,tuple) else call(j),jobs))
    def preview(child):
        out=call(f"public.deletion_preview(jsonb_build_object('kind','child','child_id','{child}'))");assert not out.startswith('ERROR:'),out
        return json.loads(out)
    def confirm(child,token,request=None):
        return f"public.confirm_child_deletion('{request or uuid.uuid4()}','{child}','{token}')"
    races=[]
    # 1) Same request id twice at once: one deletion, identical results, co-parent note detached exactly once.
    pv=preview(kids['ece']);req=str(uuid.uuid4())
    r=race([confirm(kids['ece'],pv['preview_token'],req)]*2)
    assert r[0]==r[1] and not r[0].startswith('ERROR:'),r
    assert sql(db,f"select count(*) from public.children where id='{kids['ece']}'")=='0'
    assert sql(db,f"select count(*) from public.notes where body='Partner private Ece' and child_id is null")=='1'
    races.append({'check':'same_request_concurrent_confirm_one_deletion_same_result','passed':True})
    assert call(confirm(kids['ece'],pv['preview_token'],req))==r[0]
    races.append({'check':'replay_after_deletion_returns_receipt','passed':True})
    # 2) Two different requests, same token: exactly one deletes, the other is refused.
    pv=preview(kids['can'])
    r=race([confirm(kids['can'],pv['preview_token']),confirm(kids['can'],pv['preview_token'])])
    ok=[x for x in r if not x.startswith('ERROR:')];err=[x for x in r if x.startswith('ERROR:')]
    assert len(ok)==1 and len(err)==1 and ('deletion_preview_not_found' in err[0] or 'deletion_preview_used' in err[0]),r
    assert sql(db,f"select count(*) from public.children where id='{kids['can']}'")=='0'
    races.append({'check':'different_requests_same_token_single_use','passed':True})
    # 3) Confirm races a rename of the same child: either the deletion wins and nothing is renamed, or the rename wins and the preview is stale.
    pv=preview(kids['dut'])
    rename=(f"with u as(update public.children set name='Dut Yeni' where id='{kids['dut']}' returning 1) select count(*) from u",parent,'authenticated',None,True)
    r=race([confirm(kids['dut'],pv['preview_token']),rename])
    exists=sql(db,f"select count(*) from public.children where id='{kids['dut']}'")
    if r[0].startswith('ERROR:'):
        assert 'deletion_preview_stale' in r[0] and r[1]=='1' and exists=='1',(r,exists)
        outcome='rename_won_confirm_stale'
    else:
        assert r[1]=='0' and exists=='0',(r,exists)
        outcome='confirm_won_rename_zero_rows'
    races.append({'check':'confirm_vs_rename_consistent','passed':True,'outcome':outcome})
    if exists=='1':
        pv=preview(kids['dut']);out=call(confirm(kids['dut'],pv['preview_token']));assert not out.startswith('ERROR:'),out
    # 4) A preview taken while the child is being deleted never fails with a referential error.
    sql(db,f"insert into public.children(id,family_id,name,grade) values('20000000-0000-4000-8000-000000008904','{family}','Ada',2);")
    pv=preview('20000000-0000-4000-8000-000000008904')
    r=race([confirm('20000000-0000-4000-8000-000000008904',pv['preview_token']),f"public.deletion_preview(jsonb_build_object('kind','child','child_id','20000000-0000-4000-8000-000000008904'))"])
    assert not r[0].startswith('ERROR:'),r
    assert (not r[1].startswith('ERROR:')) or ('forbidden' in r[1]),r
    assert 'violates' not in r[1],r
    races.append({'check':'preview_during_deletion_clean_outcome','passed':True,'outcome':'preview_ok' if not r[1].startswith('ERROR:') else 'preview_forbidden'})
    # 5) Account preview check is read-only and idempotent for the Edge function.
    out=call("public.deletion_preview('{\"kind\":\"account\"}')");assert not out.startswith('ERROR:'),out
    acc=json.loads(out);svc=json.dumps({'role':'service_role'})
    check=f"public.check_deletion_preview('{acc['preview_token']}','{parent}')->>'status'"
    r=race([(check,parent,'service_role',svc)]*2)
    assert r==['ok','ok'],r
    races.append({'check':'account_check_concurrent_idempotent','passed':True})
    assert sql(db,f"insert into public.children(family_id,name,grade) values('{family}','Sonra',4) returning 1")=='1'
    assert call(check,parent,'service_role',svc)=='stale'
    races.append({'check':'account_check_detects_target_change','passed':True})
    assert sql(db,f"select count(*) from public.notes where author_user_id='{partner}' and visibility='private'")=='3'
    races.append({'check':'co_parent_private_notes_all_preserved','passed':True})
    out=root/'docs/release/deletion-preview-2026-11-06'
    out.mkdir(parents=True,exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':results},indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races},indent=2)+'\n')
    print(json.dumps({'files':len(results),'assertions':sum(x['passed'] for x in results),'races':len(races),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
