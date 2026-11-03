#!/usr/bin/env python3
"""Count authored drafts separately from approval/publication; no implicit review."""
import argparse
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PLAN=ROOT/'research_notes/GINA soru ve defter deneyimi/coverage-candidates.json'
POOL=ROOT/'docs/learning/library-pilot'

def build(plan,packages):
    entries=[];seen=set();by_scope={}
    for path,p in packages:
        scope=(p['grade'],p['subject'])
        if p['status']!='draft' or p['publishable'] is not False or p['human_editorial_approval'] is not None:
            raise ValueError('draft_only_ledger')
        if p['id'] in seen:raise ValueError('duplicate_package')
        seen.add(p['id']);ids=[q['id'] for q in p['questions']]
        if len(set(ids))!=len(ids):raise ValueError('duplicate_question')
        if any((q['grade'],q['subject'])!=scope or q['publishable'] is not False for q in p['questions']):raise ValueError('question_scope')
        by_scope.setdefault(scope,[]).append({'id':p['id'],'path':path,'questions':len(ids),'outcome_candidates':sorted({q['curriculum']['candidate_code'] for q in p['questions']}),'question_ids':ids})
    planned={(e['grade'],e['subject_label_tr']) for e in plan['entries']}
    if set(by_scope)-planned:raise ValueError('unplanned_scope')
    for e in plan['entries']:
        packages=by_scope.get((e['grade'],e['subject_label_tr']),[])
        ids=[i for p in packages for i in p['question_ids']]
        if len(ids)!=len(set(ids)):raise ValueError('duplicate_question')
        n=len(ids);target=e['candidate_question_count']
        entries.append({'id':e['id'],'grade':e['grade'],'subject':e['subject_label_tr'],'target':target,'authored_drafts':n,'approved':0,'published':0,'remaining_drafts':max(0,target-n),'status':'editorial_review_pending' if n else 'not_authored','annual_curriculum_complete':False,'packages':[{k:v for k,v in p.items() if k!='question_ids'} for p in packages]})
    return {'schema':'gina.library-draft-coverage.v1','source_plan':str(PLAN.relative_to(ROOT)),'note':'Counts of original draft files only. A 20-item unit pool is not annual subject coverage. Technical acceptance is recorded separately, never inferred from count.','totals':{'grade_subject_pairs':len(entries),'target':sum(e['target'] for e in entries),'authored_drafts':sum(e['authored_drafts'] for e in entries),'approved':0,'published':0,'remaining_drafts':sum(e['remaining_drafts'] for e in entries)},'entries':entries}

def current():
    return build(json.loads(PLAN.read_text()),[(str(p.relative_to(ROOT)),json.loads(p.read_text())) for p in sorted(POOL.glob('*/pilot.json'))])

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    value=current();out=POOL/'coverage.json';text=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    if args.check:
        if out.read_text()!=text:raise SystemExit('Coverage ledger is stale')
    else:out.write_text(text)
    print(json.dumps(value['totals'],ensure_ascii=False))
