import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const scanner=fileURLToPath(new URL('./leak-scan.mjs',import.meta.url));
function scan(path,content){
 const dir=mkdtempSync(join(tmpdir(),'gina-leak-test-'));
 try{const file=join(dir,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content);
  return spawnSync(process.execPath,[scanner],{cwd:dir,encoding:'utf8'});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const canary='sk-ant-'+ 'SYNTHETIC'.repeat(8);
test('provider credential blocks and never prints the matched value',()=>{
 const r=scan('sample.ts',canary);assert.equal(r.status,1);assert.equal((r.stdout+r.stderr).includes(canary),false);
});
test('secret hidden in an env example still blocks',()=>assert.equal(scan('.env.example',canary).status,1));
test('private secret file is rejected without reading values',()=>{
 const r=scan('.env','PASSWORD=not-a-real-secret');assert.equal(r.status,1);assert.equal(r.stdout.includes('not-a-real-secret'),false);
});
test('an allowed test filename cannot hide a newly added key',()=>{
 const r=scan('scripts/check-testflight.test.mjs','sb_secret_'+ 'SYNTHETIC'.repeat(7));assert.equal(r.status,1);
});
test('generated PEM header exception is exact, not a whole-file bypass',()=>{
 const r=scan('supabase/functions/_shared/apple-signin.fixture.ts','-----BEGIN '+'PRIVATE KEY-----\nSYNTHETIC\n-----END '+'PRIVATE KEY-----');assert.equal(r.status,1);
});
test('clean code and environment variable references pass',()=>assert.equal(scan('clean.ts',"const key = process.env.KEY;" ).status,0));
test('CI scan is not allowed to continue after failure',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/security.yml',import.meta.url),'utf8');
 assert.match(workflow,/Blocking secret scan/);assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
});

test('does not traverse symlink cycles or files outside the checkout',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gina-leak-link-'));
 try{symlinkSync(dir,join(dir,'cycle'));const r=spawnSync(process.execPath,[scanner],{cwd:dir,encoding:'utf8',timeout:2000});assert.equal(r.status,0);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
