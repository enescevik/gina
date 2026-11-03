import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("catalog", Path(__file__).with_name("build-curriculum-candidates.py"))
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class CandidateIndex(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "docs/learning/catalog/2026-2027-term1/scenario-candidates.json").read_text())
        self.data["scenarios"] = self.data["scenarios"][:1]

    def test_repeatable_and_keeps_every_source_cell(self):
        result = catalog.build(self.data)
        self.assertEqual(result, catalog.build(copy.deepcopy(self.data)))
        self.assertFalse(result["publishable"])
        self.assertEqual(result["scenarios"][0]["question_count"], 6)
        self.assertEqual(sum(len(v["evidence"]) for o in result["outcomes"] for v in o["wording_variants"]), 5)
        self.assertTrue(all(not o["publishable"] for o in result["outcomes"]))

    def test_duplicate_scenario_rejected(self):
        self.data["scenarios"] *= 2
        with self.assertRaisesRegex(ValueError, "duplicate_scenario"):
            catalog.build(self.data)

    def test_source_substitution_rejected(self):
        self.data["scenarios"][0]["source_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "unregistered_source"):
            catalog.build(self.data)

    def test_approval_cannot_be_inferred_or_imported(self):
        self.data["scenarios"][0]["publishable"] = True
        with self.assertRaisesRegex(ValueError, "review_only_input_required"):
            catalog.build(self.data)

    def test_wording_conflict_retains_both_versions(self):
        second = copy.deepcopy(self.data["scenarios"][0])
        second["id"] += "-other"
        second["blocks"][0]["outcomes"][0]["text"] = "Different wording, same code"
        self.data["scenarios"].append(second)
        result = catalog.build(self.data)
        self.assertEqual(result["counts"]["wording_conflicts"], 1)
        self.assertEqual(len(result["outcomes"]), 5)
        self.assertTrue(all(not s["school_selected"] for s in result["scenarios"]))

    def test_uncoded_instructions_are_not_given_invented_codes(self):
        self.data["scenarios"][0]["blocks"][0]["outcomes"][0]["code"] = None
        result = catalog.build(self.data)
        self.assertEqual(result["counts"]["uncoded_outcomes"], 1)
        self.assertIn("uncoded_source_instruction", next(o for o in result["outcomes"] if o["code"] is None)["review_reasons"])

    def test_shared_block_does_not_multiply_question_count(self):
        scenario = self.data["scenarios"][0]
        scenario["blocks"][0]["outcomes"].append(copy.deepcopy(scenario["blocks"][1]["outcomes"][0]))
        scenario["warnings"] = ["ambiguous_count:C12"]
        result = catalog.build(self.data)
        self.assertEqual(result["scenarios"][0]["question_count"], 6)
        self.assertEqual(result["counts"]["warning_scenarios"], 1)
        self.assertEqual(result["scenarios"][0]["source_warnings"], scenario["warnings"])

    def test_count_mismatch_rejected(self):
        self.data["scenarios"][0]["question_count"] += 1
        with self.assertRaisesRegex(ValueError, "question_count_mismatch"):
            catalog.build(self.data)

    def test_committed_index_matches_all_candidates(self):
        folder = ROOT / "docs/learning/catalog/2026-2027-term1"
        result = catalog.build(json.loads((folder / "scenario-candidates.json").read_text()))
        self.assertEqual(result, json.loads((folder / "outcome-index.json").read_text()))
        self.assertEqual(result["counts"]["scenario_candidates"], 648)
        self.assertEqual(result["counts"]["grade_subject_pairs"], 62)
        self.assertEqual(result["counts"]["warning_scenarios"], 17)


if __name__ == "__main__":
    unittest.main()
