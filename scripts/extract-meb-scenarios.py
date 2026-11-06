#!/usr/bin/env python3
"""Extract auditable candidate blueprints, never publish or infer a school choice.

Input: directory with downloaded official XLSX files and manifest.json (URL/hash).
Uses only ZIP/XML; never evaluates workbook formulas or follows external links.
Ambiguous multi-column/missing-outcome counts block a scenario from publication.
"""
import argparse
import hashlib
import json
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def coord(value):
    m = re.fullmatch(r"([A-Z]+)([0-9]+)", value)
    if not m:
        raise ValueError("cell_reference")
    col = 0
    for letter in m[1]:
        col = col * 26 + ord(letter) - 64
    return col, int(m[2])


def sheets(path):
    with zipfile.ZipFile(path) as archive:
        if sum(i.file_size for i in archive.infolist()) > 40_000_000:
            raise ValueError("workbook_expansion_limit")
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(x.itertext()) for x in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels")) if r.get("TargetMode") != "External"}
        for sheet in ET.fromstring(archive.read("xl/workbook.xml")).findall("s:sheets/s:sheet", NS):
            target = rels[sheet.get("{" + REL + "}id")]
            target = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            if not target.startswith("xl/worksheets/"):
                raise ValueError("worksheet_path")
            root = ET.fromstring(archive.read(target))
            cells, formulas = {}, set()
            for cell in root.findall(".//s:sheetData/s:row/s:c", NS):
                ref = cell.get("r")
                value, inline = cell.find("s:v", NS), cell.find("s:is", NS)
                text = (value.text or "") if value is not None else "".join(inline.itertext()) if inline is not None else ""
                if cell.get("t") == "s":
                    text = strings[int(text)]
                cells[ref] = " ".join(text.split())
                if cell.find("s:f", NS) is not None:
                    formulas.add(ref)
            merges = []
            for merge in root.findall("s:mergeCells/s:mergeCell", NS):
                start, end = merge.get("ref").split(":")
                merges.append((start, coord(start), coord(end)))
            yield sheet.get("name"), cells, merges, formulas


def extract(source, directory):
    path = directory / source["file"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError("source_hash_changed")
    # Keys are stable across revisions of the same official file: the canonical file stem (not a hash-suffixed
    # local copy) plus the source's own year/term. A new revision therefore re-uses the key with a new hash.
    year, term = source.get("academic_year", "2026-2027"), int(source.get("term", 1))
    stem = source.get("stem") or path.stem
    if not re.fullmatch(r"20\d{2}-20\d{2}", year) or term not in (1, 2) or not re.fullmatch(r"[a-z0-9_]{1,60}", stem):
        raise ValueError("source_scope_invalid")
    result, issues = [], []
    for name, cells, merges, formulas in sheets(path):
        grade_match = re.search(r"\b(1[0-2]|[1-9])\s*\.?\s*[SsSİıiI]", name) or re.fullmatch(r"(1[0-2]|[1-9])", name)
        if not grade_match:
            issues.append({"sheet": name, "reason": "grade_unresolved"})
            continue
        grade = int(grade_match[1])
        header = [(ref, text) for ref, text in cells.items() if re.fullmatch(r"Senaryo\s+\d+", text, re.I)]
        for scenario_ref, label in header:
            col, header_row = coord(scenario_ref)
            outcome_headers = [(coord(ref)[0], coord(ref)[1]) for ref, text in cells.items() if coord(ref)[1] < header_row and ("kazan" in text.lower() or "öğrenme çıktı" in text.lower())]
            if not outcome_headers:
                issues.append({"sheet": name, "cell": scenario_ref, "reason": "outcome_column_unresolved"})
                continue
            outcome_col = max(outcome_headers, key=lambda c: c[1])[0]
            outcomes = {}
            for ref, text in cells.items():
                c, row = coord(ref)
                if c == outcome_col and row > header_row and text and not text.upper().startswith("TOPLAM"):
                    code = re.match(r"^((?:[A-ZÇĞİÖŞÜ]+(?:\.[A-ZÇĞİÖŞÜ]+)*[.\s]*)?\d+(?:\.[A-Za-z0-9]+)+\.?)\s", text)
                    outcomes[row] = {"cell": ref, "text": text, "code": code[1].rstrip(".") if code else None}
            exam_candidates = []
            for ref, text in cells.items():
                c, row = coord(ref)
                if row < header_row and re.search(r"Dönem\s+\d+\.\s*Ortak", text, re.I):
                    end_col = next((end[0] for start, _, end in merges if start == ref), c)
                    if c <= col <= end_col:
                        exam_candidates.append((row, text))
            exam = max(exam_candidates)[1] if exam_candidates else None
            blocks, warnings = [], []
            if not exam:
                warnings.append("exam_header_unresolved")
            for ref, text in cells.items():
                c, row = coord(ref)
                if c != col or row <= header_row or not text:
                    continue
                # Footer totals and notes have no learning outcome and are not questions.
                span = next(((start, end) for anchor, start, end in merges if anchor == ref), ((c,row),(c,row)))
                related = [outcomes[r] for r in range(row, span[1][1]+1) if r in outcomes]
                if not related:
                    if re.fullmatch(r"\d+", text) and row <= max(outcomes, default=0):
                        warnings.append("count_without_outcome:"+ref)
                    continue
                if ref in formulas or not re.fullmatch(r"[1-9]\d?", text) or span[1][0] != col:
                    warnings.append("ambiguous_count:"+ref)
                    continue
                if any(o["code"] is None for o in related):
                    warnings.append("uncoded_outcome:"+ref)
                blocks.append({"count": int(text), "count_cell": ref, "outcomes": related})
            if not blocks:
                warnings.append("empty_scenario")
            result.append({
                "id": f"tr-{year}-t{term}-{stem}-g{grade}-{scenario_ref.lower()}", "grade": grade,
                "subject": source["label"], "sheet": name, "scenario": label,
                "exam": exam, "source_url": source["resolved_url"], "source_sha256": source["sha256"],
                "header_cell": scenario_ref, "question_count": sum(b["count"] for b in blocks),
                "blocks": blocks, "warnings": warnings, "review_status": "pending_source_review", "publishable": False,
            })
    return result, issues


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    sources = json.loads((args.directory / "manifest.json").read_text())
    scenarios, issues = [], []
    for source in sources:
        parsed, failures = extract(source, args.directory)
        scenarios.extend(parsed)
        issues.extend({"file":source["file"], **f} for f in failures)
    result = {"schema":"gina.meb-scenario-candidates.v1", "academic_year":"2026-2027", "term":1,
        "source_index":"https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724",
        "retrieved_on":"2026-11-03", "school_scenario_selection_required":True,
        "not_a_complete_curriculum":True, "sources":sources,"issues":issues,"scenarios":scenarios}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"sources":len(sources),"scenarios":len(scenarios),"warnings":sum(bool(s["warnings"]) for s in scenarios),"issues":issues},ensure_ascii=False))


if __name__ == "__main__":
    main()
