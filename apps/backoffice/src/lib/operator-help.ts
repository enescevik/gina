import {
  helpReceiptSchema,
  OPERATOR_HELP_PREFIX,
  OperatorHelpOutbox,
  type PendingOperatorHelp,
} from "@gina/core";
import { supabase } from "./supabase";
let generation = 0;
export function clearOperatorHelp() {
  generation++;
  for (
    const key of Object.keys(localStorage).filter((k) =>
      k.startsWith(OPERATOR_HELP_PREFIX)
    )
  ) localStorage.removeItem(key);
}
export function operatorOutbox(user: string) {
  const active = generation;
  const guard = () => {
    if (generation !== active) throw Error("operator_session_changed");
  };
  return new OperatorHelpOutbox(
    {
      get: (key) => {
        guard();
        return localStorage.getItem(key);
      },
      set: (key, value) => {
        guard();
        localStorage.setItem(key, value);
      },
      remove: (key) => {
        guard();
        localStorage.removeItem(key);
      },
      keys: () => {
        guard();
        return Object.keys(localStorage);
      },
    },
    user,
    () => crypto.randomUUID(),
  );
}
export async function sendOperatorHelp(pending: PendingOperatorHelp) {
  const c = pending.payload,
    abort = new AbortController(),
    timeout = setTimeout(() => abort.abort(), 20000);
  try {
    const { data, error } = await supabase().rpc("reply_help_ticket", {
      p_request_id: pending.id,
      p_ticket_id: c.ticket,
      p_revision: c.revision,
      p_body: c.body,
      p_internal: c.internal,
      ...(c.status ? { p_status: c.status } : {}),
    }).abortSignal(abort.signal);
    if (error) throw error;
    return helpReceiptSchema.parse(data);
  } finally {
    clearTimeout(timeout);
  }
}
