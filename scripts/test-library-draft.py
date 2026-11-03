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
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
v=load('validate-library-draft');p=load('prepare-library-import');ledger=load('build-library-coverage')

class DraftPool(unittest.TestCase):
    def setUp(self):self.data=json.loads((v.FOLDER/'pilot.json').read_text())
    def rejects(self,reason):
        with self.assertRaisesRegex(ValueError,reason):v.validate(self.data)
    def test_complete_pool(self):
        r=v.validate(self.data);self.assertEqual((r['questions'],r['diagrams'],r['text_sources']),(20,4,2));self.assertEqual(r['published_questions'],0)
    def test_no_approval_inference(self):
        self.data['human_editorial_approval']={'reviewer':'technical test'};self.rejects('draft_gate')
    def test_no_automatic_scenario(self):
        self.data['school_scenario_selection']='senaryo2';self.rejects('import_gate')
    def test_wrong_source_revision(self):
        self.data['curriculum_reference']['candidate_source_sha256']='0'*64;self.rejects('curriculum_source_hash')
    def test_no_invented_outcome(self):
        self.data['questions'][0]['curriculum']['candidate_code']='FB.5.99';self.rejects('curriculum_mapping')
    def test_older_code_not_silently_accepted(self):
        self.data['questions'][0]['curriculum']['candidate_code']='FB.5.1.2.1';self.rejects('curriculum_mapping')
    def test_no_duplicates(self):
        self.data['questions'][1]['id']=self.data['questions'][0]['id'];self.rejects('question_count_or_duplicate')
    def test_group_above_delivery_limit_rejected(self):
        for q in self.data['questions'][:13]:q['source_id']='same-face'
        self.rejects('source_unit_limit')
    def test_empty_teacher_answer_rejected(self):
        self.data['questions'][0]['expected_answer']=' '
        self.rejects('missing_or_long_expected_answer')
    def test_rubric_total(self):
        self.data['questions'][0]['rubric']['max_points']=5;self.rejects('rubric_total')
    def test_periods_are_distinct(self):
        self.data['questions'][2]['verification']['phase_days']=27.3;self.rejects('period_answer')
    def test_model_rotation(self):
        self.data['questions'][0]['verification']['turns_per_orbit']=0;self.rejects('rotation_answer')
    def test_lighting(self):
        self.data['questions'][13]['verification']['expected']='right';self.rejects('lighting_answer')
    def test_no_prior_answer_dependency(self):
        self.data['questions'][1]['depends_on_question_ids']=[self.data['questions'][0]['id']];self.rejects('answer_dependency')
    def test_stale_student_and_hidden_answer_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'draft';shutil.copytree(v.FOLDER,root)
            f=root/'student.json';d=json.loads(f.read_text());d['questions'][0]['expected_answer']='secret';f.write_text(json.dumps(d))
            with self.assertRaisesRegex(ValueError,'student_projection'):v.validate(self.data,root)
    def test_tampered_image_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'draft';shutil.copytree(v.FOLDER,root);f=root/'assets/sizes.png';f.write_bytes(f.read_bytes()+b'bad')
            with self.assertRaisesRegex(ValueError,'asset_hash'):v.validate(self.data,root)
    def test_outside_path_rejected(self):
        with self.assertRaisesRegex(ValueError,'asset_path'):v.safe_file(v.FOLDER,'../grade-5-math/pilot.json')
    def test_text_and_image_imports_preserve_identity(self):
        out=p.prepare(v.FOLDER);self.assertEqual((len(out['sources']),len(out['assets']),len(out['questions'])),(6,4,20))
        self.assertIsNone(next(s for s in out['sources'] if s['key']=='periods')['asset_key'])
        for q,src in zip(out['questions'],self.data['questions']):
            self.assertEqual(q['teacher']['rubric'],src['rubric']);self.assertEqual(q['source_key'],src['source_id'])
            self.assertNotIn('expected_answer',q['student'])
    def test_coverage_not_approval(self):
        c=ledger.build(json.loads(ledger.PLAN.read_text()),[('fixture',self.data)])
        self.assertEqual(c['totals']['authored_drafts'],20);self.assertEqual(c['totals']['published'],0)
        self.assertEqual(c['totals']['remaining_drafts'],c['totals']['target']-20)
    def test_duplicate_packages_do_not_inflate_coverage(self):
        with self.assertRaisesRegex(ValueError,'duplicate_package'):
            ledger.build(json.loads(ledger.PLAN.read_text()),[('one',self.data),('two',copy.deepcopy(self.data))])

if __name__=='__main__':unittest.main()
