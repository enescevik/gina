import { assertEquals, assertRejects } from "jsr:@std/assert";
import { base64, canonicalLibraryPng, pngChunk } from "./png.ts";
const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function join(parts: Uint8Array[]) {
  const v = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let n = 0;
  for (const p of parts) {
    v.set(p, n);
    n += p.length;
  }
  return v;
}
async function fixture(filter = 0, override?: Uint8Array, extra?: Uint8Array) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 2);
  view.setUint32(4, 2);
  header[8] = 8;
  header[9] = 2;
  const rows = [
      new Uint8Array([10, 20, 30, 40, 50, 60]),
      new Uint8Array([20, 30, 40, 50, 60, 70]),
    ],
    raw = new Uint8Array(14);
  for (let y = 0; y < 2; y++) {
    raw[y * 7] = filter;
    for (let x = 0; x < 6; x++) {
      const a = x >= 3 ? rows[y][x - 3] : 0,
        b = y ? rows[y - 1][x] : 0,
        c = y && x >= 3 ? rows[y - 1][x - 3] : 0;
      const p = a + b - c,
        ds = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      const paeth = ds[0] <= ds[1] && ds[0] <= ds[2]
        ? a
        : ds[1] <= ds[2]
        ? b
        : c;
      const predictor = filter === 0
        ? 0
        : filter === 1
        ? a
        : filter === 2
        ? b
        : filter === 3
        ? Math.floor((a + b) / 2)
        : paeth;
      raw[y * 7 + 1 + x] = (rows[y][x] - predictor) & 255;
    }
  }
  const compressed = new Uint8Array(
    await new Response(
      new Blob([new Uint8Array(override ?? raw)]).stream().pipeThrough(
        new CompressionStream("deflate"),
      ),
    ).arrayBuffer(),
  );
  return join([
    sig,
    pngChunk("IHDR", header),
    ...(extra ? [extra] : []),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  ]);
}
Deno.test("all PNG row filters preserve identical pixels after canonical re-encoding", async () => {
  const expected = base64(await canonicalLibraryPng(await fixture(0)));
  for (let f = 1; f <= 4; f++) {
    assertEquals(base64(await canonicalLibraryPng(await fixture(f))), expected);
  }
});
Deno.test("rejects CRC corruption and truncation", async () => {
  const p = await fixture();
  p[45] ^= 1;
  await assertRejects(() => canonicalLibraryPng(p));
  await assertRejects(async () =>
    canonicalLibraryPng((await fixture()).slice(0, -1))
  );
});
Deno.test("bounds inflated data and requires exact scanline length", async () => {
  await assertRejects(async () =>
    canonicalLibraryPng(await fixture(0, new Uint8Array(100000)))
  );
  await assertRejects(async () =>
    canonicalLibraryPng(await fixture(0, new Uint8Array(13)))
  );
});
Deno.test("rejects profiles, unknown metadata, invalid filters and gamma", async () => {
  await assertRejects(async () =>
    canonicalLibraryPng(
      await fixture(0, undefined, pngChunk("iCCP", new Uint8Array([0]))),
    )
  );
  await assertRejects(async () =>
    canonicalLibraryPng(
      await fixture(
        0,
        undefined,
        pngChunk("gAMA", new Uint8Array([0, 0, 0, 1])),
      ),
    )
  );
  const raw = new Uint8Array(14);
  raw[0] = 5;
  await assertRejects(async () => canonicalLibraryPng(await fixture(0, raw)));
});
Deno.test("canonical output strips ancillary source metadata and is stable", async () => {
  const p = await canonicalLibraryPng(
    await fixture(0, undefined, pngChunk("pHYs", new Uint8Array(9))),
  );
  assertEquals(base64(await canonicalLibraryPng(p)), base64(p));
});
export { fixture };

// CC0 sRGB-v4.icc: https://github.com/saucecontrol/Compact-ICC-Profiles
const srgbProfile = Uint8Array.from(
  atob(
    "AAAB4GxjbXMEIAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5keem/Vlo+AbaDI4VVRvdPqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAkY3BydAAAASAAAAAid3RwdAAAAUQAAAAUY2hhZAAAAVgAAAAsclhZWgAAAYQAAAAUZ1hZWgAAAZgAAAAUYlhZWgAAAawAAAAUclRSQwAAAcAAAAAgZ1RSQwAAAcAAAAAgYlRSQwAAAcAAAAAgbWx1YwAAAAAAAAABAAAADGVuVVMAAAAIAAAAHABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAGAAAAHABDAEMAMAAAWFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDD8AAAXd///zJgAAB5AAAP2S///7of///aIAAAPcAADAcVhZWiAAAAAAAABvoAAAOPIAAAOPWFlaIAAAAAAAAGKWAAC3iQAAGNpYWVogAAAAAAAAJKAAAA+FAAC2xHBhcmEAAAAAAAMAAAACZmkAAPKnAAANWQAAE9AAAApb",
  ),
  (c) => c.charCodeAt(0),
);

async function iccChunk(profile: Uint8Array) {
  const compressed = new Uint8Array(
    await new Response(
      new Blob([new Uint8Array(profile)]).stream().pipeThrough(
        new CompressionStream("deflate"),
      ),
    ).arrayBuffer(),
  );
  return pngChunk(
    "iCCP",
    join([
      new TextEncoder().encode("sRGB"),
      new Uint8Array([0, 0]),
      compressed,
    ]),
  );
}
Deno.test("pinned pilot sRGB ICC preserves pixel values and emits canonical sRGB", async () => {
  const expected = await canonicalLibraryPng(await fixture());
  assertEquals(
    await canonicalLibraryPng(
      await fixture(0, undefined, await iccChunk(srgbProfile)),
    ),
    expected,
  );
});
Deno.test("rejects unrecognized, oversized, duplicate and conflicting ICC profiles", async () => {
  const altered = srgbProfile.slice();
  altered[100] ^= 1;
  for (const profile of [altered, new Uint8Array(100000)]) {
    await assertRejects(async () =>
      canonicalLibraryPng(await fixture(0, undefined, await iccChunk(profile)))
    );
  }
  const valid = await iccChunk(srgbProfile);
  for (
    const extra of [
      join([valid, valid]),
      join([valid, pngChunk("sRGB", new Uint8Array([0]))]),
      join([pngChunk("sRGB", new Uint8Array([0])), valid]),
    ]
  ) {
    await assertRejects(async () =>
      canonicalLibraryPng(await fixture(0, undefined, extra))
    );
  }
});
