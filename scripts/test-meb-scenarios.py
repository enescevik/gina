import hashlib
import importlib.util
import tempfile
import unittest
import zipfile
import sys
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("extract", Path(__file__).with_name("extract-meb-scenarios.py"))
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)


class WorkbookExtraction(unittest.TestCase):
    def fixture(self, directory, count="2", merged="D7:D8", formula=""):
        path = directory / "fixture.xlsx"
        def cell(ref, text):
            return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'
        cells = [cell("C5", "KAZANIM"), cell("D5", "1. Dönem 1. Ortak Yazılı Sınav"), cell("D6", "Senaryo 1"), cell("C7", "MAT.5.1.1. First outcome"), cell("C8", "MAT.5.1.2. Second outcome"), f'<c r="D7">{formula}<v>{count}</v></c>']
        with zipfile.ZipFile(path,"w") as z:
            z.writestr("xl/workbook.xml",'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="5" r:id="rId1"/></sheets></workbook>')
            z.writestr("xl/_rels/workbook.xml.rels",'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
            z.writestr("xl/worksheets/sheet1.xml",'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row>'+''.join(cells)+'</row></sheetData><mergeCells><mergeCell ref="'+merged+'"/></mergeCells></worksheet>')
        return {"file":path.name,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"label":"Matematik","resolved_url":"https://cdn.eba.gov.tr/fixture.xlsx"}

    def test_merged_outcomes_do_not_double_question_count(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=self.fixture(root)
            rows,issues=extract.extract(source,root)
            self.assertEqual(issues,[])
            self.assertEqual(rows[0]["question_count"],2)
            self.assertEqual(len(rows[0]["blocks"][0]["outcomes"]),2)
            self.assertFalse(rows[0]["publishable"])

    def test_cross_scenario_merge_is_flagged_not_invented(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=self.fixture(root,merged="D7:E7")
            rows,_=extract.extract(source,root)
            self.assertIn("ambiguous_count:D7",rows[0]["warnings"])

    def test_formula_is_not_evaluated_or_trusted_from_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=self.fixture(root,formula="<f>1+1</f>")
            rows,_=extract.extract(source,root)
            self.assertIn("ambiguous_count:D7",rows[0]["warnings"])

    def test_changed_source_hash_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=self.fixture(root);source["sha256"]="0"*64
            with self.assertRaisesRegex(ValueError,"source_hash_changed"):
                extract.extract(source,root)


if __name__=="__main__":unittest.main()
