import {
  libraryFileSchema,
  libraryPendingSchema,
  libraryReviewSchema,
  type LibraryCommand,
  type LibraryPending,
  type Json,
} from "@gina/core";
import { supabase } from "./supabase";
const database = "gina-library-editor-v1";
let generation = 0;
let clearing: Promise<void> = Promise.resolve();
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pending");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error("library_storage"));
    request.onblocked = () => reject(Error("library_storage"));
  });
}
export function clearLibraryCommands() {
  generation++;
  clearing = clearing
    .catch(() => {})
    .then(async () => {
      const db = await openStore();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("pending", "readwrite");
          tx.objectStore("pending").clear();
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(Error("library_storage"));
        });
      } finally {
        db.close();
      }
    });
  return clearing;
}
export function createLibraryQueue<T extends { request: string }>(
  user: string,
  scope: string,
  parse: (value: unknown) => T,
) {
  const key = scope === "review" ? user : user + ":" + scope;
  const active = generation;
  async function operate(
    mode: "read" | "prepare" | "ack",
    next?: T,
    id?: string,
  ): Promise<T | null> {
    await clearing;
    if (active !== generation) throw Error("library_session_changed");
    const db = await openStore();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(
            "pending",
            mode === "read" ? "readonly" : "readwrite",
          ),
          store = tx.objectStore("pending");
        let result: T | null = null,
          failure: unknown;
        const get = store.get(key);
        get.onsuccess = () => {
          try {
            if (active !== generation) throw Error("library_session_changed");
            result = get.result == null ? null : parse(get.result);
            if (mode === "prepare") {
              if (result && JSON.stringify(result) !== JSON.stringify(next))
                throw Error("library_pending_exists");
              result = result ?? parse(next);
              store.put(result, key);
            } else if (mode === "ack" && result?.request === id) {
              store.delete(key);
              result = null;
            }
          } catch (e) {
            failure = e;
            tx.abort();
          }
        };
        tx.oncomplete = () =>
          active === generation
            ? resolve(result)
            : reject(Error("library_session_changed"));
        tx.onerror = tx.onabort = () =>
          reject(failure ?? Error("library_storage"));
      });
    } finally {
      db.close();
    }
  }
  return {
    restore: () => operate("read"),
    prepare: (next: T) => operate("prepare", next),
    acknowledge: (request: string) => operate("ack", undefined, request),
  };
}
export function createLibraryOutbox(user: string) {
  const queue = createLibraryQueue<LibraryPending>(user, "review", (v) =>
    libraryPendingSchema.parse(v),
  );
  return {
    ...queue,
    prepare: (payload: LibraryCommand) =>
      queue.prepare(
        libraryPendingSchema.parse({
          request:
            payload.action === "import"
              ? payload.file.p_request_id
              : crypto.randomUUID(),
          payload,
        }),
      ),
  };
}
export async function readLibraryFile(file: File) {
  if (file.size > 6000000) throw Error("library_file_size");
  const parsed = libraryFileSchema.parse(JSON.parse(await file.text()));
  let bytesTotal = 0,
    pixelsTotal = 0;
  for (const a of parsed.p_bundle.assets) {
    const binary = atob(a.base64),
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    if (btoa(binary) !== a.base64 || bytes.length < 57 || bytes.length > 524288)
      throw Error("library_file_image");
    const header = new DataView(bytes.buffer);
    if (
      [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v) ||
      header.getUint32(16) !== a.width ||
      header.getUint32(20) !== a.height
    )
      throw Error("library_file_image");
    bytesTotal += bytes.length;
    pixelsTotal += a.width * a.height;
    if (
      a.width * a.height > 4000000 ||
      pixelsTotal > 24000000 ||
      bytesTotal > 3000000
    )
      throw Error("library_file_size");
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== a.sha256) throw Error("library_file_image");
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth !== a.width || image.naturalHeight !== a.height)
        throw Error("library_file_image");
    } catch {
      throw Error("library_file_image");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return parsed;
}
export async function sendLibraryCommand(p: LibraryPending) {
  const c = p.payload,
    abort = new AbortController(),
    timeout = setTimeout(() => abort.abort(), 25000);
  try {
    const call =
      c.action === "import"
        ? supabase().rpc("admin_import_library_bundle", {
            p_request_id: p.request,
            p_bundle: c.file.p_bundle as Json,
          })
        : supabase().rpc("admin_review_library_question", {
            p_request_id: p.request,
            p_package_id: c.package_id,
            p_question_key: c.question_key,
            p_question_revision: c.question_revision,
            p_expected_review_revision: c.expected_review_revision,
            p_outcome: c.outcome,
            p_note: c.note,
          });
    const { data, error } = await call.abortSignal(abort.signal);
    if (error) throw error;
    if (c.action === "review") {
      const result = libraryReviewSchema.parse(data);
      if (
        result.request_id !== p.request ||
        result.package_id !== c.package_id ||
        result.question_key !== c.question_key ||
        result.question_revision !== c.question_revision ||
        result.review_revision !== c.expected_review_revision + 1 ||
        result.outcome !== c.outcome ||
        result.note !== c.note
      )
        throw Error("library_receipt_invalid");
      return { id: result.package_id, review: result };
    }
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.id !== "string" ||
      data.status !== "draft" ||
      data.revision !== c.file.p_bundle.revision ||
      typeof data.content_hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(data.content_hash)
    )
      throw Error("library_receipt_invalid");
    return { id: data.id };
  } finally {
    clearTimeout(timeout);
  }
}
export function libraryError(e: unknown) {
  const code = (e as { message?: string })?.message ?? "";
  if (code === "library_review_changed")
    return "Bu sorunun incelemesi başka bir yönetici tarafından değiştirildi. Notun korundu; güncel kaydı açıp karşılaştır.";
  if (
    code === "library_import_previous_changed" ||
    code === "library_import_revision_conflict"
  )
    return "Bu paketin sürümü değişmiş. Güncel paketi açıp doğru sürümle yeniden hazırla.";
  if (code === "library_file_size")
    return "Dosya veya görseller izin verilen boyutu aşıyor. Daha küçük bir soru paketi hazırla.";
  if (code === "library_file_image")
    return "Bir görselin içeriği veya ölçüsü doğrulanamadı. Paketi kaynak dosyalardan yeniden hazırla.";
  if (code === "forbidden")
    return "Bu işlem için yönetici yetkin bulunmuyor. Çalışma alanı kapatıldı.";
  if (code.startsWith("library_storage") || code === "library_pending_exists")
    return "Gönderim güvenli biçimde cihazda saklanamadı veya başka sekmede bekleyen bir işlem var. Sayfayı yenileyip kayıt durumunu kontrol et.";
  if (code.startsWith("library_") || code === "question_incomplete")
    return "Paket veya inceleme alanları doğrulanamadı. Kaynak, sürüm ve puan ölçütlerini kontrol et.";
  return "İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.";
}
