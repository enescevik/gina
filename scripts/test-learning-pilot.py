import copy
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('pilot',Path(__file__).with_name('validate-learning-pilot.py'))
pilot=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class LearningPilot(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((pilot.FOLDER/'pilot.json').read_text())

    def rejects(self,reason):
        with self.assertRaisesRegex(ValueError,reason):
            pilot.validate(self.data)

    def test_complete_draft_geometry_rubrics_and_student_projection(self):
        result=pilot.validate(self.data)
        self.assertEqual(result['questions'],20)
        self.assertEqual(result['diagrams'],8)
        self.assertEqual(result['candidate_outcomes'],7)
        self.assertEqual(result['published_questions'],0)

    def test_no_silent_publication(self):
        self.data['publishable']=True
        self.rejects('draft_gate')

    def test_no_automatic_school_scenario_selection(self):
        self.data['school_scenario_selection']='scenario-1'
        self.rejects('import_gate')

    def test_missing_common_source_rejected(self):
        self.data['questions'][0]['source_id']='missing'
        self.rejects('missing_source')

    def test_duplicate_question_id_rejected(self):
        self.data['questions'][1]['id']=self.data['questions'][0]['id']
        self.rejects('question_count_or_duplicate')

    def test_mismatched_grade_rejected(self):
        self.data['questions'][0]['grade']=6
        self.rejects('scope')

    def test_invented_outcome_code_rejected(self):
        self.data['questions'][0]['curriculum']['candidate_code']='MAT.5.99.1'
        self.rejects('curriculum_mapping')

    def test_source_revision_substitution_rejected(self):
        self.data['curriculum_reference']['candidate_source_sha256']='0'*64
        self.rejects('curriculum_source_hash')

    def test_missing_answer_rejected(self):
        self.data['questions'][0]['expected_answer']=' '
        self.rejects('missing_expected_answer')

    def test_rubric_total_checked(self):
        self.data['questions'][0]['rubric']['criteria'][0]['points']=3
        self.rejects('rubric_total')

    def test_angle_arithmetic_checked(self):
        self.data['questions'][7]['verification']['expected_degrees']=140
        self.rejects('supplement_answer')

    def test_circle_variant_cannot_use_base_diagram(self):
        self.data['questions'][17]['source_id']='circles'
        self.rejects('circle_source_mismatch')

    def test_circle_triangle_class_checked(self):
        self.data['questions'][19]['verification']['expected_class']='eşkenar'
        self.rejects('triangle_class')

    def test_wrong_triangle_angle_checked(self):
        self.data['questions'][14]['verification']['expected_degrees']=80
        self.rejects('triangle_answer')

    def test_previous_answer_dependency_not_allowed(self):
        self.data['questions'][4]['depends_on_question_ids']=[self.data['questions'][3]['id']]
        self.rejects('answer_dependency')

    def test_tampered_student_answer_key_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'pilot';shutil.copytree(pilot.FOLDER,target)
            p=target/'student.json';d=json.loads(p.read_text())
            d['questions'][0]['expected_answer']='teacher only'
            p.write_text(json.dumps(d))
            with self.assertRaisesRegex(ValueError,'student_projection'):
                pilot.validate(self.data,target)

    def test_asset_bytes_are_pinned(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'pilot';shutil.copytree(pilot.FOLDER,target)
            p=target/'assets/protractor.svg';p.write_text(p.read_text().replace('50','51'))
            with self.assertRaisesRegex(ValueError,'asset_hash'):
                pilot.validate(self.data,target)

    def test_asset_path_cannot_escape_package(self):
        with self.assertRaisesRegex(ValueError,'asset_path'):
            pilot.safe_file(pilot.FOLDER,'../../../../IMPLEMENTATION-PLAN.md')


if __name__=='__main__':
    unittest.main()
