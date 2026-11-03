import {
  HELP_OUTBOX_PREFIX,
  HelpOutbox,
  helpReceiptSchema,
  type PendingHelpCommand,
} from "@gina/core";
import { randomUUID } from "expo-crypto";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
let generation = 0;
export function clearHelpCommands() {
  generation++;
  for (
    const key of store.keys().filter((key) =>
      key.startsWith(HELP_OUTBOX_PREFIX)
    )
  ) store.remove(key);
}
export function createHelpOutbox(user: string, family: string) {
  const active = generation;
  const guard = () => {
    if (active !== generation) throw new Error("help_session_changed");
  };
  return new HelpOutbox(
    {
      get: (key) => {
        guard();
        return store.get(key);
      },
      set: (key, value) => {
        guard();
        store.set(key, value);
      },
      remove: (key) => {
        guard();
        store.remove(key);
      },
      keys: () => {
        guard();
        return store.keys();
      },
    },
    user,
    family,
    randomUUID,
  );
}
export async function sendHelpCommand(command: PendingHelpCommand) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const c = command.payload;
    const request = c.action === "create"
      ? supabase.rpc("create_help_ticket", {
        p_request_id: command.id,
        p_kind: c.kind,
        p_category: c.category,
        p_subject: c.subject,
        p_body: c.body,
      })
      : supabase.rpc("reply_help_ticket", {
        p_request_id: command.id,
        p_ticket_id: c.ticket,
        p_revision: c.revision,
        p_body: c.body,
        p_internal: false,
        ...(c.status ? { p_status: c.status } : {}),
      });
    const { data, error } = await request.abortSignal(controller.signal);
    if (error) throw error;
    return helpReceiptSchema.parse(data);
  } finally {
    clearTimeout(timeout);
  }
}
