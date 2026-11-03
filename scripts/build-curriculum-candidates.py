#!/usr/bin/env python3
"""Build a review-only outcome index. Never infer approval, school choice or coverage.

Reads the extracted JSON, not spreadsheets. Keeps source cells, wording variants,
uncoded instructions and scenario warnings. No database/network/publish operation.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def stable_id(prefix, value):
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return prefix + hashlib.sha256(raw.encode()).hexdigest()[:24]


def build(data):
    if data.get("schema") != "gina.meb-scenario-candidates.v1":
        raise ValueError("unsupported_schema")
    if not data.get("not_a_complete_curriculum") or not data.get("school_scenario_selection_required"):
        raise ValueError("scope_flags_required")
    sources = {}
    for source in data["sources"]:
        key = (source["resolved_url"], source["sha256"])
        if not re.fullmatch(r"[a-f0-9]{64}", key[1]) or key in sources:
            raise ValueError("invalid_source")
        sources[key] = source
    groups, outcomes, scenarios, seen = {}, {}, [], set()
    for scenario in data["scenarios"]:
        sid = scenario["id"]
        if sid in seen:
            raise ValueError("duplicate_scenario")
        seen.add(sid)
        grade, subject = scenario["grade"], scenario["subject"]
        if type(grade) is not int or not 1 <= grade <= 12 or not subject.strip():
            raise ValueError("invalid_scope")
        if (scenario["source_url"], scenario["source_sha256"]) not in sources:
            raise ValueError("unregistered_source")
        if scenario["publishable"] is not False or scenario["review_status"] != "pending_source_review":
            raise ValueError("review_only_input_required")
        scope = [data["academic_year"], data["term"], grade, subject]
        gid = stable_id("scope-", scope)
        group = groups.setdefault(gid, {"id": gid, "grade": grade, "subject": subject,
            "scenario_ids": [], "outcome_ids": set()})
        group["scenario_ids"].append(sid)
        blocks = []
        for block in scenario["blocks"]:
            if type(block["count"]) is not int or block["count"] < 1 or not block["outcomes"]:
                raise ValueError("invalid_count_block")
            ids = []
            for item in block["outcomes"]:
                code, wording = item.get("code"), item["text"].strip()
                if not wording or not re.fullmatch(r"[A-Z]+[1-9][0-9]*", item["cell"]):
                    raise ValueError("invalid_outcome_evidence")
                # Uncoded source instructions remain distinct, without invented codes.
                identity = [code] if code else [None, scenario["source_sha256"], scenario["sheet"], item["cell"]]
                oid = stable_id("outcome-", scope + identity)
                outcome = outcomes.setdefault(oid, {"id": oid, "scope_id": gid, "code": code,
                    "wording_variants": {}, "review_status": "pending_source_review", "publishable": False})
                variant = outcome["wording_variants"].setdefault(wording, [])
                evidence = {"scenario_id": sid, "url": scenario["source_url"],
                    "sha256": scenario["source_sha256"], "sheet": scenario["sheet"],
                    "cell": item["cell"], "count_cell": block["count_cell"]}
                if evidence not in variant:
                    variant.append(evidence)
                ids.append(oid)
                group["outcome_ids"].add(oid)
            # A block may cover several outcomes; never multiply its question count.
            blocks.append({"count": block["count"], "count_cell": block["count_cell"], "outcome_ids": ids})
        if sum(b["count"] for b in blocks) != scenario["question_count"]:
            raise ValueError("question_count_mismatch")
        scenarios.append({"id": sid, "scope_id": gid, "label": scenario["scenario"],
            "exam": scenario["exam"], "question_count": scenario["question_count"], "blocks": blocks,
            "source_url": scenario["source_url"], "source_sha256": scenario["source_sha256"],
            "sheet": scenario["sheet"], "header_cell": scenario["header_cell"],
            "source_warnings": scenario["warnings"], "review_status": "pending_source_review",
            "publishable": False, "school_selected": False})
    for outcome in outcomes.values():
        variants = outcome["wording_variants"]
        outcome["wording_variants"] = [{"text": text, "evidence": sorted(refs, key=lambda r: (r["scenario_id"], r["cell"]))}
            for text, refs in sorted(variants.items())]
        outcome["review_reasons"] = ["source_review_required"]
        if not outcome["code"]:
            outcome["review_reasons"].append("uncoded_source_instruction")
        if len(variants) > 1:
            outcome["review_reasons"].append("wording_conflict")
    for group in groups.values():
        group["scenario_ids"].sort()
        group["outcome_ids"] = sorted(group["outcome_ids"])
    return {"schema": "gina.curriculum-candidate-index.v1", "academic_year": data["academic_year"],
        "term": data["term"], "source_index": data["source_index"], "retrieved_on": data["retrieved_on"],
        "not_a_complete_curriculum": True, "school_scenario_selection_required": True,
        "publishable": False, "source_issues": data["issues"],
        "scope": "Term-one distribution-table candidates only; school-track applicability and programme version require review.",
        "counts": {"grade_subject_pairs": len(groups), "scenario_candidates": len(scenarios),
            "outcome_candidates": len(outcomes),
            "uncoded_outcomes": sum(not o["code"] for o in outcomes.values()),
            "wording_conflicts": sum(len(o["wording_variants"]) > 1 for o in outcomes.values()),
            "warning_scenarios": sum(bool(s["source_warnings"]) for s in scenarios),
            "published_questions": 0},
        "grade_subjects": sorted(groups.values(), key=lambda g: (g["grade"], g["subject"])),
        "outcomes": sorted(outcomes.values(), key=lambda o: o["id"]),
        "scenarios": sorted(scenarios, key=lambda s: s["id"])}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = build(json.loads(args.input.read_text()))
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result["counts"], ensure_ascii=False))
