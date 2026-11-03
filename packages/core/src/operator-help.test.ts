import { expect, it } from "vitest";
import { type OperatorHelpCommand, OperatorHelpOutbox } from "./operator-help";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payload: OperatorHelpCommand = {
  ticket: id(2),
  revision: 3,
  body: "Private team note",
  internal: true,
  status: null,
};
function store() {
  const values = new Map<string, string>();
  return {
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
it("replays exact internal note after reload; cannot turn it into a public reply or new revision", () => {
  const storage = store(),
    first = new OperatorHelpOutbox(storage, id(1), () => id(3)).prepare(
      payload,
    );
  const next = new OperatorHelpOutbox(storage, id(1), () => {
    throw Error("new receipt");
  });
  expect(next.prepare(payload)).toEqual(first);
  expect(() => next.prepare({ ...payload, internal: false })).toThrow(
    "operator_help_pending",
  );
  expect(() => next.prepare({ ...payload, revision: 4 })).toThrow(
    "operator_help_pending",
  );
  next.acknowledge(id(9));
  expect(next.restore()).toEqual(first);
  next.acknowledge(first.id);
  expect(next.restore()).toBeNull();
});
it("isolates operators and fails before sending when device storage cannot persist", () => {
  const storage = store();
  new OperatorHelpOutbox(storage, id(1), () => id(3)).prepare(payload);
  expect(new OperatorHelpOutbox(storage, id(8), () => id(4)).restore())
    .toBeNull();
  storage.set = () => {
    throw Error("quota");
  };
  expect(() =>
    new OperatorHelpOutbox(storage, id(8), () => id(4)).prepare(payload)
  ).toThrow("quota");
});
it("rejects blank notes and preserves unrecognized pending records", () => {
  const storage = store(),
    box = new OperatorHelpOutbox(storage, id(1), () => id(3));
  expect(() => box.prepare({ ...payload, body: "  " })).toThrow();
  box.prepare(payload);
  storage.set(storage.keys()[0]!, '{"version":2}');
  expect(() => box.restore()).toThrow("operator_help_invalid");
  expect(storage.get(storage.keys()[0]!)).toBe('{"version":2}');
});
