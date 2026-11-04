import { randomUUID } from "expo-crypto";
import { createLearningPlanJournal, LEARNING_PLAN_PREFIX } from "@gina/core";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
let generation = 0;
export function clearLearningPlanCommands() {
  generation++;
  for (
    const key of store.keys().filter((k) => k.startsWith(LEARNING_PLAN_PREFIX))
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
