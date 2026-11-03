import { describe, expect, it, vi } from "vitest";
import { createSetupJournal, SETUP_COMMAND_PREFIX, type SetupCommand } from "./setup-command";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const task = { title: "Kitabımı okuyacağım", icon: "read-book", stars: 0, days: [1, 3], starts_on: "2026-11-04" };
function fixture() {
  const records = new Map<string, string>();
  const store = { get: (key: string) => records.get(key) ?? null, set: (key: string, value: string) => { records.set(key, value); }, remove: (key: string) => { records.delete(key); }, keys: () => [...records.keys()] };
  let sequence = 10, active = true;
  const send = vi.fn<(c: SetupCommand) => Promise<{ error: { code?: string; message: string } | null }>>().mockResolvedValue({ error: null });
  const open = (kind: "task" | "reward" = "task", child: string | null = uuid(3), user = uuid(1)) => createSetupJournal({ store, user, family: uuid(2), kind, child, id: () => uuid(sequence++), guard: () => { if (!active) throw Error("session_changed"); }, send });
  return { records, store, open, send, logout: () => { active = false; records.clear(); } };
}
describe("durable setup save", () => {
  it("reopens the exact command after a committed save loses its response", async () => {
    const f = fixture(), committed = new Set<string>();
    f.send.mockImplementationOnce(async c => { committed.add(c.p_request_id); throw Error("network"); });
    const first = f.open(), command = first.prepare([task]);
    await expect(first.send(command)).rejects.toThrow("network");
    const reopened = f.open();
    expect(reopened.read()).toEqual(command);
    expect(() => reopened.prepare([{ ...task, title: "Farklı görev" }])).toThrow("setup_pending");
    f.send.mockImplementationOnce(async c => { committed.add(c.p_request_id); return { error: null }; });
    await reopened.send(reopened.read()!);
    expect(committed.size).toBe(1);
    expect(reopened.read()).toBeNull();
    expect(f.send.mock.calls[0]![0]).toEqual(f.send.mock.calls[1]![0]);
  });
  it("persists all three selected rewards without requiring another AI call", async () => {
    const f = fixture(), journal = f.open("reward", null);
    const command = journal.prepare([1, 2, 3].map(n => ({ title: `Ödül ${n}`, icon: "reward-book", stars: n * 10, days: [] })));
    expect(f.open("reward", null).read()?.p_items).toHaveLength(3);
    await journal.send(command);
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it("will not send changed selections under the same request", async () => {
    const f = fixture(), journal = f.open(), command = journal.prepare([task]);
    await expect(journal.send({ ...command, p_items: [{ ...task, stars: 1 }] })).rejects.toThrow("setup_command_changed");
    expect(f.send).not.toHaveBeenCalled();
  });
  it("isolates siblings, parents and reward commands", () => {
    const f = fixture(); f.open().prepare([task]);
    expect(f.open("task", uuid(4)).read()).toBeNull();
    expect(f.open("task", uuid(3), uuid(5)).read()).toBeNull();
    expect(f.open("reward", null).read()).toBeNull();
  });
  it("blocks malformed local records instead of silently overwriting", () => {
    const f = fixture(); f.open().prepare([task]);
    const key = [...f.records.keys()][0]!;
    expect(key.startsWith(SETUP_COMMAND_PREFIX)).toBe(true);
    f.records.set(key, "{broken");
    expect(() => f.open().read()).toThrow();
    expect(() => f.open().prepare([task])).toThrow("setup_pending");
    expect(f.send).not.toHaveBeenCalled();
  });
  it("never calls the server if local persistence fails", () => {
    const f = fixture(); f.store.set = () => { throw Error("disk_full"); };
    expect(() => f.open().prepare([task])).toThrow("disk_full");
    expect(f.send).not.toHaveBeenCalled();
  });
  it("retains unknown/auth-expired outcomes, releases rolled-back SQL rejections", async () => {
    for (const code of ["", "PGRST301", "503", "P0001", "42501", "23514"]) {
      const f = fixture(), journal = f.open(), command = journal.prepare([task]);
      f.send.mockResolvedValue({ error: { code, message: "failed" } });
      await expect(journal.send(command)).rejects.toMatchObject({ code });
      expect(!!journal.read()).toBe(["", "PGRST301", "503"].includes(code));
    }
  });
  it("cannot complete or recreate a command after logout", async () => {
    const f = fixture(), journal = f.open(), command = journal.prepare([task]);
    f.send.mockImplementation(async () => { f.logout(); return { error: null }; });
    await expect(journal.send(command)).rejects.toThrow("session_changed");
    expect(() => journal.prepare([task])).toThrow("session_changed");
    expect(f.records.size).toBe(0);
  });
  it("validates real dates, unique weekdays, task and reward star ranges", () => {
    const f = fixture();
    for (const value of [{ ...task, starts_on: "2026-02-30" }, { ...task, days: [1, 1] }, { ...task, stars: 11 }]) {
      expect(() => f.open().prepare([value])).toThrow();
    }
    expect(() => f.open("reward", null).prepare([{ ...task, stars: 0 }])).toThrow();
    expect(f.records.size).toBe(0);
    expect(f.open().prepare([task]).p_items[0]?.stars).toBe(0);
  });
});
