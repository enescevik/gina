import { assertEquals } from "jsr:@std/assert";
import { createMediaHandler } from "./index.ts";
import { base64 } from "./png.ts";
const id = "00000000-0000-4000-8000-000000007001";
function request(body: unknown, token = "valid") {
  return new Request("https://local.test", {
    method: "POST",
    headers: { authorization: token ? `Bearer ${token}` : "" },
    body: JSON.stringify(body),
  });
}
Deno.test("denies absent token and invalid/revoked admin without saving", async () => {
  let saves = 0;
  const h = createMediaHandler({
    read: () => Promise.resolve(null),
    save: () => {
      saves++;
      return Promise.resolve();
    },
  });
  assertEquals((await h(request({ package_id: id }, ""))).status, 403);
  assertEquals((await h(request({ package_id: id }))).status, 403);
  assertEquals(saves, 0);
});
Deno.test("rejects client media/actor injection and oversized request", async () => {
  let reads = 0;
  const h = createMediaHandler({
    read: () => {
      reads++;
      return Promise.resolve(null);
    },
    save: () => Promise.resolve(),
  });
  assertEquals(
    (await h(request({ package_id: id, actor: "self" }))).status,
    400,
  );
  assertEquals(
    (await h(request({ package_id: id, extra: "x".repeat(2000) }))).status,
    400,
  );
  assertEquals(reads, 0);
});
Deno.test("valid PNG prepared once per hash; actor comes from verified context", async () => {
  const source =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwcHAAAAGEAMGDX2mUAAAAAElFTkSuQmCC";
  const bytes = Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  let count = 0;
  const h = createMediaHandler({
    read: () =>
      Promise.resolve({
        actor: "verified-user",
        sources: [{ sha256: hash, png_base64: source }, {
          sha256: hash,
          png_base64: source,
        }],
      }),
    save: (actor, pid, assets) => {
      assertEquals(actor, "verified-user");
      assertEquals(pid, id);
      assertEquals(assets.length, 1);
      assertEquals(assets[0].source_hash, hash);
      count++;
      return Promise.resolve();
    },
  });
  assertEquals((await h(request({ package_id: id }))).status, 200);
  assertEquals(count, 1);
  const bad = createMediaHandler({
    read: () =>
      Promise.resolve({
        actor: "verified-user",
        sources: [{ sha256: hash, png_base64: base64(new Uint8Array(60)) }],
      }),
    save: () => {
      count++;
      return Promise.resolve();
    },
  });
  assertEquals((await bad(request({ package_id: id }))).status, 400);
  assertEquals(count, 1);
});
Deno.test("text-only package needs no image and save failure is not success", async () => {
  const h = createMediaHandler({
    read: () =>
      Promise.resolve({
        actor: "verified-user",
        sources: [{ sha256: null, png_base64: null }],
      }),
    save: () => {
      throw Error("private sensitive failure");
    },
  });
  const r = await h(request({ package_id: id }));
  assertEquals(r.status, 400);
  assertEquals(await r.json(), { error: "library_media_failed" });
});
