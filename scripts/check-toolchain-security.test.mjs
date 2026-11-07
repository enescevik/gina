// Behavioural guards for the narrow backports in patches/. No untrusted input
// is sent to a service; glob fixtures are tiny and the amplification probe has
// a separate 96 MB process with a two-second deadline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const merge=require('deepmerge');
const globRequire=createRequire(require.resolve('glob'));
const modernMinimatch=globRequire.resolve('minimatch');

test('deepmerge keeps attacker-controlled __proto__ as data, not the result prototype',()=>{
  const malicious=JSON.parse('{"__proto__":{"isAdmin":true},"safe":1}');
  for(const result of [merge(Object.create(null),malicious),merge(malicious,{}),merge({nested:Object.create(null)},{nested:malicious}).nested]) {
    assert.equal(Object.getPrototypeOf(result),Object.prototype);
    assert.equal(result.isAdmin,undefined);
    assert.equal(result.safe,1);
  }
  assert.equal({}.isAdmin,undefined);
});

test('deepmerge retains ordinary nested/array/symbol semantics',()=>{
  const symbol=Symbol('test');
  const result=merge({nested:{a:1},list:[1],[symbol]:{a:1}},{nested:{b:2},list:[2],[symbol]:{b:2}});
  assert.deepEqual(result,{nested:{a:1,b:2},list:[1,2],[symbol]:{a:1,b:2}});
});

for(const mode of ['CommonJS','ESM']) test(`minimatch ${mode} bounds preprocessing while preserving ordinary matching`,()=>{
  const entry=mode==='CommonJS'?modernMinimatch:pathToFileURL(resolve(dirname(modernMinimatch),'../esm/index.js')).href;
  const code=`(async()=>{const {Minimatch}=process.argv[1]==='CommonJS'?require(process.argv[2]):await import(process.argv[2]);
    const amplified=new Minimatch(Array(30).fill('**/../a/b').join('/'),{optimizationLevel:2,braceExpandMax:64});
    if(amplified.set.length>64)process.exit(2);
    const small=new Minimatch('**/../a/b/**/../c/d',{optimizationLevel:2});
    if(!small.match('../a/b/../c/d')||!small.match('x/a/b/y/c/d'))process.exit(3);
    const large=new Minimatch('{x,*}/{0..999}',{optimizationLevel:2});
    if(large.set.length!==2000||!large.match('y/999')||large.match('.y/5'))process.exit(4);})().catch(()=>process.exit(5));`;
  const result=spawnSync(process.execPath,['--max-old-space-size=96','-e',code,mode,entry],{timeout:2000,stdio:'ignore'});
  assert.equal(result.status,0,'preprocessing must complete within the isolated memory/time bound');
});

for(const [name,load] of [
  ['CommonJS bundled',()=>require('glob')],['CommonJS raw',()=>require('glob/raw')],
  ['ESM bundled',()=>import('glob')],['ESM raw',()=>import('glob/raw')],
]) test(`glob ${name} stops directory reads after cancellation`,async()=>{
  const folder=fs.mkdtempSync(join(tmpdir(),'gina-glob-'));
  try {
    for(const path of ['a/a/a','a/a/b','a/b/a','b/a/a','b/b/b'])fs.mkdirSync(join(folder,path),{recursive:true});
    const ac=new AbortController(),reason=Error('synthetic_abort');let reads=0;
    const counted={...fs,readdir(...args){if(++reads===1)ac.abort(reason);return fs.readdir(...args);}};
    const {glob}=await load();
    await assert.rejects(glob('**/*',{cwd:folder,fs:counted,signal:ac.signal}),reason);
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(reads,1,'cancellation must not keep traversing the fixture');
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});
