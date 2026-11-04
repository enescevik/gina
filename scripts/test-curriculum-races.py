#!/usr/bin/env python3
"""Catalogue receipt/revision races in explicit disposable audit clones only."""
import argparse, json, re, subprocess, threading, uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser();parser.add_argument('--template',required=True);args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('Explicit audit template required')
root=Path(__file__).resolve().parents[1]
def sql(db,body,check=True):
    p=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=40)
    if check and p.returncode:raise RuntimeError(p.stderr)
    return p
fixture=(root/'supabase/tests/056_curriculum_source_review.test.sql').read_text().split('set local role authenticated;',1)[0].replace('select no_plan();','')
helpers=fixture[fixture.index('create function pg_temp.bundle()'):]
auth="set local role authenticated;set local request.jwt.claims='{\"sub\":\"00000000-0000-4000-8000-000000005602\",\"role\":\"authenticated\",\"gina\":{\"role\":\"parent\",\"admin\":true}}';"
results=[]
for scenario in ['same_import','competing_reviews','same_publication']:
    db='gina_curriculum_'+uuid.uuid4().hex+'_audit'
    sql('postgres',f'create database {db} template {args.template};')
    try:
        sql(db,fixture+'commit;')
        if scenario!='same_import':
            sql(db,'begin;'+helpers+auth+"select public.admin_import_curriculum_candidates(gen_random_uuid(),pg_temp.bundle());commit;")
            cid=sql(db,'select id from gina.curriculum_candidates;').stdout.strip()
        if scenario=='same_publication':sql(db,'begin;'+helpers+auth+f"select public.admin_change_curriculum_candidate(gen_random_uuid(),'{cid}',0,'review',pg_temp.review(),'Synthetic review',true);commit;")
        request=str(uuid.uuid4());barrier=threading.Barrier(2)
        def send(i):
            if scenario=='same_import':body=f"select public.admin_import_curriculum_candidates('{request}',pg_temp.bundle());"
            elif scenario=='competing_reviews':body=f"select public.admin_change_curriculum_candidate('{request if i==0 else uuid.uuid4()}','{cid}',0,'review',pg_temp.review(),'Review {i}',true);"
            else:body=f"select public.admin_change_curriculum_candidate('{request}','{cid}',1,'publish',null,'Synthetic publication',true);"
            barrier.wait(timeout=10)
            return sql(db,"begin;set local lock_timeout='10s';"+helpers+auth+body+'select pg_sleep(0.1);commit;',False)
        with ThreadPoolExecutor(max_workers=2) as pool:pair=list(pool.map(send,[0,1]))
        successes=sum(p.returncode==0 for p in pair)
        assert successes==(1 if scenario=='competing_reviews' else 2),[(p.returncode,p.stderr) for p in pair]
        for p in pair:
            if p.returncode:assert 'curriculum_revision_conflict' in p.stderr,p.stderr
        rows=json.loads(sql(db,"select jsonb_agg(jsonb_build_object('status',status,'revision',revision)) from gina.curriculum_candidates;").stdout)
        assert rows==[{'status':{'same_import':'draft','competing_reviews':'reviewed','same_publication':'published'}[scenario],'revision':{'same_import':0,'competing_reviews':1,'same_publication':2}[scenario]}],rows
        results.append({'scenario':scenario,'successes':successes,'state':rows[0],'passed':True})
    finally:sql('postgres',f'drop database {db};')
print(json.dumps(results,indent=2))
