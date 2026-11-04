import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { QueryClient, QueryObserver } = require('@tanstack/react-query');
async function load(name) {
  const code = ts.transpileModule(readFileSync(new URL(`../apps/mobile/src/lib/${name}.ts`, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { invalidateTaskState } = await load('task-cache');
const { invalidateProvaLists } = await load('prova-cache');
const client = () => new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:Infinity}}});

test('task approval refreshes visible daily status and marks the inactive room/week/balance stale', async () => {
  const cache=client();const keys=[['task_completions','child','day'],['task_completions_week','child','week'],['star_balance','child'],['star_events','child'],['approvals','family'],['family_completions','family'],['family_star_totals','family'],['child_goal','child'],['child_badges','child']];
  keys.forEach(k=>cache.setQueryData(k,'old'));let reads=0;
  const observer=new QueryObserver(cache,{queryKey:keys[0],queryFn:async()=>{reads++;return 'approved';},staleTime:Infinity});const stop=observer.subscribe(()=>{});
  try { await invalidateTaskState(cache);assert.equal(cache.getQueryData(keys[0]),'approved');assert.equal(reads,1);
    for(const k of keys.slice(1))assert.equal(cache.getQueryState(k).isInvalidated,true,JSON.stringify(k));
    assert.equal(await cache.fetchQuery({queryKey:keys[2],queryFn:async()=>2,staleTime:Infinity}),2);
  } finally {stop();cache.clear();}
});
test('Prova finish updates an active count and stale parent/child lists before role switch', async () => {
  const cache=client();const count=['child_exam_count','child'];cache.setQueryData(count,1);
  cache.setQueryData(['child_exams','child'],[{status:'assigned'}]);cache.setQueryData(['exams','family'],[{status:'assigned'}]);
  const observer=new QueryObserver(cache,{queryKey:count,queryFn:async()=>0,staleTime:Infinity});const stop=observer.subscribe(()=>{});
  try {await invalidateProvaLists(cache);assert.equal(cache.getQueryData(count),0);
    assert.equal(cache.getQueryState(['child_exams','child']).isInvalidated,true);
    assert.equal(cache.getQueryState(['exams','family']).isInvalidated,true);
    const rows=await cache.fetchQuery({queryKey:['child_exams','child'],queryFn:async()=>[{status:'completed'}],staleTime:Infinity});assert.equal(rows[0].status,'completed');
  } finally {stop();cache.clear();}
});
test('summary refresh never repeats start_exam_attempt or overwrites answer/review drafts', async () => {
  const cache=client();let writes=0;
  const keys=[['attempt','exam'],['attempt_saved_answers','attempt'],['answer_review','family','attempt','question'],['review_workspace','family','attempt'],['prova_drafts','family']];
  const stops=keys.map(k=>{cache.setQueryData(k,{draft:'unsaved'});return new QueryObserver(cache,{queryKey:k,queryFn:async()=>{writes++;return {};},staleTime:Infinity}).subscribe(()=>{});});
  try {await invalidateProvaLists(cache);await invalidateTaskState(cache);assert.equal(writes,0);
    for(const k of keys){assert.equal(cache.getQueryState(k).isInvalidated,false);assert.deepEqual(cache.getQueryData(k),{draft:'unsaved'});}
  } finally {stops.forEach(s=>s());cache.clear();}
});
test('a delayed old count response cannot replace a post-finish refresh', async () => {
  const cache=client(),key=['child_exam_count','child'];cache.setQueryData(key,1);
  let oldResolve;let reads=0;
  const observer=new QueryObserver(cache,{queryKey:key,queryFn:()=>++reads===1?new Promise(resolve=>{oldResolve=resolve;}):Promise.resolve(0),staleTime:Infinity});const stop=observer.subscribe(()=>{});
  try {const old=observer.refetch();await invalidateProvaLists(cache);assert.equal(cache.getQueryData(key),0);oldResolve(1);await old;assert.equal(cache.getQueryData(key),0);} finally {stop();cache.clear();}
});
