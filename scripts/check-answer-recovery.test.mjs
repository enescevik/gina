import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { QueryClient, QueryObserver, onlineManager, focusManager } = require('@tanstack/react-query');
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const client = () => new QueryClient({defaultOptions:{queries:{retry:false,staleTime:0,gcTime:Infinity}}});

test('reproduces a delayed answer read replacing a successful save without revision reconciliation', async () => {
  const cache=client(), key=['attempt_saved_answers','attempt'];
  cache.setQueryData(key,{q:{text:'old',revision:1}});
  let resolve;
  const observer=new QueryObserver(cache,{queryKey:key,queryFn:()=>new Promise(r=>{resolve=r;})});
  const stop=observer.subscribe(()=>{});
  cache.setQueryData(key,{q:{text:'new',revision:2}});
  resolve({q:{text:'old',revision:1}});await tick();
  assert.equal(cache.getQueryData(key).q.text,'old');
  stop();cache.clear();
});
test('reproduces automatic reconnect refetch for the old review query policy', async () => {
  const cache=client();cache.mount();let calls=0;
  const observer=new QueryObserver(cache,{queryKey:['answer_review','attempt','q'],staleTime:0,refetchOnWindowFocus:false,queryFn:async()=>({revision:++calls})});
  const stop=observer.subscribe(()=>{});await tick();
  onlineManager.setOnline(false);onlineManager.setOnline(true);await tick();
  assert.equal(calls,2);
  stop();cache.unmount();cache.clear();
});
const source=readFileSync(new URL('../apps/mobile/src/lib/answer-state.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {mergeAnswerSnapshot,acknowledgeAnswerDraft,REVIEW_SNAPSHOT_OPTIONS}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('late or missing server rows cannot roll back an acknowledged answer; newer remote answers still arrive', async () => {
  const cache=client(),key=['attempt_saved_answers','attempt'];let resolve;
  const observer=new QueryObserver(cache,{queryKey:key,structuralSharing:mergeAnswerSnapshot,queryFn:()=>new Promise(r=>{resolve=r;})});
  cache.setQueryData(key,{q:{text:'old',revision:1}});
  const stop=observer.subscribe(()=>{});
  cache.setQueryData(key,{q:{text:'saved',revision:2},r:{key:'B',revision:1}});
  resolve({q:{text:'old',revision:1}});await tick();
  assert.deepEqual(cache.getQueryData(key),{q:{text:'saved',revision:2},r:{key:'B',revision:1}});
  cache.setQueryData(key,{q:{text:'other device',revision:3},r:{key:'B',revision:1}});
  assert.equal(cache.getQueryData(key).q.text,'other device');
  stop();cache.clear();
});
test('acknowledgement removes its draft so a newer server revision is visible', () => {
  const drafts={q:{text:'saved',revision:1},r:{key:'A',revision:0}};
  const next=acknowledgeAnswerDraft(drafts,'q',{text:'saved'},2);
  assert.deepEqual(next,{r:drafts.r});
  assert.equal(drafts.q.text,'saved');
  const visible={q:{text:'other device',revision:3},...next};
  assert.equal(visible.q.text,'other device');
});
test('a newer drawing or choice survives an earlier acknowledgement', () => {
  const document={version:1,elements:[{id:'new-stroke'}]};
  const drafts={q:{document,revision:1},r:{key:'C',revision:0}};
  assert.deepEqual(acknowledgeAnswerDraft(drafts,'q',{text:'old'},2).q,{document,revision:2});
  assert.deepEqual(acknowledgeAnswerDraft(drafts,'r',{key:'A'},1).r,{key:'C',revision:1});
  assert.equal(acknowledgeAnswerDraft({q:{key:'B',revision:4}},'q',{key:'B'},2).q.revision,4);
});
test('review snapshot survives reconnect/focus and reads fresh when reopened', async () => {
  const cache=client();cache.mount();let calls=0;
  const options={queryKey:['answer_review','attempt','q'],...REVIEW_SNAPSHOT_OPTIONS,queryFn:async()=>({revision:++calls})};
  const observer=new QueryObserver(cache,options);let stop=observer.subscribe(()=>{});await tick();
  assert.equal(calls,1);
  onlineManager.setOnline(false);onlineManager.setOnline(true);
  focusManager.setFocused(false);focusManager.setFocused(true);await tick();
  assert.equal(calls,1);assert.equal(observer.getCurrentResult().data.revision,1);
  stop();const reopened=new QueryObserver(cache,options);stop=reopened.subscribe(()=>{});await tick();
  assert.equal(calls,2);assert.equal(reopened.getCurrentResult().data.revision,2);
  stop();cache.unmount();cache.clear();focusManager.setFocused(undefined);
});
