"""Draft boundaries and factual regressions, never independent language approval."""
import hashlib,importlib.util,json,shutil,sys,tempfile,unittest
from pathlib import Path
sys.dont_write_bytecode=True

def load(name):
 spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
v=load('validate-library-draft');p=load('prepare-library-import');ledger=load('build-library-coverage')
FOLDER=v.ROOT/'docs/learning/library-pilot/grade-5-turkish'
class TurkishFiveDraft(unittest.TestCase):
 def setUp(self):self.data=json.loads((FOLDER/'pilot.json').read_text())
 def rejects(self,reason):
  with self.assertRaisesRegex(ValueError,reason):v.validate(self.data,FOLDER)
 def test_unpublished_pool(self):
  r=v.validate(self.data,FOLDER);self.assertEqual((r['questions'],r['diagrams'],r['text_sources'],r['candidate_outcomes']),(20,2,3,5));self.assertEqual(r['published_questions'],0)
 def test_wrong_grade(self):self.data['grade']=6;self.rejects('scope')
 def test_unknown_rubric_key_rejected_before_import(self):self.data['questions'][0]['rubric']['unexpected_policy']='x';self.rejects('rubric_shape')
 def test_source_hash_cannot_be_invented(self):self.data['curriculum_reference']['candidate_source_sha256']='0'*64;self.rejects('curriculum_source_hash')
 def test_other_scenario_not_automatically_selected(self):self.data['curriculum_reference']['candidate_scenario_id']='tr-2026-2027-t1-turkce2-g5-d6';self.rejects('profile_scope')
 def test_source_revision_requires_answer_review(self):self.data['sources'][0]['body']=self.data['sources'][0]['body'].replace('Salı','Çarşamba');self.rejects('turkish5_source_revision')
 def test_source_link_cannot_cross_passages(self):self.data['questions'][0]['source_id']='game-notice';self.data['questions'][0]['evidence_unit']='game-notice';self.rejects('turkish5_source_link')
 def test_case_identity(self):self.data['questions'][0]['verification']['case']=2;self.rejects('turkish5_case_identity')
 def test_written_output_not_reading(self):self.data['questions'][14]['curriculum']['candidate_code']='T.O.5.6';self.rejects('turkish5_mapping')
 def test_unknown_duration_not_invented(self):self.data['questions'][5]['verification']['result']['duration_given']=True;self.rejects('turkish5_fact')
 def test_boolean_not_interchangeable_with_number(self):self.data['questions'][5]['verification']['result']['duration_given']=0;self.rejects('turkish5_fact')
 def test_invisible_contents_not_empty(self):self.data['questions'][9]['verification']['result']['empty_proven']=True;self.rejects('turkish5_fact')
 def test_wrong_syllable_boundary(self):self.data['questions'][18]['verification']['result']['syllables']['arkadaşlık']=['ar','kad','aş','lık'];self.rejects('turkish5_fact')
 def test_period_not_colon_for_written_time(self):self.data['questions'][17]['verification']['result']['time']='14:30';self.rejects('turkish5_fact')
 def test_answer_text_stays_consistent(self):self.data['questions'][19]['expected_answer']='A uygundur; hecenin ortasından bölünebilir.';self.rejects('turkish5_answer_consistency')
 def test_examples_are_not_exclusive_or_exact_match(self):
  for field,value in [('example_is_exhaustive',True),('answer_matching','exact_text')]:
   original=self.data['questions'][14]['response'][field];self.data['questions'][14]['response'][field]=value;self.rejects('turkish5_open_scoring');self.data['questions'][14]['response'][field]=original
 def test_writing_requires_words_not_only_art(self):self.data['questions'][14]['response']['written_words_required']=False;self.rejects('turkish5_written_evidence')
 def test_alt_text_is_not_claimed_identical_visual_evidence(self):self.data['questions'][6]['response']['visual_alternative_affects_evidence']=False;self.rejects('turkish5_visual_accommodation')
 def test_no_previous_answer_dependency(self):self.data['questions'][1]['depends_on_question_ids']=['g5-turkish-01'];self.rejects('answer_dependency')
 def test_cannot_claim_editorial_approval(self):self.data['human_editorial_approval']='script';self.rejects('draft_gate')
 def svg_mutation(self,asset,old,new,reason):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder);svg=folder/f'assets/{asset}.svg';body=svg.read_text();self.assertIn(old,body);svg.write_text(body.replace(old,new,1));mf=folder/'assets/manifest.json';m=json.loads(mf.read_text());next(a for a in m if a['id']==asset)['svg_sha256']=hashlib.sha256(svg.read_bytes()).hexdigest();mf.write_text(json.dumps(m))
   with self.assertRaisesRegex(ValueError,reason):v.validate(self.data,folder)
 def test_poster_time_cannot_change_with_rehashed_file(self):self.svg_mutation('play-poster','>14.30<','>15.30<','turkish5_poster_text')
 def test_circle_must_be_physically_outside_not_only_labeled(self):self.svg_mutation('box-sequence','cx="505" cy="190"','cx="375" cy="190"','turkish5_piece_geometry')
 def test_closed_lid_state(self):self.svg_mutation('box-sequence','data-box="M" data-lid="closed"','data-box="M" data-lid="open"','turkish5_lid')
 def test_missing_visual_symbol(self):self.svg_mutation('play-poster','data-symbol="puzzle"','data-symbol="flower"','turkish5_poster_symbols')
 def test_student_json_rejects_private_answers(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder);f=folder/'student.json';d=json.loads(f.read_text());d['questions'][0]['rubric']=self.data['questions'][0]['rubric'];f.write_text(json.dumps(d));
   with self.assertRaisesRegex(ValueError,'student_projection'):v.validate(self.data,folder)
 def test_student_html_has_no_answers_and_has_writing_guidance(self):
  h=(FOLDER/'student.html').read_text();self.assertIn(self.data['student_instructions'],h);self.assertNotIn('Beklenen cevap',h)
  for q in self.data['questions']:self.assertNotIn(q['expected_answer'],h)
 def test_import_preserves_flexible_scoring_and_written_evidence(self):
  out=p.prepare(FOLDER);self.assertEqual((len(out['questions']),len(out['sources']),len(out['assets'])),(20,5,2))
  for a,b in zip(out['questions'],self.data['questions'],strict=True):
   self.assertEqual(a['teacher']['rubric'],b['rubric']);self.assertEqual(a['metadata']['response'],b['response']);self.assertEqual(a['source_key'],b['source_id']);self.assertNotIn('teacher',a['student'])
 def test_ledger_draft_is_not_publication_or_annual_coverage(self):
  r=ledger.build(json.loads(ledger.PLAN.read_text()),[('turkish5',self.data)]);e=next(x for x in r['entries'] if x['grade']==5 and x['subject']=='Türkçe');self.assertEqual((e['authored_drafts'],e['approved'],e['published']),(20,0,0));self.assertFalse(e['annual_curriculum_complete'])
if __name__=='__main__':unittest.main()
