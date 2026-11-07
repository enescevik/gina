/** A gentle reminder only: never locks the child out or changes a timed assessment. */
export function isEveningReminder(now: Date, timezone: string, start: number|null, end: number): boolean {
  if(start===null||start===end||![start,end].every(v=>Number.isInteger(v)&&v>=0&&v<1440))return false;
  try {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
    const minute=Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value);
    return start<end ? minute>=start&&minute<end : minute>=start||minute<end;
  } catch {return false;}
}
export const minutesClock=(minutes:number)=>`${Math.floor(minutes/60).toString().padStart(2,'0')}:${(minutes%60).toString().padStart(2,'0')}`;
export const clockMinutes=(clock:string)=>Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
