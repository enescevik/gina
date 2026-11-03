import { createFocusStorage, FOCUS_PREFIX } from '@gina/core';
import { deviceRecordStorage as store } from './device-record-storage';
export { focusScope } from '@gina/core';
let generation = 0;
export function clearFocusTimers() {
  generation++;
  for (const key of store.keys().filter(key => key.startsWith(FOCUS_PREFIX))) store.remove(key);
}
/** One session per child/day on this device; logout invalidates old writers. */
export function focusStorage(key: string) {
  const active = generation;
  return createFocusStorage(store, key, () => {
    if (active !== generation) throw new Error('focus_session_changed');
  });
}
