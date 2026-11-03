import importlib.util
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.dont_write_bytecode=True
SCRIPT=Path(__file__).with_name('prepare-library-import.py')
spec=importlib.util.spec_from_file_location('prepare',SCRIPT)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class ImportPreparer(unittest.TestCase):
    def test_student_teacher_and_sources_keep_exact_fields(self):
        bundle=module.prepare(module.pilot.FOLDER)
        original=json.loads((module.pilot.FOLDER/'pilot.json').read_text())
        self.assertEqual(len(bundle['questions']),20)
        self.assertEqual(len(bundle['sources']),8)
        self.assertEqual(len(bundle['assets']),8)
        for q,src in zip(bundle['questions'],original['questions']):
            self.assertEqual(q['source_key'],src['source_id'])
            self.assertEqual(q['teacher']['rubric'],src['rubric'])
            self.assertEqual(q['teacher']['expected_answer'],src['expected_answer'])
            self.assertEqual(set(q['student']),{'grade','subject','topic','kind','difficulty','stem','choices'})
        self.assertIsNone(bundle['previous_hash'])
        self.assertEqual(bundle['revision'],1)
        self.assertNotIn('publish',bundle)

    def test_repeat_preparation_keeps_content_identity(self):
        self.assertEqual(module.prepare(module.pilot.FOLDER),module.prepare(module.pilot.FOLDER))

    def test_command_writes_private_durable_rpc_request_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'request.json'
            cmd=[sys.executable,str(SCRIPT),'--output',str(out)]
            first=subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(first.returncode,0,first.stderr)
            payload=json.loads(out.read_text());before=out.read_bytes()
            self.assertEqual(set(payload),{'p_request_id','p_bundle'})
            self.assertEqual(uuid.UUID(payload['p_request_id']).version,4)
            self.assertEqual(stat.S_IMODE(out.stat().st_mode),0o600)
            second=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(second.returncode,0)
            self.assertEqual(out.read_bytes(),before)


if __name__=='__main__':unittest.main()
