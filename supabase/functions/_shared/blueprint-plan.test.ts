import {assertEquals,assertThrows} from 'jsr:@std/assert';
import {blueprintPlan} from './blueprint-plan.ts';
const bp={id:'blueprint',name:'Senaryo 2',grade:5,subject:'Matematik',rows:[{topic:'Açılar ve ölçüm',count:3}],source_context:{academic_year:'2026-2027',term:1,exam:2,officially_verified:true,origin:'official',secret:'private'}};
Deno.test('parent scenario never becomes official verification; only safe scope passes',()=>{assertEquals(blueprintPlan(bp,5,'Matematik'),{topics:bp.rows,name:bp.name,context:{origin:'parent_entered',officially_verified:false,academic_year:'2026-2027',term:1,exam:2}});});
Deno.test('scenario grade/subject mismatch never gets silently adjusted',()=>{assertThrows(()=>blueprintPlan(bp,6,'Matematik'),Error,'blueprint_mismatch');assertThrows(()=>blueprintPlan(bp,5,'Fen'),Error,'blueprint_mismatch');});
Deno.test('invalid legacy rows are rejected before billing rather than clamped',()=>{for(const rows of [[],[{topic:'A',count:0}],[{topic:'A',count:31}],[{topic:'A',count:1},{topic:' A ',count:2}],[{topic:'A',count:'2'}]])assertThrows(()=>blueprintPlan({...bp,rows},5,'Matematik'),Error,'blueprint_invalid');});
