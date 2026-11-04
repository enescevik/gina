import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../apps/mobile/src/lib/realtime.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(t) {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const handlers={},reads=[];let subscribe,focusListener,cleanup,focused=true,removed=0,options;
  const channel={on:(name,_filter,fn)=>{handlers[name]=fn;return channel;},subscribe:fn=>{subscribe=fn;return channel;}};
  const client={invalidateQueries:args=>{reads.push(args.queryKey);return Promise.resolve();}};
  const mocks={
    '@tanstack/react-query':{useQueryClient:()=>client,focusManager:{isFocused:()=>focused,subscribe:fn=>{focusListener=fn;return ()=>{focusListener=undefined;};}}},
    'expo-router':{useFocusEffect:fn=>{cleanup=fn();}},
    react:{useCallback:fn=>fn},
    './supabase':{supabase:{channel:(_name,config)=>{options=config;return channel;},removeChannel:()=>{removed++;return Promise.resolve();}}},
  };
  const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},setTimeout,clearTimeout,setInterval,clearInterval});
  exports.useRealtimeInvalidate('task_completions','child_id=eq.synthetic',[['task_completions','synthetic'],['star_balance','synthetic']]);
  return {reads,handlers,status:value=>subscribe(value),get options(){return options;},get removed(){return removed;},stop:()=>cleanup(),focus:value=>{focused=value;focusListener?.(value);}};
}
test('refreshes again when database subscription becomes ready after channel join',t=>{
  const f=fixture(t);assert.equal(f.reads.length,2);f.status('SUBSCRIBED');t.mock.timers.tick(120);assert.equal(f.reads.length,4);
  f.handlers.system?.({extension:'postgres_changes',status:'ok'});t.mock.timers.tick(120);
  assert.equal(f.reads.length,6);assert.equal(f.options?.config?.postgres_changes_options?.wait,true);f.stop();
});
test('keeps recovery polling active when the socket joins but database subscription fails',t=>{
  const f=fixture(t);f.status('SUBSCRIBED');t.mock.timers.tick(120);const before=f.reads.length;
  f.handlers.system?.({extension:'postgres_changes',status:'error'});t.mock.timers.tick(30000);
  assert.ok(f.reads.length>before);f.stop();
});
test('coalesces event bursts and never refreshes a hidden or unmounted screen',t=>{
  const f=fixture(t);f.status('SUBSCRIBED');t.mock.timers.tick(120);const before=f.reads.length;
  for(let n=0;n<20;n++)f.handlers.postgres_changes({});t.mock.timers.tick(120);assert.equal(f.reads.length,before+2);
  f.focus(false);f.handlers.postgres_changes({});t.mock.timers.tick(30000);assert.equal(f.reads.length,before+2);
  f.focus(true);t.mock.timers.tick(120);assert.equal(f.reads.length,before+4);
  f.stop();f.handlers.system?.({extension:'postgres_changes',status:'ok'});f.handlers.postgres_changes({});t.mock.timers.tick(30000);
  assert.equal(f.reads.length,before+4);assert.equal(f.removed,1);
});
test('unrelated broadcast readiness does not stop database recovery polling',t=>{
  const f=fixture(t);f.status('CHANNEL_ERROR');f.handlers.system?.({extension:'system',status:'ok'});t.mock.timers.tick(30000);
  assert.equal(f.reads.length,4);f.stop();
});
test('channel join alone does not disable database recovery polling',t=>{
  const f=fixture(t);f.status('SUBSCRIBED');t.mock.timers.tick(120);const before=f.reads.length;
  t.mock.timers.tick(30000);assert.ok(f.reads.length>before);
  f.handlers.system?.({extension:'postgres_changes',status:'ok'});t.mock.timers.tick(120);const ready=f.reads.length;
  t.mock.timers.tick(30000);assert.equal(f.reads.length,ready);f.stop();
});
