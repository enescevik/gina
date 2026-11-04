import { randomUUID } from "expo-crypto";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
import {
  readRepeatCalendarReceipt,
  type RepeatCalendarCommand,
  repeatCalendarCommandSchema as schema,
} from "@gina/core";
export type { RepeatCalendarCommand } from "@gina/core";
const prefix = "gina:repeat-calendar:command:v1:";
let generation = 0;
export function clearRepeatCalendarCommands() {
  generation++;
  for (const key of store.keys().filter((k) => k.startsWith(prefix))) {
    store.remove(key);
  }
}
export function repeatCalendarJournal(
  user: string,
  family: string,
  attempt: string,
) {
  const active = generation,
    key = prefix + [user, family, attempt].map(encodeURIComponent).join(":");
  const guard = () => {
    if (!user || !family || generation !== active) {
      throw Error("repeat_calendar_session_changed");
    }
  };
  const read = () => {
    guard();
    const raw = store.get(key);
    return raw ? schema.parse(JSON.parse(raw)) : null;
  };
  const clear = (command: RepeatCalendarCommand) => {
    guard();
    if (read()?.p_request_id === command.p_request_id) store.remove(key);
  };
  return {
    read,
    prepare(input: Omit<RepeatCalendarCommand, "p_request_id">) {
      guard();
      if (store.get(key)) throw Error("repeat_calendar_pending");
      const command = schema.parse({ ...input, p_request_id: randomUUID() });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: RepeatCalendarCommand) {
      guard();
      const saved = read();
      if (
        !saved || JSON.stringify(saved) !== JSON.stringify(command)
      ) throw Error("repeat_calendar_command_changed");
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        const result = await supabase.rpc(
          "apply_repeat_calendar",
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
        readRepeatCalendarReceipt(result.data, command);
        clear(command);
        return result.data;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
