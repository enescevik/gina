import { describe, expect, it } from "vitest";
import {
  AnswerJournal,
  answerJournalScope,
  type AnswerJournalStorage,
} from "./answer-journal";
const uid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const data = new Map<string, string>();
  const store: AnswerJournalStorage = {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => {
      data.set(k, v);
    },
    remove: (k) => {
      data.delete(k);
    },
    keys: () => [...data.keys()],
  };
  const scope = answerJournalScope(uid(1), uid(2), uid(3), uid(4));
  let ids = 10;
  return {
    data,
    store,
    scope,
    open: () => new AnswerJournal(store, scope, () => uid(++ids)),
  };
}
describe("durable answer journal", () => {
  it("recovers an edit written before the debounce and app termination", () => {
    const f = fixture();
    f.open().edit(uid(5), { text: "Henüz göndermedim" }, 3);
    expect(f.open().restore()[uid(5)]?.text).toBe("Henüz göndermedim");
  });
  it("replays the same receipt after a committed response is lost across restarts", async () => {
    const f = fixture(), calls: string[] = [];
    const first = f.open();
    first.edit(uid(5), { key: "B" }, 0);
    await expect(first.send(uid(5), async (r) => {
      calls.push(r.id);
      throw Error("network");
    }, () => {})).rejects.toThrow("network");
    const next = f.open();
    next.edit(uid(5), { key: "C" }, 1);
    const revisions: number[] = [];
    await next.send(uid(5), async (r) => {
      calls.push(r.id);
      revisions.push(r.revision);
      return r.revision + 1;
    }, () => {});
    expect(calls[0]).toBe(calls[1]);
    expect(calls[2]).not.toBe(calls[1]);
    expect(revisions).toEqual([0, 1]);
    expect(next.restore()).toEqual({});
  });
  it("keeps newer drawing edits made while a request is in flight", async () => {
    const f = fixture(), j = f.open();
    j.edit(uid(5), { text: "first" }, 0);
    const sent: string[] = [];
    await j.send(uid(5), async (r) => {
      sent.push(r.answer.text!);
      if (sent.length === 1) j.edit(uid(5), { text: "latest" }, 0);
      return r.revision + 1;
    }, () => {});
    expect(sent).toEqual(["first", "latest"]);
    expect(j.restore()).toEqual({});
  });
  it("never rebases a local answer onto another device's newer revision", async () => {
    const f = fixture(), j = f.open();
    j.edit(uid(5), { text: "local" }, 2);
    const revisions: number[] = [];
    for (const restarted of [j, f.open()]) {
      await expect(restarted.send(uid(5), async (r) => {
        revisions.push(r.revision);
        throw Error("answer_changed");
      }, () => {})).rejects.toThrow("answer_changed");
    }
    expect(revisions).toEqual([2, 2]);
    expect(f.open().restore()[uid(5)]?.text).toBe("local");
  });
  it("does not send if the write-ahead request cannot be stored", async () => {
    const f = fixture(), j = f.open();
    j.edit(uid(5), { key: "A" }, 0);
    f.store.set = () => {
      throw Error("disk_full");
    };
    let calls = 0;
    await expect(j.send(uid(5), async () => {
      calls++;
      return 1;
    }, () => {})).rejects.toThrow("disk_full");
    expect(calls).toBe(0);
  });
  it("retains a receipt when acknowledgement cleanup fails", async () => {
    const f = fixture(), j = f.open();
    j.edit(uid(5), { key: "A" }, 0);
    const remove = f.store.remove;
    f.store.remove = () => {
      throw Error("disk_full");
    };
    let receipt = "";
    await expect(j.send(uid(5), async (r) => {
      receipt = r.id;
      return 1;
    }, () => {})).rejects.toThrow("disk_full");
    f.store.remove = remove;
    await f.open().send(uid(5), async (r) => {
      expect(r.id).toBe(receipt);
      return 1;
    }, () => {});
    expect(f.open().restore()).toEqual({});
  });
  it.each([null, undefined, "4", NaN, Infinity, 0, -1, 2, 3.5, Number.MAX_SAFE_INTEGER + 1])(
    "retains the edit and original receipt after invalid acknowledgement %s",
    async (response) => {
      const f = fixture(), j = f.open();
      j.edit(uid(5), { text: "Çözümüm" }, 3);
      let receipt = "", saved = false;
      await expect(j.send(uid(5), async (r) => {
        receipt = r.id;
        return response as number;
      }, () => { saved = true; })).rejects.toThrow("answer_ack_invalid");
      expect(saved).toBe(false);
      expect(f.open().restore()[uid(5)]).toEqual({ text: "Çözümüm" });
      await f.open().send(uid(5), async (r) => {
        expect(r.id).toBe(receipt);
        expect(r.revision).toBe(3);
        return 4;
      }, () => { saved = true; });
      expect(saved).toBe(true);
      expect(f.open().restore()).toEqual({});
    },
  );
  it("accepts an unchanged revision for a confirmed identical answer", async () => {
    const f = fixture(), j = f.open();
    j.edit(uid(5), { key: "A" }, 3);
    await j.send(uid(5), async () => 3, () => {});
    expect(j.restore()).toEqual({});
  });
  it("isolates user, family, child and attempt scopes", () => {
    const f = fixture();
    f.open().edit(uid(5), { key: "A" }, 0);
    for (let index = 0; index < 4; index++) {
      const args = [uid(1), uid(2), uid(3), uid(4)] as [
        string,
        string,
        string,
        string,
      ];
      args[index] = uid(90);
      expect(
        new AnswerJournal(f.store, answerJournalScope(...args), () => uid(10))
          .restore(),
      ).toEqual({});
    }
  });
  it("refuses a damaged or unknown-version draft instead of deleting it", () => {
    const f = fixture();
    f.data.set(f.scope + uid(5), '{"version":2}');
    expect(() => f.open().restore()).toThrow("answer_local_invalid");
    expect(f.data.size).toBe(1);
  });
  it("does not recreate data cleared during logout on a late response", async () => {
    const f = fixture(), j = f.open();
    j.edit(uid(5), { text: "private" }, 0);
    let saved = false;
    await j.send(uid(5), async () => {
      f.data.clear();
      return 1;
    }, () => {
      saved = true;
    });
    expect(f.data.size).toBe(0);
    expect(saved).toBe(false);
  });
  it("keeps 2A structured answers and refuses unknown answer shapes", () => {
    const f = fixture(), j = f.open();
    const a = { type: "error_fix" as const, v: 1 as const, marks: { w2: { text: "gitti" } } };
    j.edit(uid(5), { answer: a }, 0);
    expect(f.open().restore()[uid(5)]).toEqual({ answer: a });
    expect(() => j.edit(uid(6), { answer: { type: "mark_text", v: 2, selected: [] } as never }, 0)).toThrow();
  });
});
