#!/usr/bin/env python3
"""Technical acceptance for registered draft profiles; never editorial approval."""
import hashlib
import html
import json
import math
import re
from collections import Counter
import library_math6_checks as math6
import library_science6_checks as science6
import library_turkish5_checks as turkish5
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'docs/learning/library-pilot/grade-5-science'
NS={'s':'http://www.w3.org/2000/svg'}
PROFILES={
    'science_sky_v1':(5,'Fen Bilimleri',{'FB.5.1.2','FB.5.1.3','FB.5.1.4'}),
    'math_numbers_data_v1':(6,'Matematik',math6.CODES),
    'science_space_motion_v1':(6,'Fen Bilimleri',science6.CODES),
    'turkish_reading_writing_v1':(5,'Türkçe',turkish5.CODES),
}

def require(ok,reason):
    if not ok: raise ValueError(reason)

def safe_file(root,relative):
    require(isinstance(relative,str),'asset_path')
    f=(root/relative).resolve()
    require(f.is_relative_to(root.resolve()) and f.is_file(),'asset_path')
    return f

def validate(data,folder=FOLDER):
    require(data['schema']=='gina.learning-library-pilot.v1','schema')
    profile=data.get('technical_profile')
    require(profile in PROFILES,'unregistered_profile')
    require(data['status']=='draft' and data['publishable'] is False and data['human_editorial_approval'] is None,'draft_gate')
    require(data['school_scenario_selection'] is None and data['delivery']['automatic_import'] is False,'import_gate')
    grade,subject,profile_codes=PROFILES[profile]
    scope=(grade,subject)
    require((data['grade'],data['subject'])==scope,'scope')
    ref=data['curriculum_reference']
    scenarios=json.loads((ROOT/'docs/learning/catalog/2026-2027-term1/scenario-candidates.json').read_text())
    candidate=next((s for s in scenarios['scenarios'] if s['id']==ref['candidate_scenario_id']),None)
    require(candidate is not None and candidate['source_sha256']==ref['candidate_source_sha256'],'curriculum_source_hash')
    candidate_subject='Matematik' if candidate['subject']=='İlköğretim Matematik' else candidate['subject']
    require((candidate['grade'],candidate_subject)==(data['grade'],data['subject']),'curriculum_scope')
    codes={o['code'] for b in candidate['blocks'] for o in b['outcomes']}
    require(codes==profile_codes,'profile_scope')
    questions=data['questions'];sources={s['id']:s for s in data['sources']}
    require(len(questions)==20 and len({q['id'] for q in questions})==20,'question_count_or_duplicate')
    require(len({q['stem'].strip() for q in questions})==20,'duplicate_prompt')
    require(len(sources)==len(data['sources']),'duplicate_source')
    counts=Counter(q['source_id'] for q in questions if q['source_id'])
    require(all(1<=counts[s]<=12 for s in sources),'source_unit_limit')
    seen=set()
    for q in questions:
        require(q['grade']==data['grade'] and q['subject']==data['subject'],'scope')
        require(re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,99}',q['id']) and q['revision']==1,'question_key')
        code=q['curriculum']['candidate_code'];seen.add(code)
        require(code in codes and q['curriculum']['mapping_status']=='proposed_pending_subject_review','curriculum_mapping')
        require(q['publishable'] is False and q['review_status']=='pending_editorial_review','question_draft_gate')
        require(q['kind']=='open_ended' and q['choices']==[] and q['correct_key'] is None,'question_kind')
        require(q['depends_on_question_ids']==[],'answer_dependency')
        require(q['source_id'] is None or q['source_id'] in sources,'missing_source')
        require(q['evidence_unit']==(q['source_id'] or 'question-'+q['id'][-2:]),'evidence_unit')
        require(q['difficulty'] in ('kolay','orta','orta_ustu','zor') and q['difficulty_calibration']=='editorial_estimate_not_empirical','difficulty')
        require(q['response']['precise_screen_measurement_required'] is False and q['response']['mode']=='text_or_drawing','response_mode')
        for field,limit in [('stem',3500),('expected_answer',10000),('solution',10000),('explanation',4000),('common_misconception',2000),('next_step',2000)]:
            require(isinstance(q[field],str) and 1<=len(q[field].strip())<=limit,'missing_or_long_'+field)
        rubric=q['rubric'];criteria=rubric['criteria']
        require(set(rubric)=={'max_points','scoring','criteria','missing_answer','review_required'} and all(set(c)=={'id','points','criterion'} for c in criteria),'rubric_shape')
        require(len(criteria)==len({c['id'] for c in criteria})==4,'rubric_ids')
        require(all(type(c['points']) is int and c['points']==1 and c['criterion'].strip() for c in criteria),'rubric_criterion')
        require(sum(c['points'] for c in criteria)==rubric['max_points']==4 and rubric['review_required'] is True,'rubric_total')
        v=q['verification'];kind=v['type']
        if profile=='turkish_reading_writing_v1':turkish5.check_question(q,sources)
        elif profile=='science_space_motion_v1':science6.check_question(q,sources)
        elif profile=='math_numbers_data_v1':math6.check_question(q,sources)
        elif kind=='synchronous_rotation':require(v['turns_per_orbit']==1,'rotation_answer')
        elif kind=='period_comparison':require(v['rotation_days']==v['orbit_days']==27.3 and v['phase_days']==29.5,'period_answer')
        elif kind=='phase_order':require(v['expected']==['new','first','full','last'],'phase_answer')
        elif kind=='cycle_prediction':require(v['after']=='last' and v['next']==['new','first','full'],'cycle_answer')
        elif kind=='position_phase':require(v['new']=='K' and v['full']=='M','position_answer')
        elif kind=='lighting_side':require(v['expected']=='left','lighting_answer')
        elif kind=='size_order':require(v['expected']==['Sun','Earth','Moon'],'size_answer')
        else:require(kind=='editorial_reasoning','unknown_check')
    require(seen==codes,'outcome_coverage')
    manifest=json.loads((folder/'assets/manifest.json').read_text())
    require(len(manifest)==len({m['id'] for m in manifest}),'duplicate_asset')
    require({m['id'] for m in manifest}=={s['id'] for s in sources.values() if s['image']},'asset_manifest_coverage')
    for s in sources.values():
        require(1<=len(s['title'])<=160 and len(s['body'])<=6000,'source_size')
        require(type(s['minimum_reading_width']) is int and 0<=s['minimum_reading_width']<=1600,'reading_width')
        if not s['image']:require(s['svg'] is None and s['diagram'] is None and s['body'].strip(),'text_source')
    total=0
    for m in manifest:
        s=sources[m['id']];d=s['diagram']
        require(m['png']==s['image'] and m['svg']==s['svg'] and m['geometry']==d,'asset_identity')
        for field,hashfield in [('png','sha256'),('svg','svg_sha256')]:
            require(hashlib.sha256(safe_file(folder,m[field]).read_bytes()).hexdigest()==m[hashfield],'asset_hash')
        png=safe_file(folder,m['png']).read_bytes();total+=len(png)
        require(len(png)<=512*1024 and png[:8]==b'\x89PNG\r\n\x1a\n','png_size')
        require(int.from_bytes(png[16:20],'big')==m['width'] and int.from_bytes(png[20:24],'big')==m['height'] and m['width']*m['height']<=4000000,'png_dimensions')
        svg=ET.fromstring(safe_file(folder,m['svg']).read_text())
        require(svg.find('s:desc',NS).text==s['alt'] and s['alt'].strip(),'alt_text')
        require(not any(e.tag.split('}')[-1] in ('script','foreignObject','image','use') for e in svg.iter()),'svg_external_content')
        require(not any(k.lower().startswith('on') or k.split('}')[-1]=='href' for e in svg.iter() for k in e.attrib),'svg_active_content')
        if profile=='turkish_reading_writing_v1':turkish5.check_diagram(d,svg,NS)
        elif profile=='science_space_motion_v1':science6.check_diagram(d,svg,NS)
        elif profile=='math_numbers_data_v1':math6.check_diagram(d,svg,NS)
        elif d['type']=='same_face':
            center=d['center'];directions=[]
            for i,pos in enumerate(d['positions']):
                dot=svg.find(f"s:circle[@data-marker='{i+1}']",NS);vector=[center[j]-pos[j] for j in (0,1)];norm=math.hypot(*vector)
                expected=[pos[j]+vector[j]/norm*d['marker_offset'] for j in (0,1)]
                require(all(math.isclose(float(dot.attrib[attr]),expected[j]) for j,attr in enumerate(['cx','cy'])),'rendered_marker')
                directions.append(round(math.degrees(math.atan2(vector[1],vector[0]))%360))
            require(directions==[90,0,270,180],'rotation_geometry')
        elif d['type']=='phase_cards':
            require(d['cards']==['new','first','full','last'],'phase_geometry')
            require([c.attrib['data-phase'] for c in svg.findall('s:circle',NS) if 'data-phase' in c.attrib]==d['cards'],'rendered_phases')
            require(len([p for p in svg.findall('s:path',NS) if 'A 75 75 0 0 1' in p.attrib['d']])==1 and len([p for p in svg.findall('s:path',NS) if 'A 75 75 0 0 0' in p.attrib['d']])==1,'rendered_half_sides')
        elif d['type']=='lighting':
            require(d['illuminated_side']=='left' and d['sun'][0]<d['positions']['K'][0]<d['center'][0]<d['positions']['M'][0],'lighting_geometry')
            require(len([p for p in svg.findall('s:path',NS) if 'A 38 38 0 0 0' in p.attrib['d']])==4,'rendered_lighting')
        elif d['type']=='sizes':
            require(d['radii'][0]>d['radii'][1]>d['radii'][2]>0,'size_geometry')
            require([float(svg.find(f"s:circle[@data-size='{label}']",NS).attrib['r']) for label in 'ABC']==d['radii'],'rendered_sizes')
        else:raise ValueError('unregistered_diagram')
    require(total<=3000000,'package_media_size')
    student=json.loads((folder/'student.json').read_text())
    expected={k:data[k] for k in ['id','title','status','publishable','grade','subject']}
    expected['sources']=[{k:s[k] for k in ['id','title','body','image','alt','minimum_reading_width']} for s in data['sources']]
    expected['questions']=[{'id':q['id'],'stem':q['stem'],'source_id':q['source_id'],'response_mode':q['response']['mode']} for q in questions]
    require(student==expected,'student_projection')
    student_html=(folder/'student.html').read_text();review_html=(folder/'review.html').read_text()
    require('<script' not in student_html and 'Beklenen cevap' not in student_html and 'Puan ölçütleri' not in student_html,'student_html_answers')
    for q in questions:
        require(html.escape(q['stem'],quote=True) in student_html,'student_html_stale')
        for field in ['expected_answer','solution','next_step']:
            require(html.escape(q[field],quote=True) in review_html,'review_answer_stale')
        require(all(html.escape(c['criterion'],quote=True) in review_html for c in q['rubric']['criteria']),'review_rubric_stale')
        require(q['expected_answer'] not in student_html and q['solution'] not in student_html,'student_answer_leak')
    return {'questions':len(questions),'diagrams':len(manifest),'text_sources':sum(not s['image'] for s in sources.values()),'candidate_outcomes':len(seen),'published_questions':0,'human_editorial_approval':False}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--folder',type=Path,default=FOLDER);args=parser.parse_args()
    print(json.dumps(validate(json.loads((args.folder/'pilot.json').read_text()),args.folder),ensure_ascii=False,indent=2))
