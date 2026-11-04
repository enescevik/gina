#!/usr/bin/env python3
"""Prepare source-review candidates, never approvals or published curriculum."""
import argparse, importlib.util, json, re, sys
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("candidate_index", Path(__file__).with_name("build-curriculum-candidates.py"))
indexer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(indexer)

def prepare(data):
    index = indexer.build(data)
    outcomes = {o['id']: o for o in index['outcomes']}
    scenarios = {s['id']: s for s in index['scenarios']}
    candidates = []
    for s in data['scenarios']:
        match = re.fullmatch(r'([12])\. Dönem ([12])\. Ortak Yazılı Sınav', s['exam'])
        if not match or int(match[1]) != data['term']:
            raise ValueError('exam_scope_unresolved')
        reasons = {'source_review_required','programme_and_school_scope_required'}
        reasons.update(s['warnings'])
        for b in scenarios[s['id']]['blocks']:
            for oid in b['outcome_ids']:
                reasons.update(outcomes[oid]['review_reasons'])
        # Relevant source-level issues remain visible; no inferred class for missing sheets.
        for issue in data['issues']:
            if s['source_url'].endswith('/'+issue['file']):
                reasons.add('source_issue:'+issue['sheet']+':'+issue['reason'])
        candidates.append({
            'key':s['id'],'academic_year':data['academic_year'],'term':data['term'],'exam':int(match[2]),
            **{k:s[k] for k in ['grade','subject','source_url','source_sha256','sheet','header_cell','question_count','blocks']},
            'label':s['scenario'],'review_reasons':sorted(reasons),
        })
    return {'schema':'gina.curriculum-review.v1','candidates':candidates}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'docs/learning/catalog/2026-2027-term1/scenario-candidates.json')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    result=prepare(json.loads(args.input.read_text()))
    # A previously reviewed operator file is never overwritten.
    with args.output.open('x') as out: json.dump(result,out,ensure_ascii=False,indent=2);out.write('\n')
    print(json.dumps({'candidates':len(result['candidates']),'reviewed':0,'published':0}))
