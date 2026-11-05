"""Q02 end-to-end family chain in a disposable local Auth/REST(/Realtime/Storage) clone.
Two families x two parents, one single-child device + one shared tablet, a support
operator and a full admin. Every step is retried by a foreign family/role and the
refusal is asserted. Also covers token expiry, membership/admin/device revocation
in an open session, duplicate taps, competing revisions and a lossy/slow proxy.
Usage: python3 scripts/test-e2e-family-chain.py --run-local [--with-realtime] [--with-storage]
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from q02_isolated import launch  # noqa: E402

flags = sys.argv[1:]
if '--run-local' not in flags:
    raise SystemExit('Explicit --run-local required')
launch('scripts/test-e2e-family-chain.mjs', 'gina_q02c_', 900, flags)
