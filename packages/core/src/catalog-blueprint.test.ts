import { describe, expect, it } from "vitest";
import {
  canonicalSubject,
  catalogBlueprintFits,
  catalogBlueprintInputSchema,
  createCatalogBlueprintJournal,
} from "./catalog-blueprint";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = {
  child_id: id(3),
  catalogue_id: id(4),
  revision: 2,
  subject: "Matematik",
  confirmed: true as const,
};
function fixture() {
  const rows = new Map<string, string>();
  let active = true;
  const store = {
    get: (k: string) => rows.get(k) ?? null,
    set: (k: string, v: string) => {
      rows.set(k, v);
    },
    remove: (k: string) => {
      rows.delete(k);
    },
    keys: () => [...rows.keys()],
  };
  let send = async () => ({
    data: id(10) as unknown,
    error: null as { message: string; code?: string } | null,
  });
  const open = (user = id(1)) =>
    createCatalogBlueprintJournal({
      store,
      user,
      family: id(2),
      id: () => id(9),
      guard: () => {
        if (!active) throw Error("logout");
      },
      send: () => send(),
    });
  return {
    open,
    rows,
    setSend: (fn: typeof send) => {
      send = fn;
    },
    logout: () => {
      active = false;
      rows.clear();
    },
  };
}
describe("reviewed source selection", () => {
  it("requires school confirmation and source version; cannot forge provenance", () => {
    for (
      const change of [{ confirmed: false }, { revision: 0 }, {
        officially_verified: true,
      }, { child_id: "x" }]
    ) {
      expect(
        catalogBlueprintInputSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
    }
  });
  it("restores exact selection after lost reply without exposing it to another parent", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(input);
    f.setSend(async () => {
      throw Error("network");
    });
    await expect(j.send(c)).rejects.toThrow("network");
    expect(f.open().read()).toEqual(c);
    expect(f.open(id(8)).read()).toBeNull();
    f.setSend(async () => ({ data: id(10), error: null }));
    expect(await f.open().send(c)).toBe(id(10));
    expect(j.read()).toBeNull();
  });
  it("does not silently replace a pending selection with another source version", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(input);
    await expect(j.send({ ...c, p_input: { ...input, revision: 3 } })).rejects
      .toThrow("blueprint_changed");
    expect(() => j.prepare(input)).toThrow("blueprint_pending");
  });
  it("keeps uncertain replies but releases definite source rejection", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(input);
    f.setSend(async () => ({ data: null, error: null }));
    await expect(j.send(c)).rejects.toThrow();
    expect(j.read()).toEqual(c);
    f.setSend(async () => ({
      data: null,
      error: { message: "curriculum_unavailable", code: "P0001" },
    }));
    await expect(j.send(c)).rejects.toMatchObject({
      message: "curriculum_unavailable",
    });
    expect(j.read()).toBeNull();
  });
  it("logout cannot resurrect a command", async () => {
    const f = fixture(), j = f.open(), c = j.prepare(input);
    f.setSend(async () => {
      f.logout();
      return { data: id(10), error: null };
    });
    await expect(j.send(c)).rejects.toThrow("logout");
    expect(f.rows.size).toBe(0);
  });
  it("matches known subject aliases only", () => {
    expect(canonicalSubject("İlköğretim Matematik")).toBe("Matematik");
    expect(canonicalSubject("Fen")).toBe("Fen Bilimleri");
    expect(canonicalSubject("Fizik")).toBe("Fizik");
  });
  it("shows catalogue copies only for their child and written purpose", () => {
    const c = { origin: "reviewed_catalogue", child_id: id(3) };
    expect(catalogBlueprintFits(c, id(3), "written")).toBe(true);
    expect(catalogBlueprintFits(c, id(4), "written")).toBe(false);
    expect(catalogBlueprintFits(c, id(3), "practice")).toBe(false);
    expect(
      catalogBlueprintFits({ origin: "parent_entered" }, id(4), "practice"),
    ).toBe(true);
  });
});
