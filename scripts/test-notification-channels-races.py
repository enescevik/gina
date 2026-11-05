#!/usr/bin/env python3
"""S02 email/SMS channel contracts: all pgTAP files plus real concurrency races, in a disposable
empty database cloned from the empty audit template. Never touches demo/production data."""
from pathlib import Path
import datetime, json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
if sys.argv[1:] != ['--run-local']:
    raise SystemExit('Explicit --run-local required')
root = Path(__file__).resolve().parents[1]
db = 'gina_channels_' + uuid.uuid4().hex[:10] + '_audit'
created = False

def sql(database, body, owner=False, allow_error=False):
    role = 'supabase_admin' if owner or database != db else 'postgres'
    result = subprocess.run(['docker','exec','-i','supabase_db_gina','psql','-X','-qAt','-U',role,'-d',database,'-v','ON_ERROR_STOP=1'], input=body, text=True, capture_output=True, timeout=180)
    if result.returncode:
        if allow_error: return 'ERROR:' + result.stderr.strip()
        raise RuntimeError(result.stderr[-1800:])
    return result.stdout.strip()

OPERATOR='00000000-0000-4000-8000-000000009601'; PARENT='00000000-0000-4000-8000-000000009602'; OTHER='00000000-0000-4000-8000-000000009603'; FAMILY='10000000-0000-4000-8000-000000009601'
def claims(user, family=None):
    g = {'role':'parent'} | ({'family_id':family} if family else {})
    return json.dumps({'sub':user,'role':'authenticated','gina':g}, separators=(',',':'))
def as_user(user, family, expression):
    return sql(db, f"begin;set local lock_timeout='10s';set local role authenticated;set local request.jwt.claims='{claims(user,family)}';select {expression};commit;", allow_error=True)
def as_service(expression):
    return sql(db, f"begin;set local lock_timeout='10s';set local role service_role;set local request.jwt.claims='{{\"role\":\"service_role\"}}';select {expression};commit;", allow_error=True)
def as_anon(expression):
    return sql(db, f"begin;set local role anon;select {expression};commit;", allow_error=True)
def race(calls):
    with ThreadPoolExecutor(max_workers=len(calls)) as pool: return list(pool.map(lambda c: c(), calls))
def publish(ann, channels='["email"]'):
    value = json.dumps({'title':'Race notice','body':'Concurrency fixture announcement.','push':False,'expires_on':(datetime.date.today()+datetime.timedelta(days=7)).isoformat(),'channels':json.loads(channels)})
    r = as_user(OPERATOR, None, f"public.admin_save_announcement('{uuid.uuid4()}','{ann}',0,'{value}'::jsonb)"); assert not r.startswith('ERROR:'), r
    fp = as_user(OPERATOR, None, f"public.admin_preview_announcement('{ann}',1)->>'fingerprint'"); assert not fp.startswith('ERROR:'), fp
    return as_user(OPERATOR, None, f"public.admin_publish_announcement('{uuid.uuid4()}','{ann}',1,'{fp}',true)")

