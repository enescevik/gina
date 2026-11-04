import { REVIEW_JOURNAL_PREFIX, ReviewJournal, reviewJournalKey } from "@gina/core";
import { randomUUID } from "expo-crypto";
import { deviceRecordStorage as store } from "./device-record-storage";
let generation = 0;
export function clearReviewJournals() {
  generation++;
  for (const key of store.keys().filter(k => k.startsWith(REVIEW_JOURNAL_PREFIX))) store.remove(key);
}
export function createReviewJournal(user: string, family: string, attempt: string, question: string) {
  const active = generation;
  const guard = () => { if (active !== generation) throw Error("review_local_session_changed"); };
  return new ReviewJournal({
    get: key => { guard(); return store.get(key); },
    set: (key, value) => { guard(); store.set(key, value); },
    remove: key => { guard(); store.remove(key); },
    keys: () => { guard(); return store.keys(); },
  }, reviewJournalKey(user, family, attempt, question), randomUUID);
}
