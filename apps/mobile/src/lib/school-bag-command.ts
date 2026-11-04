import { randomUUID } from "expo-crypto";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
import {
  readSchoolBagReceipt,
  type SchoolBagCommand,
  schoolBagCommandSchema as schema,
} from "@gina/core";
export type { SchoolBagCommand } from "@gina/core";
const prefix = "gina:school-bag:command:v1:";
let generation = 0;
export function clearSchoolBagCommands() {
  generation++;
  for (const key of store.keys().filter((k) => k.startsWith(prefix))) {
    store.remove(key);
  }
}
export function schoolBagJournal(
  user: string,
  family: string,
  child: string,
  day: string,
) {
  const active = generation,
    key = prefix + [user, family, child, day].map(encodeURIComponent).join(":");
  const guard = () => {
    if (!user || !family || generation !== active) {
      throw Error("schoolBag_session_changed");
    }
  };
  const read = () => {
    guard();
    const raw = store.get(key);
    const command = raw ? schema.parse(JSON.parse(raw)) : null;
    if (command && (command.p_child_id !== child || command.p_day !== day)) {
      throw Error("schoolBag_scope_changed");
    }
    return command;
  };
  const clear = (command: SchoolBagCommand) => {
    guard();
    if (read()?.p_request_id === command.p_request_id) store.remove(key);
  };
  return {
    read,
    prepare(input: Omit<SchoolBagCommand, "p_request_id">) {
      guard();
      if (store.get(key)) throw Error("schoolBag_pending");
      const command = schema.parse({ ...input, p_request_id: randomUUID() });
      if ((command.p_child_id !== child || command.p_day !== day)) {
        throw Error("schoolBag_scope_changed");
      }
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: SchoolBagCommand) {
      guard();
      const saved = read();
      if (
        !saved || JSON.stringify(saved) !== JSON.stringify(command)
      ) throw Error("schoolBag_command_changed");
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        const result = await supabase.rpc(
          "save_school_bag",
          schema.parse(command),
        ).abortSignal(controller.signal);
        guard();
        if (result.error) {
          if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(result.error.code)) {
            clear(
              command,
            );
          }
          throw result.error;
        }
        const receipt = readSchoolBagReceipt(result.data, command);
        clear(command);
        return receipt;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
