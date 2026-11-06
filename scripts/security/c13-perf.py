"""C13 performance measurement in a disposable local Auth/REST clone (prefix gina_c13p_).
Runs scripts/security/c13-perf.mjs, which seeds a synthetic family (250 routines with history, 1000 star events,
500 learning sources, 500 notes, 120 help tickets with attachments, a 20-question drawn Prova, ~1000 backoffice
library rows) and measures child Today, calendar week/42-day plans, tasks screen, Prova review, backoffice content
list and large lists: REST/RPC p50/p95 with real GoTrue tokens + EXPLAIN (ANALYZE, BUFFERS) and function call
counts inside the disposable DB.
Before/after on the same seed:  GINA_C13_CANDIDATE=docs/release/c13-2026-11-06/perf/candidate.sql
                                 [GINA_C13_ROLLBACK=docs/release/c13-2026-11-06/perf/candidate-rollback.sql]
Usage: python3 scripts/security/c13-perf.py --run-local
Writes docs/release/c13-2026-11-06/perf/perf-before.json (+ perf-after.json, perf-before2.json).
Never targets the local app DB `postgres`, the template `gina_completion_audit` or any hosted project.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import q02_isolated  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'scripts/test-isolated-services.py'


def launch_current(runner: str, prefix: str, timeout: int, argv: list[str]) -> None:
    """Same technique as q02_isolated.launch (literal, asserted-unique substitutions; the shared script is not
    edited) with anchors matching the CURRENT test-isolated-services.py: its Node timeout is now 420 s and it
    already grants postgres all on auth.users, so q02_isolated's anchors no longer match (stale launcher)."""
    source = SOURCE.read_text()
    replacements = [
        ("'gina_http_' + secrets.token_hex(8) + '_audit'", f"'{prefix}' + secrets.token_hex(8) + '_audit'"),
        ("['node', 'scripts/test-isolated-services.mjs']", f"['node', '{runner}']"),
        ("timeout=3000 if UI_HOLD else 420", f"timeout={int(timeout)}"),
        ("env = {**os.environ, 'GINA_QA_UI_HOLD'", "env = {**os.environ, 'GINA_QA_DB': DB, 'GINA_QA_UI_HOLD'"),
        ("stdout, _ = process.communicate(", "stdout, runner_stderr = process.communicate("),
        ("    if process.returncode:\n        raise RuntimeError('service_contract_failed')",
         "    if process.returncode:\n        print(runner_stderr[-4000:], file=sys.stderr)\n        raise RuntimeError('service_contract_failed')"),
        ("        report['checks'] = json.loads(stdout)['checks']\n    except Exception:\n",
         "        report['checks'] = json.loads(stdout)['checks']\n    except Exception:\n        print(runner_stderr[-4000:], file=sys.stderr)\n"),
    ]
    for old, new in replacements:
        if source.count(old) != 1:
            raise SystemExit('c13_launcher_anchor_missing: ' + old)
        source = source.replace(old, new)
    sys.argv = [str(SOURCE)] + argv
    exec(compile(source, str(SOURCE) + ' (c13)', 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})


def launch(runner: str, prefix: str, timeout: int, argv: list[str]) -> None:
    try:
        q02_isolated.launch(runner, prefix, timeout, argv)
    except SystemExit as stop:
        if 'q02_launcher_anchor_missing' not in str(stop.code):
            raise
        print('q02_isolated anchors are stale; using the equivalent current-anchor launcher', file=sys.stderr)
        launch_current(runner, prefix, timeout, argv)


flags = sys.argv[1:]
if '--run-local' not in flags:
    raise SystemExit('Explicit --run-local required')
for key in ('GINA_C13_CANDIDATE', 'GINA_C13_ROLLBACK'):
    if os.environ.get(key):
        path = Path(os.environ[key]).resolve()
        if not path.is_file():
            raise SystemExit(key + '_missing')
        os.environ[key] = str(path)
launch('scripts/security/c13-perf.mjs', 'gina_c13p_', 3000, flags)
