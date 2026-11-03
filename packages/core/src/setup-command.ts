import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
import { isCalendarDate } from "./form-validation";

const item = z.object({
  title: z.string().trim().min(1).max(80),
  icon: z.string().min(1).max(80),
  stars: z.number().int().min(0).max(999),
  days: z.array(z.number().int().min(1).max(7)).max(7),
  starts_on: z.string().refine(isCalendarDate).optional(),
}).strict();
export const setupCommandSchema = z.object({
  p_request_id: z.uuid(),
  p_kind: z.enum(["task", "reward"]),
  p_child_id: z.uuid().nullable(),
  p_items: z.array(item).min(1).max(3),
}).strict().refine(c => c.p_kind === "task"
  ? !!c.p_child_id && c.p_items.every(i => i.stars <= 10 && !!i.starts_on && i.days.length > 0 && new Set(i.days).size === i.days.length)
  : c.p_child_id === null && c.p_items.every(i => i.stars >= 1));
export type SetupCommand = z.infer<typeof setupCommandSchema>;
export type SetupItem = SetupCommand["p_items"][number];
export const SETUP_COMMAND_PREFIX = "gina:setup:command:v1:";

/** Write before sending. An uncertain result must be replayed with its original
 * request, including after a process restart; it must never become a new save. */
export function createSetupJournal({ store, user, family, kind, child, id, guard, send }: {
  store: AnswerJournalStorage;
  user: string;
  family: string;
  kind: "task" | "reward";
  child: string | null;
  id: () => string;
  guard: () => void;
  send: (command: SetupCommand) => Promise<{ error: { code?: string; message: string } | null }>;
}) {
  const key = SETUP_COMMAND_PREFIX + [user, family, kind, child ?? "family"].map(encodeURIComponent).join(":");
  const check = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
  };
  const read = () => {
    check();
    const raw = store.get(key);
    if (!raw) return null;
    const command = setupCommandSchema.parse(JSON.parse(raw));
    if (command.p_kind !== kind || command.p_child_id !== child) throw Error("setup_scope_changed");
    return command;
  };
  const clear = (command: SetupCommand) => {
    if (read()?.p_request_id === command.p_request_id) store.remove(key);
  };
  return {
    read,
    prepare(items: SetupItem[]) {
      check();
      if (store.get(key)) throw Error("setup_pending");
      const command = setupCommandSchema.parse({ p_request_id: id(), p_kind: kind, p_child_id: child, p_items: items });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: SetupCommand) {
      if (JSON.stringify(read()) !== JSON.stringify(command)) throw Error("setup_command_changed");
      const result = await send(command);
      check();
      if (result.error) {
        // SQL rejection is a rolled-back transaction. Transport/auth expiry and
        // unknown outcomes retain the command until an explicit retry succeeds.
        if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(result.error.code ?? "")) clear(command);
        throw result.error;
      }
      clear(command);
    },
  };
}
