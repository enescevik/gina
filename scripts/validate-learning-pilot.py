#!/usr/bin/env python3
"""Offline technical checks for the original draft pool. Not editorial approval."""
import hashlib
import html
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / 'docs/learning/library-pilot/grade-5-math'
NS = {'s': 'http://www.w3.org/2000/svg'}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def safe_file(root, relative):
    result = (root / relative).resolve()
    require(result.is_relative_to(root.resolve()) and result.is_file(), 'asset_path')
    return result


def check_math(q, sources):
    v = q['verification']
    kind = v['type']
    if kind == 'angle_read':
        require(v['expected_degrees'] == sources[q['source_id']]['diagram']['angle'], 'angle_answer')
    elif kind == 'vertical_angle':
        require(v['given_degrees'] == sources[q['source_id']]['diagram']['angle'] == v['expected_degrees'], 'vertical_answer')
    elif kind == 'supplement':
        require(v['given_degrees'] == sources[q['source_id']]['diagram']['angle'], 'source_angle')
        require(v['given_degrees'] + v['expected_degrees'] == 180, 'supplement_answer')
    elif kind == 'perpendicular':
        require(v['expected_degrees'] == [90] * 4, 'perpendicular_answer')
    elif kind == 'close_path':
        require(v['existing_segments'] + v['added_segments'] == v['expected_sides'] == 4, 'polygon_answer')
    elif kind == 'polygon_selection':
        require(v['expected_labels'] == ['B', 'D'], 'polygon_selection')
    elif kind == 'regular_rectangle':
        d = sources[q['source_id']]['diagram']
        require(d['rectangle_width'] != d['rectangle_height'] and v['expected_label'] == 'ABCD', 'regular_answer')
    elif kind in ('triangle_angle', 'triangle_impossible'):
        remaining = 180 - sum(v['given_degrees'])
        require(remaining == v.get('expected_degrees', v.get('remaining_degrees')), 'triangle_answer')
        require(remaining > 0 if kind == 'triangle_angle' else remaining <= 0, 'triangle_validity')
    elif kind == 'circle_triangle':
        a,b = v['radii']; d = v['distance']
        require(abs(a-b) < d < a+b, 'circles_must_intersect_twice')
        diagram = sources[q['source_id']]['diagram']
        require([a,b,d] == [diagram['radius_a'],diagram['radius_b'],diagram['distance']], 'circle_source_mismatch')
        require(v['expected_sides'] == [a,b,d], 'circle_sides')
        expected = {1:'eşkenar',2:'ikizkenar',3:'çeşitkenar'}[len(set([a,b,d]))]
        require(v['expected_class'] == expected, 'triangle_class')
    else:
        require(kind == 'editorial_reasoning', 'unknown_check')


