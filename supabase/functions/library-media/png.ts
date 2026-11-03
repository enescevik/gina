// Deliberately narrow decoder: static, non-interlaced RGB/RGBA 8-bit PNG only.
// Reject unsupported color profiles instead of silently changing their colors.
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function fail(): never {
  throw Error("library_media_invalid");
}
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    result.set(p, i);
    i += p.length;
  }
  return result;
}
export function pngChunk(kind: string, data: Uint8Array) {
  const type = new TextEncoder().encode(kind),
    out = new Uint8Array(data.length + 12),
    v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(type, 4);
  out.set(data, 8);
  v.setUint32(data.length + 8, crc32(out.subarray(4, data.length + 8)));
  return out;
}
async function bounded(stream: ReadableStream<Uint8Array>, limit: number) {
  const reader = stream.getReader();
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        fail();
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concat(parts);
}
function paeth(a: number, b: number, c: number) {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
export async function canonicalLibraryPng(
  input: Uint8Array,
): Promise<Uint8Array> {
  if (
    input.length < 57 || input.length > 524288 ||
    signature.some((v, i) => input[i] !== v)
  ) fail();
  let offset = 8,
    header: Uint8Array | null = null,
    width = 0,
    height = 0,
    channels = 0,
    ended = false,
    seenData = false,
    dataEnded = false;
  const ids: Uint8Array[] = [], seen = new Set<string>();
  while (offset < input.length) {
    if (offset + 12 > input.length) fail();
    const view = new DataView(
        input.buffer,
        input.byteOffset + offset,
        input.length - offset,
      ),
      n = view.getUint32(0);
    if (n > 524288 || offset + n + 12 > input.length) fail();
    const kind = new TextDecoder().decode(
        input.subarray(offset + 4, offset + 8),
      ),
      data = input.subarray(offset + 8, offset + 8 + n);
    if (
      crc32(input.subarray(offset + 4, offset + 8 + n)) !==
        view.getUint32(n + 8)
    ) fail();
    if (
      !["IHDR", "IDAT", "IEND", "sRGB", "gAMA", "pHYs", "PLTE", "iCCP"]
        .includes(kind)
    ) fail();
    if (kind !== "IDAT" && seen.has(kind)) fail();
    seen.add(kind);
    if (!header && kind !== "IHDR") fail();
    if (kind === "IHDR") {
      if (offset !== 8 || n !== 13) fail();
      header = data.slice();
      const hv = new DataView(header.buffer);
      width = hv.getUint32(0);
      height = hv.getUint32(4);
      channels = data[9] === 2 ? 3 : data[9] === 6 ? 4 : 0;
      if (
        width < 1 || height < 1 || width > 4096 || height > 4096 ||
        width * height > 4000000 || data[8] !== 8 || !channels ||
        data[10] !== 0 || data[11] !== 0 || data[12] !== 0
      ) fail();
    } else if (kind === "IDAT") {
      if (dataEnded) fail();
      seenData = true;
      ids.push(data);
    } else if (kind === "IEND") {
      if (n !== 0 || !seenData || offset + n + 12 !== input.length) fail();
      ended = true;
    } else {
      if (seenData) {
        dataEnded = true;
        fail();
      }
      if (kind === "sRGB" && (n !== 1 || data[0] > 3 || seen.has("iCCP"))) {
        fail();
      }
      if (kind === "iCCP") {
        // Recognize only the pinned CC0 compact sRGB profile used by our pilot.
        // Unknown RGB profiles must be color-converted by a separate pipeline.
        const end = data.indexOf(0);
        if (
          end < 1 || end > 79 || end + 2 >= n || data[end + 1] !== 0 ||
          seen.has("sRGB")
        ) fail();
        let profile: Uint8Array;
        try {
          profile = await bounded(
            new Blob([data.slice(end + 2)]).stream().pipeThrough(
              new DecompressionStream("deflate"),
            ),
            480,
          );
        } catch {
          fail();
        }
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", new Uint8Array(profile)),
          ),
          (v) => v.toString(16).padStart(2, "0"),
        ).join("");
        if (
          hash !==
            "c56e1685d888f5edb92fe07f2750f387f8fe8e91b32ff8fb0b56bfbbb9458353"
        ) fail();
      }
      if (
        kind === "gAMA" &&
        (n !== 4 ||
          new DataView(data.buffer, data.byteOffset, 4).getUint32(0) !== 45455)
      ) fail();
      if (kind === "pHYs" && (n !== 9 || data[8] > 1)) fail();
      if (kind === "PLTE" && (n === 0 || n > 768 || n % 3 !== 0)) fail();
    }
    offset += n + 12;
  }
  if (!ended || !header) fail();
  const stride = width * channels, size = (stride + 1) * height;
  let raw: Uint8Array;
  try {
    raw = await bounded(
      new Blob([concat(ids)]).stream().pipeThrough(
        new DecompressionStream("deflate"),
      ),
      size,
    );
  } catch {
    fail();
  }
  if (raw.length !== size) fail();
  const output = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1), filter = raw[row];
    if (filter > 4) fail();
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? output[row + 1 + x - channels] : 0,
        b = y > 0 ? output[row - stride + x] : 0,
        c = y > 0 && x >= channels ? output[row - stride + x - channels] : 0;
      const predictor = filter === 0
        ? 0
        : filter === 1
        ? a
        : filter === 2
        ? b
        : filter === 3
        ? Math.floor((a + b) / 2)
        : paeth(a, b, c);
      output[row + 1 + x] = (raw[row + 1 + x] + predictor) & 255;
    }
  }
  const compressed = await bounded(
    new Blob([output]).stream().pipeThrough(new CompressionStream("deflate")),
    524288 - 70,
  );
  return concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("sRGB", new Uint8Array([0])),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  ]);
}
export function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}
