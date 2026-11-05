"""Q02 performance measurement in a disposable local Auth/REST clone.
Seeds 250 tasks, 300 completions, 400 star events, 220 school grades, 50 ready
sources and a 20-question drawn Prova, then measures the app's main REST/RPC
queries (p50/p95, rows, bytes) and runs EXPLAIN (ANALYZE, BUFFERS) inside the
disposable DB to list sequential scans / index candidates with evidence.
Usage: python3 scripts/test-q02-perf.py --run-local
Writes docs/release/q02-2026-11-06/perf.json.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from q02_isolated import launch  # noqa: E402

flags = sys.argv[1:]
if '--run-local' not in flags:
    raise SystemExit('Explicit --run-local required')
launch('scripts/q02-perf.mjs', 'gina_q02p_', 1500, flags)
