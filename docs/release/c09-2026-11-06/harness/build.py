"""Build the static backoffice against the disposable C07 fixture (URL + anon key from C09_WORK/fixture.json).
The anon key is a throwaway JWT signed with the fixture's random secret; nothing is written to the repo."""
import json, os, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
fx = json.loads((Path(os.environ['C09_WORK']) / 'fixture.json').read_text())
assert fx['url'].startswith('http://127.0.0.1:')
env = {**os.environ, 'NEXT_PUBLIC_SUPABASE_URL': fx['url'], 'NEXT_PUBLIC_SUPABASE_ANON_KEY': fx['anon']}
r = subprocess.run(['pnpm', 'build'], cwd=ROOT / 'apps/backoffice', env=env, capture_output=True, text=True)
print(r.stdout[-600:], r.stderr[-600:])
raise SystemExit(r.returncode)
