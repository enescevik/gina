import { randomUUID } from "expo-crypto";
import { z } from "zod";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
const prefix = "gina:calendar:command:v1:";
const values = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum([
    "school",
    "activity",
    "holiday",
    "exam",
    "family",
    "doctor",
    "birthday",
    "other",
  ]),
  child_id: z.uuid().nullable(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  all_day: z.boolean(),
  location: z.string().max(180).nullable(),
  rrule: z.string().max(250).nullable(),
}).strict();
const schema = z.object({
  p_request_id: z.uuid(),
  p_event_id: z.uuid(),
  p_revision: z.number().int().nonnegative(),
  p_values: values.nullable(),
}).strict();
export type CalendarCommand = z.infer<typeof schema>;
let generation = 0;
export function clearCalendarCommands() {
  generation++;
  for (const key of store.keys().filter((k) => k.startsWith(prefix))) {
    store.remove(key);
  }
}
export function calendarJournal(user: string, family: string) {
  const active = generation,
    key = prefix + [user, family].map(encodeURIComponent).join(":");
  const guard = () => {
    if (!user || !family || generation !== active) {
      throw Error("calendar_session_changed");
    }
  };
  const read = () => {
    guard();
    const raw = store.get(key);
    return raw ? schema.parse(JSON.parse(raw)) : null;
  };
  const clear = (command: CalendarCommand) => {
    guard();
    if (read()?.p_request_id === command.p_request_id) store.remove(key);
  };
  return {
    read,
    prepare(input: Omit<CalendarCommand, "p_request_id">) {
      guard();
      if (store.get(key)) throw Error("calendar_pending");
      const command = schema.parse({ ...input, p_request_id: randomUUID() });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: CalendarCommand) {
      guard();
      const saved = read();
      if (
        !saved || JSON.stringify(saved) !== JSON.stringify(command)
      ) throw Error("calendar_command_changed");
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        const result = await supabase.rpc(
          "save_calendar_event",
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
        clear(command);
        return result.data;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
