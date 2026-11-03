import { randomUUID } from "expo-crypto";
import { deviceRecordStorage as store } from "./device-record-storage";
import { supabase } from "./supabase";
import { z } from "zod";
const prefix = "gina.library.acquire.v1:";
const schema = z.object({
  p_request_id: z.uuid(),
  p_package_id: z.uuid(),
  p_publication_version: z.number().int().positive(),
  p_unit_keys: z.array(z.string().min(1).max(120)).min(1).max(100),
  p_draft_id: z.uuid(),
});
export type LibraryCommand = z.infer<typeof schema>;
let generation = 0;
export function clearLibraryCommands() {
  generation++;
  for (const key of store.keys().filter((k) => k.startsWith(prefix))) {
    store.remove(key);
  }
}
export function libraryJournal(user: string, family: string) {
  const active = generation, key = `${prefix}${user}:${family}`;
  const guard = () => {
    if (active !== generation) throw Error("library_session_changed");
  };
  return {
    read(): LibraryCommand | null {
      guard();
      const value = store.get(key);
      return value ? schema.parse(JSON.parse(value)) : null;
    },
    prepare(input: Omit<LibraryCommand, "p_request_id">) {
      guard();
      if (store.get(key)) throw Error("library_pending");
      const value = schema.parse({ ...input, p_request_id: randomUUID() });
      store.set(key, JSON.stringify(value));
      return value;
    },
    clear() {
      guard();
      store.remove(key);
    },
    async send(value: LibraryCommand) {
      guard();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const result = await supabase.rpc(
          "acquire_library_units",
          schema.parse(value),
        ).abortSignal(controller.signal);
        guard();
        // SQL errors roll back the entire operation. A lost HTTP response stays recoverable.
        if (result.error) {
          if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(result.error.code)) {
            store.remove(key);
          }
          throw result.error;
        }
        store.remove(key);
        return result.data;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
