"""S04: docs/learning/catalog/subject-synonyms.json -> migration SQL blocks.

Prints (or with --check verifies) the generated part of
supabase/migrations/20261106180000_subject_catalog_and_calendar_seed.sql between
`-- BEGIN GENERATED subject-catalog` and `-- END GENERATED subject-catalog`.

- Only `proposed: true` subjects are inserted into public.guided_input_options
  (`on conflict (id) do nothing`; the 12 existing ids are never touched).
- Every alias (and label_tr/label_en) of every subject becomes a row in
  gina.subject_synonyms; non-contiguous grade lists (e.g. İnkılap 8 and 12) become
  one row per contiguous grade run so scope checks stay exact.
- POLICY_AMBIGUITY rows come from the JSON's matching_policy/normalization_examples:
  labels that must offer several candidates ('Fen' in high school, 'Din', 'Yabancı Dil').
Normalisation must equal gina.normalize_subject_alias() and core normalizeSubjectAlias().
Usage: python3 scripts/build-subject-catalog-sql.py [--check]
"""
from pathlib import Path
import json, re, sys

root = Path(__file__).resolve().parents[1]
src = root / 'docs/learning/catalog/subject-synonyms.json'
migration = root / 'supabase/migrations/20261106180000_subject_catalog_and_calendar_seed.sql'
FROM, TO = 'İIıÇçŞşĞğÖöÜüÂâÎîÛûÉé', 'iiiccssggoouuaaiiuuee'

# (alias, subject_id, grade_min, grade_max) — see module docstring.
POLICY_AMBIGUITY = [
    ('Fen', 'subject-physics', 9, 12), ('Fen', 'subject-chemistry', 9, 12), ('Fen', 'subject-biology', 9, 12),
    ('Din', 'subject-quran', 5, 12), ('Din', 'subject-prophet-life', 5, 12), ('Din', 'subject-basic-religious', 5, 12),
    ('Yabancı Dil', 'subject-german', 2, 12), ('Yabancı Dil', 'subject-french', 2, 12),
    ('İkinci Yabancı Dil', 'subject-french', 5, 12),
    ('Sosyal', 'subject-social-science-studies', 9, 12),
    ('Trafik', 'subject-health-traffic', 9, 9),
    ('İnkılap', 'subject-history', 9, 11),
]


def normalize(text: str) -> str:
    s = text.translate(str.maketrans(FROM, TO)).lower()
    s = re.sub(r'[^a-z0-9]', '', s)
    if s.endswith('dersi') and len(s) > 5:
        s = s[:-5]
    return s


def runs(grades):
    grades = sorted(set(grades))
    out, start, prev = [], grades[0], grades[0]
    for g in grades[1:]:
        if g != prev + 1:
            out.append((start, prev))
            start = g
        prev = g
    out.append((start, prev))
    return out


def q(text):
    return "'" + text.replace("'", "''") + "'"


def build():
    data = json.loads(src.read_text())
    subjects = data['subjects']
    known = {s['id'] for s in subjects}
    proposed = [s for s in subjects if s['proposed']]
    assert len(proposed) == 20, len(proposed)
    options = []
    for i, s in enumerate(proposed):
        assert len(s['label_tr']) <= 80 and len(s['label_en']) <= 80
        options.append(f"({q(s['id'])},'subject',{q(s['label_tr'])},{q(s['label_en'])},{min(s['grades'])},{max(s['grades'])},{130 + i * 10})")
    rows, seen = [], set()
    for s in subjects:
        for alias in [s['label_tr'], s['label_en'], *s['aliases']]:
            n = normalize(alias)
            if not n:
                continue
            for lo, hi in runs(s['grades']):
                key = (n, s['id'], lo)
                if key in seen:
                    continue
                seen.add(key)
                rows.append(f"({q(n)},{q(alias)},{q(s['id'])},{lo},{hi},'catalog')")
    for alias, sid, lo, hi in POLICY_AMBIGUITY:
        assert sid in known, sid
        key = (normalize(alias), sid, lo)
        if key not in seen:
            seen.add(key)
            rows.append(f"({q(normalize(alias))},{q(alias)},{q(sid)},{lo},{hi},'policy_ambiguity')")
    block = ('-- BEGIN GENERATED subject-catalog (scripts/build-subject-catalog-sql.py; source checked_at '
             + data['checked_at'] + ')\n'
             + 'insert into public.guided_input_options(id,kind,label_tr,label_en,min_grade,max_grade,position) values\n'
             + ',\n'.join(options) + '\non conflict (id) do nothing;\n'
             + 'insert into gina.subject_synonyms(alias_normalized,alias,subject_id,grade_min,grade_max,source) values\n'
             + ',\n'.join(rows) + '\non conflict do nothing;\n'
             + '-- END GENERATED subject-catalog')
    return block, len(options), len(rows)


block, n_options, n_rows = build()
if '--check' in sys.argv:
    text = migration.read_text()
    m = re.search(r'-- BEGIN GENERATED subject-catalog.*?-- END GENERATED subject-catalog', text, re.S)
    if not m or m.group(0) != block:
        raise SystemExit('migration generated block is out of date')
    print(f'ok: {n_options} subject options, {n_rows} synonym rows in sync')
else:
    print(block)
    print(f'-- {n_options} options, {n_rows} synonym rows', file=sys.stderr)
