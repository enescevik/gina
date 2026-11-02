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
