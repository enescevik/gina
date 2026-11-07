import {describe,it,expect} from 'vitest';
import {childErrorMessageKey} from './child-error';
describe('child-safe error presentation',()=>{
 it('does not display plan offers, raw provider diagnostics or a server-supplied string',()=>{
  for(const error of [{code:'plan_limit',message:'Upgrade to Pro'}, {category:'provider',message:'Private endpoint diagnostic'}, 'Your answer failed badly', new Error('Unknown database detail')])expect(childErrorMessageKey(error)).toBe('childError.retry');
 });
 it('keeps actionable PIN feedback without revealing count or implementation details',()=>{
  expect(childErrorMessageKey({code:'pin_locked'})).toBe('childError.waitPin');
  expect(childErrorMessageKey('invalid_pin')).toBe('childError.tryPin');
 });
 it('returns the same short connection guidance for browser and native failures',()=>{
  expect(childErrorMessageKey(new Error('Failed to fetch'))).toBe('childError.connection');
  expect(childErrorMessageKey({message:'Connection timeout'})).toBe('childError.connection');
 });
});
