import type { AnswerJournalStorage } from "@gina/core";

export const deviceRecordStorage: AnswerJournalStorage = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
  remove: (key) => window.localStorage.removeItem(key),
  keys: () => Object.keys(window.localStorage),
};
