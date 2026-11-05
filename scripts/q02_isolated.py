"""Q02 launcher: reuses scripts/test-isolated-services.py's disposable Auth/REST/
Realtime/Storage setup for additional Node contract runners WITHOUT editing that
script. Only four literal, asserted-unique substitutions are made:
  * container/database prefix  -> a caller prefix (parallel agents never collide)
  * Node runner path           -> the caller's .mjs
  * Node timeout               -> caller timeout (performance runs are longer)
  * child environment          -> adds GINA_QA_DB and GINA_QA_JWT_SECRET so the
    runner can EXPLAIN inside its own disposable DB and mint expired/forged
    tokens for negative tests. Secrets stay in the process; nothing is printed.
Never targets the existing local app DB or a hosted project.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/test-isolated-services.py'


def launch(runner: str, prefix: str, timeout: int, argv: list[str]) -> None:
    source = SOURCE.read_text()
    replacements = [
        ("'gina_http_' + secrets.token_hex(8) + '_audit'", f"'{prefix}' + secrets.token_hex(8) + '_audit'"),
        ("['node', 'scripts/test-isolated-services.mjs']", f"['node', '{runner}']"),
        ("timeout=3000 if UI_HOLD else 180", f"timeout={int(timeout)}"),
        ("env = {**os.environ, 'GINA_QA_UI_HOLD'", "env = {**os.environ, 'GINA_QA_DB': DB, 'GINA_QA_JWT_SECRET': secret, 'GINA_QA_UI_HOLD'"),
        # Surface the runner's own stderr (stack traces, never credentials) when its report is missing.
        ("stdout, _ = process.communicate(", "stdout, runner_stderr = process.communicate("),
        # ALTER TABLE ... OWNER rewrites the owner's ACL entries, so the clone's `postgres` role loses the
        # DELETE privilege it has in the real local stack, the template and hosted Supabase. The account
        # deletion trigger (SECURITY DEFINER, owner postgres) deletes anonymous device users; restore parity.
        ("    grant references on auth.users to postgres;", "    grant select, delete, references on auth.users to postgres;"),
        ("        report['checks'] = json.loads(stdout)['checks']\n    except Exception:\n",
         "        report['checks'] = json.loads(stdout)['checks']\n    except Exception:\n        print(runner_stderr[-4000:], file=sys.stderr)\n"),
    ]
    for old, new in replacements:
        if source.count(old) != 1:
            raise SystemExit('q02_launcher_anchor_missing: ' + old)
        source = source.replace(old, new)
    sys.argv = [str(SOURCE)] + argv
    exec(compile(source, str(SOURCE) + ' (q02)', 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