def validate(data, folder=FOLDER):
    require(data['schema'] == 'gina.learning-library-pilot.v1', 'schema')
    require(data['status'] == 'draft' and data['publishable'] is False and data['human_editorial_approval'] is None, 'draft_gate')
    require(data['delivery']['automatic_import'] is False and data['school_scenario_selection'] is None, 'import_gate')
    questions = data['questions']; sources = {s['id']:s for s in data['sources']}
    require(len(sources) == len(data['sources']), 'duplicate_source')
    require(len(questions) == 20 and len({q['id'] for q in questions}) == 20, 'question_count_or_duplicate')
    require(len({q['stem'] for q in questions}) == 20, 'duplicate_prompt')
    candidates = json.loads((ROOT/'docs/learning/catalog/2026-2027-term1/scenario-candidates.json').read_text())
    scenario = next(s for s in candidates['scenarios'] if s['id']==data['curriculum_reference']['candidate_scenario_id'])
    require(scenario['source_sha256'] == data['curriculum_reference']['candidate_source_sha256'], 'curriculum_source_hash')
    codes = {o['code'] for b in scenario['blocks'] for o in b['outcomes']}
    used_codes = set()
    for q in questions:
        require(q['grade']==data['grade']==5 and q['subject']==data['subject']=='Matematik', 'scope')
        code=q['curriculum']['candidate_code']; used_codes.add(code)
        require(code in codes and q['curriculum']['mapping_status']=='proposed_pending_subject_review', 'curriculum_mapping')
        require(q['publishable'] is False and q['review_status']=='pending_editorial_review', 'question_draft_gate')
        require(q['source_id'] is None or q['source_id'] in sources, 'missing_source')
        require(q['kind']=='open_ended' and q['choices']==[] and q['correct_key'] is None, 'question_kind')
        for field in ['stem','expected_answer','solution','explanation','next_step','common_misconception']:
            require(isinstance(q[field],str) and bool(q[field].strip()), 'missing_'+field)
        require(q['depends_on_question_ids']==[], 'answer_dependency')
        require(q['difficulty'] in ('kolay','orta','orta_ustu','zor') and q['difficulty_calibration']=='editorial_estimate_not_empirical', 'difficulty')
        require(not q['response']['precise_screen_measurement_required'], 'screen_measurement')
        rubric=q['rubric']; criteria=rubric['criteria']
        require(len({c['id'] for c in criteria})==len(criteria) and len(criteria)>=2, 'rubric_ids')
        require(all(type(c['points']) is int and c['points']>0 and c['criterion'].strip() for c in criteria), 'rubric_criterion')
        require(sum(c['points'] for c in criteria)==rubric['max_points']==4 and rubric['review_required'], 'rubric_total')
        check_math(q,sources)
    require(used_codes==codes, 'outcome_coverage')
    manifest=json.loads((folder/'assets/manifest.json').read_text())
    require({m['id'] for m in manifest}==set(sources), 'asset_manifest_coverage')
    for m in manifest:
        s=sources[m['id']]
        require(m['png']==s['image'] and m['svg']==s['svg'] and m['geometry']==s['diagram'], 'asset_identity')
        for field,hash_field in [('png','sha256'),('svg','svg_sha256')]:
            require(hashlib.sha256(safe_file(folder,m[field]).read_bytes()).hexdigest()==m[hash_field], 'asset_hash')
        png=safe_file(folder,m['png']).read_bytes()
        require(png[:8]==b'\x89PNG\r\n\x1a\n' and int.from_bytes(png[16:20],'big')==m['width'] and int.from_bytes(png[20:24],'big')==m['height'], 'png_dimensions')
        svg=ET.fromstring(safe_file(folder,m['svg']).read_text())
        require(svg.find('s:desc',NS).text==s['alt'] and s['alt'].strip(), 'alt_text')
        require(not any(e.tag.split('}')[-1] in ('script','foreignObject','image','use') for e in svg.iter()), 'svg_external_content')
        require(not any(k.lower().startswith('on') or k.split('}')[-1]=='href' for e in svg.iter() for k in e.attrib), 'svg_active_content')
        if s['diagram']['type']=='circles':
            cs=svg.findall('s:circle',NS)[:2]
            ax,bx=[float(c.attrib['cx']) for c in cs]; ra,rb=[float(c.attrib['r']) for c in cs]
            d=s['diagram']; scale=ra/d['radius_a']
            require(math.isclose(rb/scale,d['radius_b']) and math.isclose((bx-ax)/scale,d['distance']), 'rendered_circle_dimensions')
            tri=svg.find("s:polyline[@id='triangle']",NS)
            pts=[tuple(map(float,p.split(','))) for p in tri.attrib['points'].split()]
            require(math.isclose(math.dist(pts[0],pts[2])/scale,d['radius_a']) and math.isclose(math.dist(pts[1],pts[2])/scale,d['radius_b']), 'rendered_triangle_geometry')
        if s['diagram']['type']=='protractor':
            rays=svg.find("s:g[@id='angle-rays']",NS).findall('s:line',NS)
            a=rays[1].attrib
            angle=math.degrees(math.atan2(float(a['y1'])-float(a['y2']),float(a['x2'])-float(a['x1'])))
            require(math.isclose(angle,s['diagram']['angle']), 'rendered_angle')
    student=json.loads((folder/'student.json').read_text())
    require(set(student)=={'id','title','status','publishable','grade','subject','sources','questions'}, 'student_bundle_fields')
    require(student['publishable'] is False and student['status']=='draft', 'student_draft_gate')
    expected=[{'id':q['id'],'stem':q['stem'],'source_id':q['source_id'],'response_mode':q['response']['mode']} for q in questions]
    require(student['questions']==expected, 'student_projection')
    expected_sources=[{key:s[key] for key in ('id','title','body','image','alt','minimum_reading_width')} for s in data['sources']]
    require(student['sources']==expected_sources, 'student_source_projection')
    student_html=(folder/'student.html').read_text()
    review_html=(folder/'review.html').read_text()
    require('<script' not in student_html and 'Beklenen cevap' not in student_html and 'Puan ölçütleri' not in student_html, 'student_html_answers')
    for q in questions:
        require(html.escape(q['expected_answer'], quote=True) in review_html and html.escape(q['solution'], quote=True) in review_html, 'review_answer_stale')
        require(all(html.escape(c['criterion'], quote=True) in review_html for c in q['rubric']['criteria']), 'review_rubric_stale')
        require(q['solution'] not in student_html and q['expected_answer'] not in student_html, 'student_answer_leak')
    return {'questions':len(questions),'diagrams':len(manifest),'candidate_outcomes':len(used_codes),'max_points_per_question':4,'human_editorial_approval':False,'published_questions':0}


if __name__=='__main__':
    print(json.dumps(validate(json.loads((FOLDER/'pilot.json').read_text())),ensure_ascii=False,indent=2))
