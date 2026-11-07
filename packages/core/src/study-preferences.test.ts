import {describe,it,expect} from 'vitest';
import {isEveningReminder,minutesClock,clockMinutes} from './study-preferences';
describe('non-blocking evening preference',()=>{
 it('defaults off',()=>expect(isEveningReminder(new Date(), 'Europe/Istanbul',null,420)).toBe(false));
 it('uses family time rather than device timezone',()=>expect(isEveningReminder(new Date('2026-11-07T18:00:00Z'),'Europe/Istanbul',1260,420)).toBe(true));
 it('excludes the morning boundary',()=>expect(isEveningReminder(new Date('2026-11-07T04:00:00Z'),'Europe/Istanbul',1260,420)).toBe(false));
 it('supports non-overnight windows',()=>expect(isEveningReminder(new Date('2026-11-07T12:00:00Z'),'UTC',660,780)).toBe(true));
 it('handles DST through the family timezone',()=>expect(isEveningReminder(new Date('2026-11-01T06:30:00Z'),'America/New_York',60,120)).toBe(true));
 it('bad timezone or empty interval does not block a child',()=>{expect(isEveningReminder(new Date(),'invalid',1,2)).toBe(false);expect(isEveningReminder(new Date(),'UTC',60,60)).toBe(false);});
 it('roundtrips all clock minutes',()=>{for(let m=0;m<1440;m++)expect(clockMinutes(minutesClock(m))).toBe(m);});
});
