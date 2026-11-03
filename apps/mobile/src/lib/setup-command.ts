import { randomUUID } from "expo-crypto";
import { createSetupJournal, SETUP_COMMAND_PREFIX } from "@gina/core";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";

let generation = 0;
export function clearSetupCommands() {
  generation++;
  for (const key of store.keys().filter(k => k.startsWith(SETUP_COMMAND_PREFIX))) store.remove(key);
}
export function setupJournal(user: string, family: string, kind: "task" | "reward", child: string | null) {
  const active = generation;
  return createSetupJournal({
    store, user, family, kind, child, id: randomUUID,
    guard() { if (generation !== active) throw Error("setup_session_changed"); },
    async send(command) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        return await supabase.rpc("save_setup_batch", { ...command, p_child_id: command.p_child_id ?? undefined }).abortSignal(controller.signal);
      } finally { clearTimeout(timer); }
    },
  });
}
