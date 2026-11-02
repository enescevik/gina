import { describe, expect, it } from "vitest";
import { type AnswerReceipt, AnswerReceipts } from "./answer-receipts";
describe("answer receipts", () => {
  it("reconciles a committed write with a lost response before sending a newer edit", async () => {
    let revision = 0, ids = 0, fail = true;
    const calls: AnswerReceipt[] = [], saved: string[] = [];
    const writer = new AnswerReceipts(
      async (_q, receipt) => {
        calls.push(receipt);
        if (fail) {
          fail = false;
          throw Error("timeout");
        }
        return receipt.revision + 1;
      },
      (_q, answer, rev) => {
        saved.push(answer.text!);
        revision = rev;
      },
      () => revision,
      () => String(++ids),
    );
    await expect(writer.write("q", { text: "first" })).rejects.toThrow(
      "timeout",
    );
    await writer.write("q", { text: "newest" });
    expect(calls.map((c) => [c.id, c.revision, c.answer.text])).toEqual([
      ["1", 0, "first"],
      ["1", 0, "first"],
      ["2", 1, "newest"],
    ]);
    expect(saved).toEqual(["first", "newest"]);
  });
  it("reuses a failed receipt without creating another write for the same value", async () => {
    let calls = 0, ids = 0;
    const writer = new AnswerReceipts(
      async () => {
        if (++calls === 1) throw Error("offline");
        return 1;
      },
      () => {},
      () => 0,
      () => String(++ids),
    );
    await expect(writer.write("q", { key: "B" })).rejects.toThrow();
    await writer.write("q", { key: "B" });
    expect(calls).toBe(2);
    expect(ids).toBe(1);
  });
  it("does not silently bypass a revision conflict with another device", async () => {
    let ids = 0;
    const writer = new AnswerReceipts(
      async () => {
        throw Error("answer_changed");
      },
      () => {
        throw Error("must not mark saved");
      },
      () => 3,
      () => String(++ids),
    );
    await expect(writer.write("q", { key: "A" })).rejects.toThrow(
      "answer_changed",
    );
    await expect(writer.write("q", { key: "B" })).rejects.toThrow(
      "answer_changed",
    );
    expect(ids).toBe(1);
  });
});

it("freezes an uncertain drawing and replays it before the newer drawing", async () => {
  let id = 0, revision = 0, fail = true;
  const calls: AnswerReceipt[] = [];
  const writer = new AnswerReceipts(
    async (_q, r) => {
      calls.push(r);
      if (fail) {
        fail = false;
        throw Error("timeout");
      }
      return r.revision + 1;
    },
    (_q, _a, r) => {
      revision = r;
    },
    () => revision,
    () => String(++id),
  );
  const document = {
    version: 1 as const,
    width: 1000 as const,
    height: 1400 as const,
    elements: [{
      id: "10000000-0000-4000-8000-000000000001",
      type: "stroke" as const,
      color: "#201951" as const,
      size: 4,
      points: [[10, 20] as [number, number]],
    }],
  };
  await expect(writer.write("q", { document })).rejects.toThrow("timeout");
  document.elements[0]!.points.push([30, 40]);
  await writer.write("q", { document });
  expect(calls.map((r) => r.id)).toEqual(["1", "1", "2"]);
  expect(calls[0]!.answer.document!.elements[0]).toMatchObject({
    points: [[10, 20]],
  });
  expect(calls[2]!.answer.document!.elements[0]).toMatchObject({
    points: [[10, 20], [30, 40]],
  });
});
