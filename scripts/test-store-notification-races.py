#!/usr/bin/env python3
"""Store inbox races in an explicitly named disposable audit clone only."""
import argparse, json, re, subprocess, threading, uuid
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser(); parser.add_argument('--template',required=True); args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template): parser.error('An audit template is required')
def sql(db,body):
    r=subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-U','postgres','-d',db,'-X','-At','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=35)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout
claim="select public.claim_store_notification('apple','concurrent','TEST','{\"verified\":true}');"
db='gina_store_'+uuid.uuid4().hex+'_audit'; sql('postgres',f'create database {db} template {args.template};')
try:
    barrier=threading.Barrier(2)
    def send(_):
        barrier.wait(timeout=10)
        out=sql(db,"begin;set local role service_role;set local lock_timeout='10s';"+claim+"select pg_sleep(0.2);commit;")
        return next(json.loads(line) for line in out.splitlines() if line.startswith('{'))
    with ThreadPoolExecutor(max_workers=2) as pool: pair=list(pool.map(send,range(2)))
    assert sorted(x['status'] for x in pair)==['busy','claimed'],pair
    first=next(x['token'] for x in pair if x['status']=='claimed')
    sql(db,"update public.store_notifications set lease_until=clock_timestamp()-interval '1 second' where event_key='concurrent';")
    barrier=threading.Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as pool: recovered=list(pool.map(send,range(2)))
    assert sorted(x['status'] for x in recovered)==['busy','claimed'],recovered
    token=next(x['token'] for x in recovered if x['status']=='claimed')
    assert token!=first
    assert sql(db,f"select public.finish_store_notification('apple','concurrent','{first}');").strip()=='f'
    assert sql(db,f"select public.finish_store_notification('apple','concurrent','{token}');").strip()=='t'
    with ThreadPoolExecutor(max_workers=2) as pool: done=list(pool.map(send,range(2)))
    assert all(x['status']=='done' for x in done),done
    count=sql(db,"select count(*),max(attempts) from public.store_notifications where event_key='concurrent';").strip()
    assert count=='1|2',count
    print(json.dumps({'simultaneous_delivery':'passed','expired_lease_race':'passed','stale_worker_finish':'rejected','completed_duplicates':'passed','receipts':1,'attempts':2},indent=2))
finally: sql('postgres',f'drop database {db};')
