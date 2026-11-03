import { expect, it } from "vitest";
import { definitiveHelpFailure, type HelpCommand, HelpOutbox } from "./help";
const user = "00000000-0000-4000-8000-000000000001",
  family = "00000000-0000-4000-8000-000000000002",
  request = "00000000-0000-4000-8000-000000000003";
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    get: (k: string) => values.get(k) ?? null,
    set: (k: string, v: string) => {
      values.set(k, v);
    },
    remove: (k: string) => {
      values.delete(k);
    },
    keys: () => [...values.keys()],
  };
}
const payload: HelpCommand = {
  action: "create",
  kind: "support",
  category: "device",
  subject: "Pairing help",
  body: "Private body",
};
it("restores the exact receipt and payload after a lost response and app restart", () => {
  const store = storage(),
    first = new HelpOutbox(store, user, family, () => request).prepare(payload);
  const next = new HelpOutbox(store, user, family, () => {
    throw new Error("must not generate a second receipt");
  });
  expect(next.prepare(payload)).toEqual(first);
  expect(() => next.prepare({ ...payload, body: "Changed" })).toThrow(
    "help_pending_exists",
  );
  next.acknowledge(request);
  expect(next.restore()).toBeNull();
});
it("does not send when persistence fails or remove another pending receipt on a late ack", () => {
  const store = storage(),
    outbox = new HelpOutbox(store, user, family, () => request);
  store.set = () => {
    throw new Error("disk full");
  };
  expect(() => outbox.prepare(payload)).toThrow("disk full");
  expect(outbox.restore()).toBeNull();
  const saved = storage(),
    next = new HelpOutbox(saved, user, family, () => request);
  next.prepare(payload);
  next.acknowledge(user);
  expect(next.restore()?.id).toBe(request);
});
it("isolates identities and preserves unrecognized data instead of overwriting it", () => {
  const store = storage();
  new HelpOutbox(store, user, family, () => request).prepare(payload);
  expect(new HelpOutbox(store, request, family, () => request).restore())
    .toBeNull();
  expect(new HelpOutbox(store, user, request, () => request).restore())
    .toBeNull();
  const key = store.keys()[0]!;
  store.set(key, '{"version":2}');
  expect(() =>
    new HelpOutbox(store, user, family, () => request).prepare(payload)
  ).toThrow("help_local_invalid");
  expect(store.get(key)).toBe('{"version":2}');
});
it("only treats a database rejection as definitive; HTTP/network uncertainty stays pending", () => {
  expect(definitiveHelpFailure({ code: "P0001", message: "help_changed" }))
    .toBe(true);
  expect(definitiveHelpFailure(new Error("timeout"))).toBe(false);
  expect(definitiveHelpFailure({ code: "503", message: "unknown" })).toBe(
    false,
  );
});
