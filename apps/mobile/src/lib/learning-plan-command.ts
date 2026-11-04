import { randomUUID } from "expo-crypto";
import {
  createLearningPlanImportJournal,
  createLearningPlanJournal,
  LEARNING_IMPORT_PREFIX,
  LEARNING_PLAN_PREFIX,
} from "@gina/core";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
let generation = 0;
export function clearLearningPlanCommands() {
  generation++;
  for (
    const key of store.keys().filter((k) =>
      k.startsWith(LEARNING_PLAN_PREFIX) || k.startsWith(LEARNING_IMPORT_PREFIX)
    )
  ) store.remove(key);
}
export function learningPlanJournal(
  user: string,
  family: string,
  child: string,
) {
  const active = generation;
  return createLearningPlanJournal({
    store,
    user,
    family,
    child,
    uuid: randomUUID,
    guard: () => {
      if (active !== generation) throw Error("plan_session_changed");
    },
    send: async (c) => {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await supabase.rpc("save_learning_plan", c).abortSignal(
          controller.signal,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export function learningPlanImportJournal(
  user: string,
  family: string,
  child: string,
) {
  const active = generation;
  return createLearningPlanImportJournal({
    store,
    user,
    family,
    child,
    uuid: randomUUID,
    guard: () => {
      if (active !== generation) throw Error("plan_session_changed");
    },
    send: async (c) => {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await supabase.rpc("apply_learning_plan_import", c).abortSignal(
          controller.signal,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
