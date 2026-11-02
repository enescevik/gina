import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./prepare-tablet-install.mjs',import.meta.url));
const store={id:'11111111-1111-4111-8111-111111111111',status:'FINISHED',platform:'IOS',distribution:'STORE',isForIosSimulator:false,app:{id:'8fc01433-eb6f-419e-a20b-edc30c8abe84'},appIdentifier:'com.enescevik.gina',appVersion:'0.1.0',appBuildVersion:'16',gitCommitHash:'a'.repeat(40)};
const tablet={...store,id:'22222222-2222-4222-8222-222222222222',distribution:'INTERNAL'};
function fixture(run){const dir=mkdtempSync(join(tmpdir(),'gina-tablet-install-test-'));try{
 writeFileSync(join(dir,'store.json'),JSON.stringify(store));writeFileSync(join(dir,'icon.png'),Buffer.from('test-only icon'));
 const invoke=(data)=>{writeFileSync(join(dir,'tablet.json'),JSON.stringify(data));return spawnSync(process.execPath,[script,join(dir,'store.json'),join(dir,'tablet.json'),join(dir,'icon.png'),join(dir,'out')],{encoding:'utf8'});};
 run({dir,invoke});
}finally{rmSync(dir,{recursive:true,force:true});}}
test('tablet installer publishes only matching completed physical builds',()=>fixture(({dir,invoke})=>{
 assert.equal(invoke(tablet).status,0);const data=JSON.parse(readFileSync(join(dir,'out/release.json'),'utf8'));assert.equal(data.build,'16');assert.equal(data.sourceCommit,store.gitCommitHash);assert.equal(data.tabletBuildId,tablet.id);assert.match(data.installUrl,/expo\.dev\/accounts\/enescevik\/projects\/gina-aile\/builds\//);
 const html=readFileSync(join(dir,'out/index.html'),'utf8');assert.ok(html.includes('0.1.0 (16)'));assert.ok(html.includes(data.installUrl));
}));
test('tablet installer rejects old build, changed source, simulator, wrong app and unfinished build',()=>fixture(({invoke})=>{
 for(const patch of [{appBuildVersion:'6'},{appVersion:'0.2.0'},{gitCommitHash:'b'.repeat(40)},{status:'IN_PROGRESS'},{distribution:'STORE'},{isForIosSimulator:true},{platform:'ANDROID'},{appIdentifier:'com.other.app'},{app:{id:'other'}}])assert.notEqual(invoke({...tablet,...patch}).status,0,JSON.stringify(patch));
}));
test('tablet installer cannot replace a newer published release',()=>fixture(({dir,invoke})=>{
 assert.equal(invoke(tablet).status,0);writeFileSync(join(dir,'out/release.json'),JSON.stringify({build:'17'}));assert.notEqual(invoke(tablet).status,0);assert.equal(JSON.parse(readFileSync(join(dir,'out/release.json'),'utf8')).build,'17');
}));
