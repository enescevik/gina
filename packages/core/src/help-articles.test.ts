import { expect, it } from "vitest";
import { type ArticleCommand, ArticleOutbox } from "./help-articles";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const command: ArticleCommand = {
  action: "publish",
  id: id(2),
  revision: 3,
  reason: "Reviewed against current app",
};
function store() {
  const m = new Map<string, string>();
  return {
    get: (k: string) => m.get(k) ?? null,
    set: (k: string, v: string) => {
      m.set(k, v);
    },
    remove: (k: string) => {
      m.delete(k);
    },
    keys: () => [...m.keys()],
  };
}
it("replays the same publication after restart, never changes its revision or action", () => {
  const s = store(),
    first = new ArticleOutbox(s, id(1), () => id(3)).prepare(command),
    next = new ArticleOutbox(s, id(1), () => {
      throw Error("new id");
    });
  expect(next.prepare(command)).toEqual(first);
  expect(() => next.prepare({ ...command, revision: 4 })).toThrow(
    "article_pending_exists",
  );
  expect(() => next.prepare({ ...command, action: "archive" })).toThrow(
    "article_pending_exists",
  );
  next.acknowledge(id(4));
  expect(next.restore()).toEqual(first);
  next.acknowledge(id(3));
  expect(next.restore()).toBeNull();
});
it("does not send without durable storage and isolates operators", () => {
  const s = store();
  new ArticleOutbox(s, id(1), () => id(3)).prepare(command);
  expect(new ArticleOutbox(s, id(4), () => id(5)).restore()).toBeNull();
  s.set = () => {
    throw Error("disk full");
  };
  expect(() => new ArticleOutbox(s, id(4), () => id(5)).prepare(command))
    .toThrow("disk full");
});
it("preserves unknown pending formats and validates editorial limits", () => {
  const s = store(), box = new ArticleOutbox(s, id(1), () => id(3));
  expect(() => box.prepare({ ...command, reason: " " })).toThrow();
  box.prepare(command);
  s.set(s.keys()[0]!, '{"version":2}');
  expect(() => box.restore()).toThrow("article_pending_invalid");
  expect(s.get(s.keys()[0]!)).toBe('{"version":2}');
});
