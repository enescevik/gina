"""Content/profile regressions; no provider, editorial approval or publication."""
import copy
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
sys.dont_write_bytecode=True

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
v=load('validate-library-draft');p=load('prepare-library-import');ledger=load('build-library-coverage')
FOLDER=v.ROOT/'docs/learning/library-pilot/grade-6-math'

class NumbersDataDraft(unittest.TestCase):
    def setUp(self):self.data=json.loads((FOLDER/'pilot.json').read_text())
    def rejects(self,reason):
        with self.assertRaisesRegex(ValueError,reason):v.validate(self.data,FOLDER)
    def test_complete_unpublished_pool(self):
        r=v.validate(self.data,FOLDER)
        self.assertEqual((r['questions'],r['diagrams'],r['text_sources'],r['candidate_outcomes']),(20,3,1,5))
        self.assertFalse(r['human_editorial_approval']);self.assertEqual(r['published_questions'],0)
    def test_same_subject_alias_is_explicit(self):
        out=p.prepare(FOLDER);self.assertEqual(out['subject'],'Matematik')
        self.assertEqual(out['provenance']['curriculum_reference']['candidate_scenario_id'],'tr-2026-2027-t1-ilkmat2-g6-i6')
    def test_legacy_code_swap_rejected(self):
        self.data['questions'][12]['curriculum']['candidate_code']='MAT.6.1.7';self.rejects('math6_question_mapping')
    def test_no_fake_case_switch(self):
        self.data['questions'][0]['verification']['case']=2;self.rejects('math6_case_identity')
    def test_math_oracle_catches_every_wrong_numeric_result(self):
        for index in [*range(18),19]:
            with self.subTest(question=index+1):
                original=copy.deepcopy(self.data['questions'][index]['verification']['result'])
                key=next(k for k,val in original.items() if isinstance(val,str))
                self.data['questions'][index]['verification']['result'][key]='9999'
                self.rejects('math6_numeric_result')
                self.data['questions'][index]['verification']['result']=original
    def test_zero_notation_does_not_change_quantity(self):
        self.data['questions'][3]['verification']['result']['value']='47/20';self.rejects('math6_numeric_result')
    def test_repeating_fraction_is_not_truncated(self):
        self.data['questions'][5]['verification']['result']['share']='33/50';self.rejects('math6_numeric_result')
    def test_mean_uses_individual_observations(self):
        self.data['questions'][15]['verification']['result']['mean']='3/2';self.rejects('math6_numeric_result')
    def test_threshold_includes_two(self):
        self.data['questions'][17]['verification']['result']['cards']='2';self.rejects('math6_numeric_result')
    def test_stale_numeric_prose_rejected(self):
        self.data['questions'][13]['expected_answer']='Uzunluk 88 mm olur.';self.rejects('math6_answer_result')
    def test_changed_shared_data_not_silently_accepted(self):
        self.data['sources'][2]['diagram']['frequencies'][2]=5;self.rejects('math6_data_source')
    def test_source_link_cannot_be_crossed(self):
        self.data['questions'][15]['source_id']='route';self.data['questions'][15]['evidence_unit']='route';self.rejects('math6_question_source')
    def test_unknown_profile_is_not_routed_to_legacy_validator(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);self.data['technical_profile']='math_future_unreviewed'
            (folder/'pilot.json').write_text(json.dumps(self.data))
            with self.assertRaisesRegex(ValueError,'unregistered_profile'):p.prepare(folder)
    def test_approval_cannot_come_from_script(self):
        self.data['human_editorial_approval']='technical';self.rejects('draft_gate')
    def test_school_scenario_not_auto_selected(self):
        self.data['school_scenario_selection']='scenario1';self.rejects('import_gate')
    def test_wrong_source_hash_rejected(self):
        self.data['curriculum_reference']['candidate_source_sha256']='0'*64;self.rejects('curriculum_source_hash')
    def test_equivalent_stems_do_not_duplicate_pool(self):
        self.data['questions'][1]['stem']=self.data['questions'][0]['stem'];self.rejects('duplicate_prompt')
    def test_answer_hidden_in_student_projection_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder)
            f=folder/'student.json';student=json.loads(f.read_text());student['questions'][0]['rubric']=self.data['questions'][0]['rubric'];f.write_text(json.dumps(student))
            with self.assertRaisesRegex(ValueError,'student_projection'):v.validate(self.data,folder)
    def test_rendered_wrong_dot_fails_even_if_rehashed(self):
        import hashlib
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder)
            svg=folder/'assets/reading-data.svg';svg.write_text(svg.read_text().replace('data-value="2"','data-value="3"',1))
            f=folder/'assets/manifest.json';manifest=json.loads(f.read_text())
            next(m for m in manifest if m['id']=='reading-data')['svg_sha256']=hashlib.sha256(svg.read_bytes()).hexdigest();f.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'math6_rendered_frequencies'):v.validate(self.data,folder)
    def test_overlapping_dots_fail_even_if_rehashed(self):
        import hashlib
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder)
            svg=folder/'assets/reading-data.svg';svg.write_text(svg.read_text().replace('cy="305"','cy="370"',1))
            f=folder/'assets/manifest.json';manifest=json.loads(f.read_text())
            next(m for m in manifest if m['id']=='reading-data')['svg_sha256']=hashlib.sha256(svg.read_bytes()).hexdigest();f.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'math6_dot_position'):v.validate(self.data,folder)
    def test_import_preserves_source_rubric_and_student_boundary(self):
        out=p.prepare(FOLDER);self.assertEqual((len(out['questions']),len(out['sources']),len(out['assets'])),(20,4,3))
        for q,original in zip(out['questions'],self.data['questions'],strict=True):
            self.assertEqual(q['source_key'],original['source_id']);self.assertEqual(q['teacher']['rubric'],original['rubric'])
            self.assertNotIn('teacher',q['student']);self.assertNotIn('expected_answer',q['student'])
        self.assertEqual(len({q['source_key'] for q in out['questions'] if q['source_key']}),4)
    def test_counts_do_not_imply_annual_coverage_or_publication(self):
        report=ledger.build(json.loads(ledger.PLAN.read_text()),[('math6',self.data)])
        scope=next(e for e in report['entries'] if e['grade']==6 and e['subject']=='Matematik')
        self.assertEqual(scope['authored_drafts'],20);self.assertEqual(scope['published'],0)
        self.assertFalse(scope['annual_curriculum_complete'])

if __name__=='__main__':unittest.main()
