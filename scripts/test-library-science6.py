"""Scientific content/geometry regressions. Does not grant editorial approval."""
import copy,hashlib,importlib.util,json,shutil,sys,tempfile,unittest
from pathlib import Path
sys.dont_write_bytecode=True

def load(name):
 spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
v=load('validate-library-draft');p=load('prepare-library-import');ledger=load('build-library-coverage')
FOLDER=v.ROOT/'docs/learning/library-pilot/grade-6-science'
class ScienceSixDraft(unittest.TestCase):
 def setUp(self):self.data=json.loads((FOLDER/'pilot.json').read_text())
 def rejects(self,reason):
  with self.assertRaisesRegex(ValueError,reason):v.validate(self.data,FOLDER)
 def test_pool_is_unpublished_not_an_exam(self):
  r=v.validate(self.data,FOLDER);self.assertEqual((r['questions'],r['diagrams'],r['text_sources'],r['candidate_outcomes']),(20,4,1,5));self.assertEqual(r['published_questions'],0);self.assertFalse(r['human_editorial_approval'])
 def test_grade_subject_and_source_are_exact(self):
  self.data['grade']=5;self.rejects('scope')
 def test_source_hash_cannot_be_fabricated(self):
  self.data['curriculum_reference']['candidate_source_sha256']='0'*64;self.rejects('curriculum_source_hash')
 def test_curriculum_from_another_scenario_is_not_assumed(self):
  self.data['curriculum_reference']['candidate_scenario_id']='tr-2026-2027-t1-fen3_2-g6-d6';self.rejects('profile_scope')
 def test_code_cannot_move_to_another_outcome(self):
  self.data['questions'][14]['curriculum']['candidate_code']='FB.6.2.1';self.rejects('science6_mapping')
 def test_case_identity_cannot_mask_another_question(self):
  self.data['questions'][0]['verification']['case']=2;self.rejects('science6_case_identity')
 def test_wrong_force_result_in_all_numeric_cases(self):
  for index in (8,9,10,11):
   original=copy.deepcopy(self.data['questions'][index]['verification']['result']);key=next(iter(original));self.data['questions'][index]['verification']['result'][key]=999;self.rejects('science6_fact_or_result');self.data['questions'][index]['verification']['result']=original
 def test_boolean_is_not_a_numeric_result(self):
  self.data['questions'][14]['verification']['result']['same_displacement']=1;self.rejects('science6_fact_or_result')
 def test_wrong_planet_group_is_rejected(self):
  self.data['questions'][0]['verification']['result']['terrestrial'].append('Jüpiter');self.rejects('science6_fact_or_result')
 def test_wrong_shadow_target_is_rejected(self):
  self.data['questions'][4]['verification']['result']['shadow_L']='Earth';self.rejects('science6_fact_or_result')
 def test_velocity_not_conflated_with_speed(self):
  self.data['questions'][16]['verification']['result']['same_velocity']=True;self.rejects('science6_fact_or_result')
 def test_closed_trip_does_not_erase_distance(self):
  self.data['questions'][15]['verification']['result']['distance_positive']=False;self.rejects('science6_fact_or_result')
 def test_numerical_speed_and_graph_tasks_not_allowed(self):
  for field in ['numerical_speed_calculation_required','graph_reading_required']:
   self.data['questions'][14]['response'][field]=True;self.rejects('science6_speed_scope');self.data['questions'][14]['response'][field]=False
 def test_written_plan_not_mislabeled_as_performed_experiment(self):
  self.data['questions'][13]['curriculum']['evidence_scope']='experiment_completed';self.rejects('science6_experiment_scope')
 def test_stale_answer_text_rejected(self):
  self.data['questions'][8]['expected_answer']='Bileşke 10 N batıdır.';self.rejects('science6_answer_result')
 def test_mislinked_shared_source_rejected(self):
  self.data['questions'][14]['source_id']='planet-cards';self.data['questions'][14]['evidence_unit']='planet-cards';self.rejects('science6_question_source')
 def test_duplicate_stems_and_answer_dependencies_rejected(self):
  self.data['questions'][0]['depends_on_question_ids']=['g6-science-02'];self.rejects('answer_dependency')
 def test_draft_cannot_be_auto_approved_or_published(self):
  self.data['human_editorial_approval']='script';self.rejects('draft_gate')
 def test_planet_order_data_mutation_caught(self):
  self.data['sources'][0]['diagram']['rows'][2][0]='Mars';self.rejects('science6_planet_source')
 def test_changed_route_data_caught(self):
  self.data['sources'][4]['diagram']['paths'][1]=['A','B'];self.rejects('science6_route_source')
 def svg_mutation(self,asset,old,new,reason):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder);svg=folder/f'assets/{asset}.svg';body=svg.read_text();self.assertIn(old,body);svg.write_text(body.replace(old,new,1));mf=folder/'assets/manifest.json';manifest=json.loads(mf.read_text());next(m for m in manifest if m['id']==asset)['svg_sha256']=hashlib.sha256(svg.read_bytes()).hexdigest();mf.write_text(json.dumps(manifest))
   with self.assertRaisesRegex(ValueError,reason):v.validate(self.data,folder)
 def test_rendered_force_arrow_cannot_reverse_even_with_new_hash(self):self.svg_mutation('force-cards','M 450 130 L 716 130','M 450 130 L 184 130','science6_rendered_force_direction')
 def test_rendered_eclipse_cannot_swap_bodies(self):self.svg_mutation('eclipse-models','data-body="Ay"','data-body="Dünya"','science6_rendered_alignment')
 def test_rendered_route_must_match_shared_data(self):self.svg_mutation('two-routes','M 140 400 L 720 400','M 140 400 L 720 130','science6_rendered_route')
 def test_rendered_planet_label_is_checked(self):self.svg_mutation('planet-cards','>3. Dünya<','>3. Mars<','science6_rendered_planets')
 def test_student_projection_cannot_include_answer(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp)/'copy';shutil.copytree(FOLDER,folder);f=folder/'student.json';d=json.loads(f.read_text());d['questions'][0]['expected_answer']='teacher answer';f.write_text(json.dumps(d))
   with self.assertRaisesRegex(ValueError,'student_projection'):v.validate(self.data,folder)
 def test_import_preserves_shared_sources_and_private_rubrics(self):
  out=p.prepare(FOLDER);self.assertEqual((len(out['questions']),len(out['sources']),len(out['assets'])),(20,5,4))
  for q,original in zip(out['questions'],self.data['questions'],strict=True):
   self.assertEqual(q['source_key'],original['source_id']);self.assertEqual(q['teacher']['rubric'],original['rubric']);self.assertNotIn('teacher',q['student']);self.assertNotIn('expected_answer',q['student'])
 def test_coverage_counts_drafts_not_publication(self):
  r=ledger.build(json.loads(ledger.PLAN.read_text()),[('science6',self.data)]);scope=next(e for e in r['entries'] if e['grade']==6 and e['subject']=='Fen Bilimleri');self.assertEqual(scope['authored_drafts'],20);self.assertEqual(scope['approved'],0);self.assertEqual(scope['published'],0);self.assertFalse(scope['annual_curriculum_complete'])
if __name__=='__main__':unittest.main()
