import {assertEquals,assert} from 'jsr:@std/assert';
import {generationDraftScope} from './prova-generation-scope.ts';
import {serviceClient} from './supabase.ts';
const id='00000000-0000-4000-8000-000000000001';
function fixture(overrides:{grade?:number;subject?:string;submitted?:boolean;missing?:boolean;childGrade?:number;error?:boolean}={}){
 const calls:{table:string;key:string;value:unknown}[]=[];
 const db={from:(table:string)=>{const chain={select:()=>chain,eq:(key:string,value:unknown)=>{calls.push({table,key,value});return chain;},maybeSingle:async()=>({error:overrides.error?{}:null,data:overrides.missing?null:table==='children'?{grade:overrides.childGrade??5}:{id,version:2,content:{grade:overrides.grade??5,subjects:[overrides.subject??'Matematik'],childId:'child',purpose:'written'},submitted_at:overrides.submitted?'now':null}})};return chain;}} as unknown as ReturnType<typeof serviceClient>;return{db,calls};
}
Deno.test('generation scope requires own family draft and child',async()=>{const f=fixture();assertEquals(await generationDraftScope(f.db,'family',id,5,'Matematik'),{id,version:2,purpose:'written'});assert(f.calls.some(c=>c.table==='prova_drafts'&&c.key==='family_id'&&c.value==='family'));assert(f.calls.some(c=>c.table==='children'&&c.key==='family_id'&&c.value==='family'));});
for(const [name,options,status] of [['missing',{missing:true},404],['grade',{grade:6},409],['subject',{subject:'Fen'},409],['submitted',{submitted:true},409],['child grade changed',{childGrade:6},409],['data failure',{error:true},503]] as const)Deno.test('generation stops before provider: '+name,async()=>{const f=fixture(options);const result=await generationDraftScope(f.db,'family',id,5,'Matematik');assert(result instanceof Response);assertEquals(result.status,status);});
Deno.test('legacy standalone call has no draft, malformed identity rejected',async()=>{const f=fixture();assertEquals(await generationDraftScope(f.db,'family',undefined,5,'Matematik'),null);assertEquals(f.calls.length,0);const result=await generationDraftScope(f.db,'family','invalid',5,'Matematik');assert(result instanceof Response);assertEquals(result.status,400);assertEquals(f.calls.length,0);});
