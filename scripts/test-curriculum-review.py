import copy, importlib.util, json, sys, unittest
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).with_name('prepare-curriculum-review.py'))
prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)

class SourceReview(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((ROOT/'docs/learning/catalog/2026-2027-term1/scenario-candidates.json').read_text())
    def test_all_candidates_are_deterministic_and_keep_source_text(self):
        result=prepare.prepare(self.data)
        self.assertEqual(result,prepare.prepare(copy.deepcopy(self.data)))
        self.assertEqual(len(result['candidates']),648)
        for original,review in zip(self.data['scenarios'],result['candidates']):
            self.assertEqual(review['blocks'],original['blocks'])
            self.assertEqual(review['source_sha256'],original['source_sha256'])
            self.assertNotIn('status',review)
            self.assertNotIn('published',review)
    def test_all_ambiguities_remain_for_operator(self):
        result=prepare.prepare(self.data)
        flags=[r for c in result['candidates'] for r in c['review_reasons']]
        self.assertIn('wording_conflict',flags)
        self.assertIn('uncoded_source_instruction',flags)
        self.assertTrue(any(r.startswith('source_issue:') for r in flags))
        self.assertTrue(all(c['review_reasons'] for c in result['candidates']))
    def test_cannot_guess_unrecognised_exam(self):
        self.data['scenarios'][0]['exam']='Unknown exam'
        with self.assertRaisesRegex(ValueError,'exam_scope_unresolved'):prepare.prepare(self.data)
    def test_cannot_import_source_approval(self):
        self.data['scenarios'][0]['publishable']=True
        with self.assertRaisesRegex(ValueError,'review_only_input_required'):prepare.prepare(self.data)

if __name__=='__main__':unittest.main()
