import { randomUUID } from "expo-crypto";
import { z } from "zod";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
const prefix = "gina:study-plan:command:v1:";
const schema = z.object({
  p_request_id: z.uuid(),
  p_plan_id: z.uuid(),
  p_updated_at: z.string(),
  p_items: z.array(
    z.object({
      day: z.number().int().min(1).max(14),
      title: z.string().trim().min(1).max(120),
      notes: z.string().trim().min(1).max(1200),
      starts_at: z.string(),
      minutes: z.number().int().min(5).max(60),
    }).strict(),
  ).min(1).max(14),
}).strict();
export type StudyPlanCommand = z.infer<typeof schema>;
let generation = 0;
export function clearStudyPlanCommands() {
  generation++;
  for (const key of store.keys().filter((k) => k.startsWith(prefix))) {
    store.remove(key);
  }
}
export function studyPlanJournal(user: string, family: string, plan: string) {
  const active = generation,
    key = prefix + [user, family, plan].map(encodeURIComponent).join(":");
  const guard = () => {
    if (!user || !family || generation !== active) {
      throw Error("study_plan_session_changed");
    }
  };
  const read = () => {
    guard();
    const raw = store.get(key);
    return raw ? schema.parse(JSON.parse(raw)) : null;
  };
  const clear = (command: StudyPlanCommand) => {
    guard();
    if (read()?.p_request_id === command.p_request_id) store.remove(key);
  };
  return {
    read,
    prepare(input: Omit<StudyPlanCommand, "p_request_id">) {
      guard();
      if (store.get(key)) throw Error("study_plan_pending");
      const command = schema.parse({ ...input, p_request_id: randomUUID() });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: StudyPlanCommand) {
      guard();
      const saved = read();
      if (
        !saved || JSON.stringify(saved) !== JSON.stringify(command)
      ) throw Error("study_plan_command_changed");
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        const result = await supabase.rpc(
          "apply_study_plan_calendar",
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
