import {
  ANSWER_JOURNAL_PREFIX,
  AnswerJournal,
  answerJournalScope,
} from "@gina/core";
import { randomUUID } from "expo-crypto";
import { deviceRecordStorage as store } from "./device-record-storage";

let generation = 0;
export function clearAnswerJournals() {
  generation++;
  for (
    const key of store.keys().filter((key) =>
      key.startsWith(ANSWER_JOURNAL_PREFIX)
    )
  ) store.remove(key);
}
export function createAnswerJournal(
  user: string,
  family: string,
  child: string,
  attempt: string,
) {
  const active = generation;
  const guard = () => {
    if (active !== generation) throw new Error("answer_local_session_changed");
  };
  return new AnswerJournal(
    {
      get: (key) => {
        guard();
        return store.get(key);
      },
      set: (key, value) => {
        guard();
        store.set(key, value);
      },
      remove: (key) => {
        guard();
        store.remove(key);
      },
      keys: () => {
        guard();
        return store.keys();
      },
    },
    answerJournalScope(user, family, child, attempt),
    randomUUID,
  );
}
