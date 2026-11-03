#!/usr/bin/env python3
"""Import/read exact content in a disposable audit clone; never publish or review."""
import argparse
import base64
import importlib.util
import json
import re
import subprocess
import sys
import uuid
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).with_name('prepare-library-import.py'))
prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--folder',type=Path,required=True);parser.add_argument('--template',required=True)
parser.add_argument('--container',default='supabase_db_gina');args=parser.parse_args()
if not re.fullmatch(r'gina_[a-z0-9_]+_audit',args.template):parser.error('Explicit isolated audit template required')
bundle=prepare.prepare(args.folder);actor=str(uuid.uuid4());request=str(uuid.uuid4())
database='gina_content_'+uuid.uuid4().hex+'_audit'
def sql(db,body):
    r=subprocess.run(['docker','exec','-i',args.container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],input=body,text=True,capture_output=True,timeout=45)
    if r.returncode:raise RuntimeError(r.stderr)
    return r.stdout
sql('postgres',f'CREATE DATABASE {database} TEMPLATE {args.template};')
try:
    delimiter='$bundle_'+uuid.uuid4().hex+'$';raw=json.dumps(bundle,ensure_ascii=False);assert delimiter not in raw
    claims=json.dumps({'sub':actor,'role':'authenticated','gina':{'admin':True}})
    result=sql(database,f'''BEGIN;
      INSERT INTO auth.users(id,email) VALUES ('{actor}','{actor}@content.test');
      INSERT INTO public.admins(user_id) VALUES ('{actor}');
      CREATE TEMP TABLE acquired(id uuid);GRANT ALL ON acquired TO authenticated;
      SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claims='{claims}';
      INSERT INTO acquired SELECT (public.admin_import_library_bundle('{request}',{delimiter}{raw}{delimiter}::jsonb)->>'id')::uuid;
      SELECT public.admin_get_library_import((SELECT id FROM acquired),true);
      SELECT public.admin_get_library_import((SELECT id FROM acquired),false);
      SELECT public.admin_import_library_bundle('{request}',{delimiter}{raw}{delimiter}::jsonb);
      RESET ROLE;
      SELECT jsonb_build_object('packages',(SELECT count(*) FROM gina.library_import_packages WHERE package_key='{bundle['package_key']}'),'publications',(SELECT count(*) FROM gina.library_publications WHERE package_id IN(SELECT id FROM acquired)));
      ROLLBACK;''')
    teacher,student,replay,counts=[json.loads(line) for line in result.splitlines() if line.startswith('{')]
    assert teacher['status']=='draft' and counts=={'packages':1,'publications':0}
    assert replay['id']==teacher['id'] and replay['content_hash']==teacher['content_hash']
    assert teacher['provenance']==bundle['provenance'] and 'provenance' not in student
    for actual,original,child in zip(teacher['questions'],bundle['questions'],student['questions'],strict=True):
        for key in ['key','revision','source_key','student','teacher','metadata']:assert actual[key]==original[key],key
        assert child['student']==original['student'] and 'teacher' not in child and 'metadata' not in child
    originals={s['key']:s for s in bundle['sources']};assets={a['key']:a for a in bundle['assets']}
    for source in teacher['sources']:
        original=originals[source['key']]
        for key in ['title','body','alt','minimum_reading_width','provenance']:assert source[key]==original[key],key
        if original['asset_key']:
            asset=assets[original['asset_key']]
            assert base64.b64decode(source['png_base64'])==base64.b64decode(asset['base64'])
            assert source['sha256']==asset['sha256'] and [source['width'],source['height']]==[asset['width'],asset['height']]
        else:assert source['png_base64'] is None and source['sha256'] is None
    print(json.dumps({'questions':len(teacher['questions']),'sources':len(teacher['sources']),'pngs':len(assets),'exact_field_and_byte_comparison':True,'same_request_replay':True,'published':False,'editorial_review_performed':False,'transaction_rolled_back':True},indent=2))
finally:sql('postgres',f'DROP DATABASE {database};')
