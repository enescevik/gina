import Storage from "expo-sqlite/kv-store";
import type { AnswerJournalStorage } from "@gina/core";

// No extra package or network cache; the OS app sandbox contains these drafts.
export const answerJournalStorage: AnswerJournalStorage = {
  get: (key) => Storage.getItemSync(key),
  set: (key, value) => Storage.setItemSync(key, value),
  remove: (key) => Storage.removeItemSync(key),
  keys: () => Storage.getAllKeysSync(),
};
