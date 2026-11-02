import { describe, expect, it } from "vitest";
import { SerialWrites } from "./serial-writes";
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
describe("SerialWrites", () => {
  it("does not allow old responses to overwrite newer answers; coalesces unsent edits", async () => {
    const gate = deferred();
    const writes: string[] = [];
    const queue = new SerialWrites<string, string>(async (k, v) => {
      writes.push(k + v);
      if (writes.length === 1) await gate.promise;
    });
    queue.enqueue("q1", "A");
    await Promise.resolve();
    queue.enqueue("q1", "B");
    queue.enqueue("q1", "C");
    queue.enqueue("q2", "D");
    expect(writes).toEqual(["q1A"]);
    expect(queue.busy).toBe(true);
    gate.resolve();
    await queue.flush();
    expect(writes).toEqual(["q1A", "q1C", "q2D"]);
    expect(queue.busy).toBe(false);
  });
  it("retains the newest edit when an older in-flight write fails", async () => {
    const gate = deferred();
    let fail = true;
    const saved: string[] = [];
    const queue = new SerialWrites<string, string>(async (_, v) => {
      if (fail) {
        await gate.promise;
        throw Error("offline");
      }
      saved.push(v);
    });
    queue.enqueue("q", "A");
    await Promise.resolve();
    queue.enqueue("q", "B");
    gate.resolve();
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(queue.busy).toBe(true);
    fail = false;
    await queue.retry();
    expect(saved).toEqual(["B"]);
    expect(queue.busy).toBe(false);
  });
  it("requires explicit retry after a failure", async () => {
    let calls = 0;
    const queue = new SerialWrites<string, string>(async () => {
      calls++;
      throw Error("failed");
    });
    queue.enqueue("q", "A");
    await expect(queue.flush()).rejects.toThrow();
    queue.enqueue("q", "B");
    await expect(queue.flush()).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

it("flush saves debounced text immediately and cancels the scheduled send", async () => {
  const saved: string[] = [], scheduled: { task: () => void; cancelled: boolean }[] = [];
  const queue = new SerialWrites<string, string>(async (_, v) => { saved.push(v); }, () => {}, task => {
    const job = { task, cancelled: false }; scheduled.push(job); return () => { job.cancelled = true; };
  });
  queue.enqueue("q", "a", 400); queue.enqueue("q", "abc", 400);
  expect(saved).toEqual([]); expect(scheduled[0]?.cancelled).toBe(true);
  await queue.flush(); expect(saved).toEqual(["abc"]);
  expect(scheduled.every(job => job.cancelled)).toBe(true);
});
it("discard clears queued work even if an in-flight request later fails", async () => {
  const gate = deferred();
  const saved: string[] = [];
  const queue = new SerialWrites<string, string>(async (_, v) => {
    saved.push(v);
    await gate.promise;
    throw Error("offline");
  });
  queue.enqueue("q", "a");
  await Promise.resolve();
  queue.enqueue("q", "b");
  queue.cancelPending();
  gate.resolve();
  await queue.flush();
  expect(queue.busy).toBe(false);
  expect(queue.error).toBe(null);
  expect(saved).toEqual(["a"]);
});
