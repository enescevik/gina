#!/usr/bin/env python3
"""Prepare a portable, unpublished pilot bundle. No network, login or database writes."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
import uuid
import sys
from pathlib import Path

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('pilot',Path(__file__).with_name('validate-learning-pilot.py'))
pilot=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


def prepare(folder):
    data=json.loads((folder/'pilot.json').read_text())
    pilot.validate(data,folder)
    manifest={m['id']:m for m in json.loads((folder/'assets/manifest.json').read_text())}
    assets=[]
    sources=[]
    for s in data['sources']:
        m=manifest[s['id']]
        raw=pilot.safe_file(folder,s['image']).read_bytes()
        assets.append({'key':s['id'],'mime':'image/png','sha256':hashlib.sha256(raw).hexdigest(),
            'width':m['width'],'height':m['height'],'base64':base64.b64encode(raw).decode('ascii')})
        sources.append({'key':s['id'],'title':s['title'],'body':s['body'],'alt':s['alt'],
            'asset_key':s['id'],'minimum_reading_width':s['minimum_reading_width'],
            'provenance':{'origin':s['origin'],'svg_sha256':m['svg_sha256'],'color_space':m['color_space']}})
    questions=[]
    for q in data['questions']:
        questions.append({'key':q['id'],'revision':q['revision'],'source_key':q['source_id'],
            'student':{k:q[k] for k in ('grade','subject','topic','kind','difficulty','stem','choices')},
            'teacher':{k:q[k] for k in ('correct_key','expected_answer','solution','explanation','rubric','common_misconception','next_step')},
            'metadata':{k:q[k] for k in ('curriculum','response','evidence_unit','depends_on_question_ids','provenance','difficulty_calibration')}})
    # This preparer deliberately emits only the first reviewed-format draft.
    # Later versions require an explicit server previous_hash and revised question numbers.
    if data['revision']!=1 or any(q['revision']!=1 for q in data['questions']):
        raise ValueError('first_revision_preparer_only')
    return {'schema':'gina.library-import.v1','package_key':data['id'],'revision':1,'previous_hash':None,
        'title':data['title'],'grade':data['grade'],'subject':data['subject'],
        'provenance':{k:data[k] for k in ('locale','curriculum_reference','programme_version','school_track_applicability','assessment_notes')},
        'assets':assets,'sources':sources,'questions':questions}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder',type=Path,default=pilot.FOLDER)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    result=prepare(args.folder)
    # Exclusive creation avoids replacing an operator's queued payload/retry file.
    request={'p_request_id':str(uuid.uuid4()),'p_bundle':result}
    with open(args.output,'x',opener=lambda name,flags:os.open(name,flags,0o600)) as f:
        json.dump(request,f,ensure_ascii=False,separators=(',',':'))
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    print(f"Prepared {len(result['questions'])} draft questions and {len(result['assets'])} PNGs with a durable request ID; no import or publication.")
