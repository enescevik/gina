import { describe, it, expect } from 'vitest';
import { startFocus, advanceFocus, changeFocus, parseFocus } from './focus-timer';
const now = 1_000_000;
describe('device focus timer', () => {
  it('recovers real elapsed time after JS suspension and serialization', () => {
    const saved = parseFocus(JSON.stringify(startFocus('a', 10, now)))!;
    expect(advanceFocus(saved, now + 240_000).remainingMs).toBe(360_000);
  });
  it('does not consume paused time or reset progress on resume', () => {
    const paused = changeFocus(startFocus('a', 5, now), 'pause', now + 30_000);
    expect(advanceFocus(paused, now + 600_000).remainingMs).toBe(270_000);
    const resumed = changeFocus(paused, 'resume', now + 600_000);
    expect(advanceFocus(resumed, now + 660_000).remainingMs).toBe(210_000);
  });
  it('caps overdue time at zero; repeated finish ticks are harmless', () => {
    const done = advanceFocus(startFocus('a', 5, now), now + 9_000_000);
    expect(done).toMatchObject({phase:'finished', remainingMs:0, runningSince:null});
    expect(changeFocus(done,'resume',now + 10_000_000)).toEqual(done);
  });
  it('freezes focus time during a break and waits for explicit resumption', () => {
    const rest = changeFocus(startFocus('a',10,now), 'break', now + 60_000);
    expect(rest.remainingMs).toBe(540_000);
    const after = advanceFocus(rest, now + 900_000);
    expect(after).toMatchObject({remainingMs:540_000, phase:'focus', runningSince:null, breakRemainingMs:0});
  });
  it('can pause a break and return early without losing focus time', () => {
    const rest = changeFocus(startFocus('a',5,now),'break',now + 10_000);
    const paused = changeFocus(rest,'pause',now + 20_000);
    expect(advanceFocus(paused,now + 30_000).breakRemainingMs).toBe(290_000);
    expect(changeFocus(paused,'return',now + 40_000)).toMatchObject({phase:'focus',remainingMs:290_000,runningSince:null});
  });
  it('pauses on clock rollback and never makes remaining time exceed duration', () => {
    const state = advanceFocus(startFocus('a',5,now), now - 1);
    expect(state).toMatchObject({remainingMs:300_000,runningSince:null});
  });
  it('rejects malformed, negative, inconsistent and unsupported persisted values', () => {
    const base = startFocus('a',5,now);
    for (const patch of [{version:2},{durationMs:60_000},{remainingMs:-1},{remainingMs:1e10},{phase:'bad'},{phase:'finished'},{breakRemainingMs:1},{runningSince:-1},{remainingMs:0},{taskId:''}]) {
      expect(() => parseFocus(JSON.stringify({...base,...patch}))).toThrow();
    }
    expect(() => parseFocus('{')).toThrow();
    expect(parseFocus(null)).toBeNull();
    expect(() => startFocus('a',120,now)).toThrow();
  });
});

import { createFocusStorage, focusScope } from './focus-timer';
describe('focus persistence boundaries', () => {
  const memory = () => {
    const values = new Map<string,string>();
    return {get:(k:string)=>values.get(k)??null,set:(k:string,v:string)=>{values.set(k,v);},remove:(k:string)=>{values.delete(k);}};
  };
  it('isolates accounts, families, siblings and dates including delimiter characters', () => {
    const scopes = [['u','f','c','day'],['v','f','c','day'],['u','g','c','day'],['u','f','d','day'],['u','f','c','next'],['u:f','c','d','day'],['u','f:c','d','day']].map(x=>focusScope(x[0]!,x[1]!,x[2]!,x[3]!));
    expect(new Set(scopes).size).toBe(scopes.length);
    const store=memory(),a=createFocusStorage(store,scopes[0]!);
    a.read();a.write(startFocus('task',5,now));
    for(const key of scopes.slice(1))expect(createFocusStorage(store,key).read()).toBeNull();
  });
  it('does not overwrite commands made in another tab; explicit reload recovers', () => {
    const store=memory(),a=createFocusStorage(store,'key'),b=createFocusStorage(store,'key');
    a.read();b.read();a.write(startFocus('first',5,now));
    expect(()=>b.write(startFocus('second',5,now))).toThrow('focus_changed');
    expect(b.read()?.taskId).toBe('first');b.write(null);expect(a.read()).toBeNull();
  });
  it('does not report a failed write as saved and permits explicit corrupt record reset', () => {
    const store=memory();store.set('key','{bad');const a=createFocusStorage(store,'key');
    expect(()=>a.read()).toThrow();a.write(null);expect(a.read()).toBeNull();
    const b=createFocusStorage({...store,set:()=>{throw new Error('disk_full');}},'key');b.read();
    expect(()=>b.write(startFocus('a',5,now))).toThrow('disk_full');expect(store.get('key')).toBeNull();
  });
  it('rejects writes from a signed-out session', () => {
    let signedOut=false;const a=createFocusStorage(memory(),'key',()=>{if(signedOut)throw new Error('signed_out');});a.read();signedOut=true;
    expect(()=>a.write(startFocus('a',5,now))).toThrow('signed_out');
  });
});
