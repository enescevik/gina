import { describe, expect, it } from 'vitest';
import { readSchoolBagReceipt, schoolBagCommandSchema, schoolBagDayAvailable } from './school-bag';
const id='00000000-0000-4000-8000-000000000001',child='00000000-0000-4000-8000-000000000002';
const input={p_request_id:id,p_child_id:child,p_day:'2026-11-04',p_revision:0,p_program_revision:3,p_items:[{id,label:'Matematik defterim',checked:false}]};
describe('family school bag',()=>{
 it('checks child, day, request and exact next revision on receipt',()=>{
  const c=schoolBagCommandSchema.parse(input),receipt={request:id,child_id:child,day:input.p_day,revision:1};
  expect(readSchoolBagReceipt(receipt,c).revision).toBe(1);
  for(const patch of [{request:child},{child_id:id},{day:'2026-11-05'},{revision:2}])expect(()=>readSchoolBagReceipt({...receipt,...patch},c)).toThrow();
 });
 it('rejects duplicate ids and labels',()=>{
  for(const item of [input.p_items[0],{...input.p_items[0],id:child}])expect(schoolBagCommandSchema.safeParse({...input,p_items:[...input.p_items,item]}).success).toBe(false);
 });
 it('does not accept reward fields, string booleans or blank materials',()=>{
  for(const patch of [{label:' '},{label:' Defter'},{checked:'false'},{stars:5}])expect(schoolBagCommandSchema.safeParse({...input,p_items:[{...input.p_items[0],...patch}]}).success).toBe(false);
 });
 it('permits an explicit empty list but caps materials and text',()=>{
  expect(schoolBagCommandSchema.parse({...input,p_items:[]}).p_items).toEqual([]);
  expect(schoolBagCommandSchema.safeParse({...input,p_items:[{...input.p_items[0],label:'a'.repeat(81)}]}).success).toBe(false);
  expect(schoolBagCommandSchema.safeParse({...input,p_items:Array.from({length:31},(_,i)=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,label:String(i),checked:false}))}).success).toBe(false);
 });
 it('uses calendar dates and a bounded history/planning window across months',()=>{
  expect(schoolBagDayAvailable('2026-10-05','2026-11-04')).toBe(true);
  expect(schoolBagDayAvailable('2026-10-04','2026-11-04')).toBe(false);
  expect(schoolBagDayAvailable('2026-11-11','2026-11-04')).toBe(true);
  expect(schoolBagDayAvailable('2026-11-12','2026-11-04')).toBe(false);
  expect(schoolBagDayAvailable('2026-02-30','2026-02-28')).toBe(false);
 });
});
