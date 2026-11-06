"""H07: activation-readiness probe against isolated services.

Starts the C09 harness (docs/release/c09-2026-11-06/harness/run.py: disposable gina_c09_* DB with ALL migrations
including 20261106480000, own GoTrue + PostgREST, the UNCHANGED content-prereview index.ts on loopback with only
api.anthropic.com answered locally -> no hosted model, no cost), then drives the real Edge + RPCs:
gate closed, unauthorized callers, quota, single charge / cache, AI result != human decision, health, kill switch,
drain kick without Vault secrets. Writes STOP and reports cleanup.

Usage: H07_WORK=<private scratch dir> python3 probe.py > result.json
"""
import json, os, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
RUN = ROOT / 'docs/release/c09-2026-11-06/harness/run.py'
WORK = Path(os.environ['H07_WORK']); WORK.mkdir(parents=True, exist_ok=True)
checks, fx = [], None


def check(name, ok, **detail):
    checks.append({'name': name, 'ok': bool(ok), **detail})


def owner(sql):
    r = subprocess.run(['docker', 'exec', '-i', 'supabase_db_gina', 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', fx['db'], '-v', 'ON_ERROR_STOP=1'],
                       input=sql, capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise RuntimeError(r.stderr[-500:])
    return r.stdout.strip()


def http(url, body=None, headers=None, method='POST'):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={'content-type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b'null')
        except Exception:
            return e.code, None


def provider_calls():
    return http(fx['edge'] + '/content-prereview/__qa-provider-stats', method='GET')[1]['calls']


def token(who):
    c = fx['creds'][who]
    s, b = http(fx['url'] + '/auth/v1/token?grant_type=password', {'email': c['email'], 'password': c['password']}, {'apikey': fx['anon']})
    assert s == 200, (who, s)
    return b['access_token']


def edge(body, headers=None):
    return http(fx['edge'] + '/content-prereview', body, headers)


def rpc(name, args, tok):
    return http(fx['url'] + '/rest/v1/rpc/' + name, args, {'apikey': fx['anon'], 'authorization': 'Bearer ' + tok})


C = lambda n: f'c0910000-0000-4000-8000-00000000000{n}'
proc = subprocess.Popen([sys.executable, str(RUN)], env={**os.environ, 'C09_WORK': str(WORK)}, stdout=subprocess.PIPE, text=True, cwd=ROOT)
cleanup = None
try:
    line = proc.stdout.readline()
    if not line.startswith('READY'):
        raise RuntimeError('harness_not_ready: ' + line[:200])
    fx = json.loads((WORK / 'fixture.json').read_text())
    cron = {'x-cron-secret': fx['cron_secret']}
    tok = {k: token(k) for k in ('admin', 'content', 'finance', 'p1')}

    # 1. Gate closed (production state): no paid call through any path, kick sends nothing.
    owner("update public.app_settings set value='false' where key='content_prereview.enabled';"
          "update public.app_settings set value='1' where key='content_prereview.daily_call_limit';")
    s, b = edge({'drain': True}, cron)
    check('gate_closed_drain_claims_nothing', s == 200 and all(r.get('reason') == 'prereview_disabled' for r in b['results']) and len(b['results']) <= 1,
          status=s, processed=b.get('processed'))
    s, b = edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + tok['admin']})
    check('gate_closed_admin_request_no_call', s == 503 and b.get('reason') == 'prereview_disabled', status=s, reason=b.get('reason'))
    owner('select gina.kick_content_prereview();')
    check('gate_closed_kick_records_nothing', owner('select count(*) from gina.content_prereview_kicks;') == '0')
    check('gate_closed_zero_provider_calls', provider_calls() == 0)

    # 2. Unauthorized callers never reach the queue or the provider.
    denied = {
        'no_auth': edge({'kind': 'contribution_set', 'id': C(1)})[0],
        'wrong_cron_secret': edge({'drain': True}, {'x-cron-secret': 'x' * len(fx['cron_secret'])})[0],
        'empty_cron_secret': edge({'drain': True}, {'x-cron-secret': ''})[0],
        'anon_key_as_user': edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + fx['anon']})[0],
        'admin_token_drain': edge({'drain': True}, {'authorization': 'Bearer ' + tok['admin']})[0],
        'admin_token_pilot': edge({'pilot': True, 'confirm_paid': True, 'items': [{'key': 'x', 'content': {}}]}, {'authorization': 'Bearer ' + tok['admin']})[0],
        'finance_user': edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + tok['finance']})[0],
        'parent_user': edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + tok['p1']})[0],
    }
    check('unauthorized_calls_rejected_403', all(v == 403 for v in denied.values()), statuses=denied)
    check('unauthorized_zero_provider_calls', provider_calls() == 0)

    # 3. Gate open, quota 1: one paid call, the rest stays queued; the admin path hits the same quota.
    owner("update public.app_settings set value='true' where key='content_prereview.enabled';")
    s, b = edge({'drain': True}, cron)
    reasons = [r.get('reason') for r in b['results']]
    check('quota_one_paid_call_then_daily_limit', s == 200 and provider_calls() == 1 and 'daily_limit' in reasons, reasons=reasons, calls=provider_calls())
    s, b = edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + tok['admin']})
    check('quota_admin_request_deferred', s == 200 and b.get('outcome') == 'retry_pending' and b.get('reason') == 'daily_limit' and provider_calls() == 1,
          status=s, outcome=b.get('outcome'), reason=b.get('reason'))
    check('ledger_one_paid_row', owner("select count(*) from gina.content_prereview_calls where outcome<>'not_called';") == '1')

    # 4. Raise quota: single record reviewed once, replay cached, concurrent requests do not double charge.
    owner("update public.app_settings set value='10' where key='content_prereview.daily_call_limit';")
    before = provider_calls()
    s, b = edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + tok['content']})
    check('content_operator_request_reviewed', s == 200 and b.get('prereview_status') == 'ai_approved' and provider_calls() == before + 1, status=s, body=b)
    s, b = edge({'kind': 'contribution_set', 'id': C(1)}, {'authorization': 'Bearer ' + tok['admin']})
    check('replay_cached_no_second_charge', b.get('outcome') == 'cached' and provider_calls() == before + 1, outcome=b.get('outcome'))
    check('ledger_charged_once_for_item', owner(f"select count(*) from gina.content_prereview_calls where target_id='{C(1)}' and outcome<>'not_called';") == '1')

    # 5. AI result is not a human decision; human review remains a separate admin action.
    row = owner(f"select status||'|'||coalesce(reviewed_by::text,'null') from gina.contribution_sets where id='{C(1)}';")
    check('ai_approved_is_not_human_approval', row == 'pending|null', row=row)
    check('ai_audit_actor_is_system', owner(f"select count(*) from public.audit_log where action='content_prereview.ai_approved' and actor_id is null and target_id='contribution_set:{C(1)}';") == '1')

    # 6. Health / monitoring: operator can read, finance cannot.
    s, h = rpc('admin_content_prereview_health', {}, tok['content'])
    check('health_readable_by_content_operator', s == 200 and h['enabled'] is True and h['calls_24h'] == 2 and h['daily_call_limit'] == 10,
          status=s, calls_24h=h.get('calls_24h') if isinstance(h, dict) else None, alerts=h.get('alerts') if isinstance(h, dict) else None)
    s, _ = rpc('admin_content_prereview_health', {}, tok['finance'])
    check('health_refused_for_finance', s in (401, 403), status=s)

    # 7. Drain kick without Vault secrets: recorded, no request, visible as an alert.
    owner(f"update gina.content_prereviews set prereview_status='pending',lease=null,attempts=0 where target_id='{C(2)}';"
          f"insert into gina.content_prereviews(target_kind,target_id,content_hash) select 'contribution_set','{C(2)}',repeat('0',64) where not exists(select 1 from gina.content_prereviews where target_id='{C(2)}');")
    owner('select gina.kick_content_prereview();')
    check('kick_without_vault_recorded', owner('select note from gina.content_prereview_kicks order by id desc limit 1;') == 'vault_secret_missing')
    s, h = rpc('admin_content_prereview_health', {}, tok['admin'])
    check('health_alerts_vault_secret_missing', 'vault_secret_missing' in (h.get('alerts') or []), alerts=h.get('alerts'))

    # 8. Kill switch: immediate, no further calls.
    owner("update public.app_settings set value='false' where key='content_prereview.enabled';")
    before = provider_calls()
    s1, b1 = edge({'kind': 'contribution_set', 'id': C(2)}, {'authorization': 'Bearer ' + tok['admin']})
    s2, b2 = edge({'drain': True}, cron)
    check('kill_switch_immediate', s1 == 503 and b1.get('reason') == 'prereview_disabled' and provider_calls() == before
          and all(r.get('reason') == 'prereview_disabled' for r in b2['results']), admin=s1, drain=b2.get('processed'))
finally:
    (WORK / 'STOP').write_text('stop')
    try:
        out, _ = proc.communicate(timeout=180)
        cleanup = json.loads(out.strip().splitlines()[-1])
    except Exception as e:
        proc.kill()
        cleanup = {'error': str(e)}
    print(json.dumps({'checks': checks, 'passed': sum(c['ok'] for c in checks), 'total': len(checks), 'harness': cleanup}, indent=1, ensure_ascii=False))