try:
    assert sql('gina_completion_audit','begin read only; select count(*) from public.families; select count(*) from auth.users; commit;') == '0\n0'
    sql('postgres', f'create database {db} owner postgres template gina_completion_audit;')
    created = True
    sql(db, 'grant references on auth.users to postgres;create publication supabase_realtime;', owner=True)
    for migration in sorted((root/'supabase/migrations').glob('*.sql')):
        if migration.name < '20261103093000':
            for line in migration.read_text().splitlines():
                if line.lower().startswith('alter publication supabase_realtime add table '): sql(db, line)
        else: sql(db, migration.read_text())
    results = []
    # In-scope files must pass; any other failing file is reported verbatim, never hidden.
    in_scope = ('061_', '081_', '095_')
    for file in sorted((root/'supabase/tests').glob('*.sql')):
        output = sql(db, file.read_text(), allow_error=True)
        failures = [line for line in output.splitlines() if line.startswith('not ok') or line.startswith('# Looks like') or line.startswith('ERROR:')]
        count = len(re.findall(r'^ok \d+', output, re.M))
        if file.name.startswith(in_scope):
            assert not failures and count > 0, file.name + '\n' + '\n'.join(failures)
        results.append({'file':file.name,'passed':count} | ({'failures':failures} if failures else {}))
    # Synthetic fixture: release operator, one parent with session, email channel configured + reported.
    sql(db, f"""insert into auth.users(id,email) values('{OPERATOR}','race-operator@example.invalid'),('{PARENT}','race-parent@example.invalid'),('{OTHER}','race-other@example.invalid');
    insert into public.operations_members(user_id,role,expires_at) values('{OPERATOR}','release',now()+interval '1 day');
    insert into public.families(id,name,created_by) values('{FAMILY}','Race family','{PARENT}');
    insert into public.family_members(family_id,user_id) values('{FAMILY}','{PARENT}'),('{FAMILY}','{OTHER}');
    insert into auth.sessions(id,user_id) values(gen_random_uuid(),'{PARENT}'),(gen_random_uuid(),'{OTHER}');
    update public.app_settings set value='"resend"' where key='channels.email.provider';
    update public.app_settings set value='"noreply@example.invalid"' where key='channels.email.from_address';
    update public.app_settings set value='true' where key='channels.email.sender_domain_verified';
    insert into gina.channel_provider_status(channel,provider,configured) values('email','resend',true);
    insert into gina.contact_channels(user_id,kind,value) values('{PARENT}','email','race-parent@example.invalid');
    insert into gina.notification_preferences(user_id,channel,purpose,enabled,source) values('{PARENT}','email','announcement',true,'user');""")
    races = []
    # 1. Two workers claim the same single pending row: exactly one gets it.
    ann1 = str(uuid.uuid4()); r = publish(ann1); assert '"queued": 1' in r or '"queued":1' in r.replace(' ',''), r
    pair = race([lambda: as_service('public.channel_claim(1)')]*2)
    assert all(not x.startswith('ERROR:') for x in pair), pair
    got = [json.loads(x) for x in pair]; assert sum(len(g) for g in got) == 1, got
    row = next(g for g in got if g)[0]
    assert sql(db, "select attempts from gina.channel_outbox where kind='parent_announcement'") == '1'
    races.append({'check':'same_row_claimed_once','passed':True})
    # 2. The same receipt twice (lost reply): one accepted row, one provider id, no error.
    rec = f"public.channel_record_result({row['id']},'{row['lease_id']}','accepted','resend','re_race')"
    pair = race([lambda: as_service(rec)]*2)
    assert pair == ['t','t'], pair
    assert sql(db, "select status||':'||provider_message_id||':'||attempts from gina.channel_outbox where kind='parent_announcement'") == 'accepted:re_race:1'
    assert json.loads(as_service('public.channel_claim(5)')) == []
    races.append({'check':'duplicate_receipt_single_acceptance_no_resend','passed':True})
    # 3. Expired worker: a fresh claim and the stale lease race; the stale lease is fenced out.
    ann2 = str(uuid.uuid4()); publish(ann2)
    stale = json.loads(as_service('public.channel_claim(1)'))[0]
    sql(db, f"update gina.channel_outbox set claimed_at=now()-interval '6 minutes' where id={stale['id']}")
    pair = race([lambda: as_service('public.channel_claim(1)'), lambda: as_service(f"public.channel_record_result({stale['id']},'{stale['lease_id']}','accepted','resend','late')")])
    assert len(json.loads(pair[0])) == 1 and 'channel_lease_changed' in pair[1], pair
    assert sql(db, f"select status||':'||attempts||':'||coalesce(provider_message_id,'-') from gina.channel_outbox where id={stale['id']}") == 'sending:2:-'
    races.append({'check':'stale_lease_fenced_out','passed':True})
    # 4. Verification rate limit under concurrency: at most three requests per hour, one live secret.
    addrs = [f'race-{i}@example.invalid' for i in range(4)]
    four = race([ (lambda a=a: as_user(OTHER, FAMILY, f"public.request_contact_verification('email','{a}')")) for a in addrs])
    okc = sum(not x.startswith('ERROR:') for x in four); limited = sum('verification_rate_limited' in x for x in four)
    assert okc == 3 and limited == 1, four
    assert sql(db, f"select count(*) from gina.channel_outbox where user_id='{OTHER}' and kind='contact_verification' and status='pending' and payload ? 'secret'") == '1'
    assert sql(db, f"select count(*) from gina.channel_outbox where user_id='{OTHER}' and kind='contact_verification' and skip_reason='verification_superseded'") == '2'
    races.append({'check':'verification_rate_limit_serialized_single_live_secret','passed':True})
    # 5. Unsubscribe link and a new announcement publish at the same time: never a sendable row afterwards.
    token = sql(db, f"select gina.unsubscribe_token('{PARENT}','email','announcement')")
    ann3 = str(uuid.uuid4())
    pair = race([lambda: publish(ann3), lambda: as_anon(f"public.unsubscribe_with_token('{token}')")])
    assert all(not x.startswith('ERROR:') for x in pair), pair
    assert sql(db, f"select count(*) from gina.channel_outbox where payload->>'announcement_id'='{ann3}' and status='pending'") == '0'
    outcome = sql(db, f"select coalesce(jsonb_object_agg(outcome,n),'{{}}') from gina.announcement_channel_summary where announcement_id='{ann3}'")
    assert json.loads(outcome) in ({'queued':1,'address_unverified':1},{'preference_off':1,'address_unverified':1}), outcome
    assert sql(db, f"select enabled from gina.notification_preferences where user_id='{PARENT}' and channel='email' and purpose='announcement'") == 'f'
    races.append({'check':'unsubscribe_vs_publish_no_sendable_row','outcome':json.loads(outcome),'passed':True})
    out = root/'docs/release/notification-channels-2026-11-06'
    out.mkdir(parents=True, exist_ok=True)
    (out/'sql-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','template':'gina_completion_audit','results':results}, indent=2)+'\n')
    (out/'race-checks.json').write_text(json.dumps({'environment':'empty-disposable-database','results':races}, indent=2)+'\n')
    print(json.dumps({'files':len(results),'assertions':sum(x['passed'] for x in results),'files_with_failures':[x['file'] for x in results if 'failures' in x],'races':len(races),'passed':True}))
finally:
    if created: sql('postgres', f'drop database {db} with(force);')
