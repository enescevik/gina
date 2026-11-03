import {
  libraryPublishCommandSchema,
  libraryPublicationSchema,
  type LibraryPublishCommand,
} from "@gina/core";
import { createLibraryQueue } from "./library-review";
import { supabase } from "./supabase";
export const publicationQueue = (user: string) =>
  createLibraryQueue<LibraryPublishCommand>(user, "publication", (v) =>
    libraryPublishCommandSchema.parse(v),
  );
export async function sendPublication(c: LibraryPublishCommand) {
  const { data, error } = await supabase()
    .rpc("admin_set_library_publication", {
      p_request_id: c.request,
      p_package_id: c.package_id,
      p_expected_version: c.expected_version,
      p_review_fingerprint: c.review_fingerprint,
      p_title: c.title,
      p_description: c.description,
      p_plans: c.plans,
      p_curriculum_label: c.curriculum_label,
      p_confirmed: c.confirmed,
      p_status: c.status,
      p_reason: c.reason,
    })
    .abortSignal(AbortSignal.timeout(25000));
  if (error) throw error;
  const result = libraryPublicationSchema.parse(data);
  if (
    result.package_id !== c.package_id ||
    result.version !== c.expected_version + 1 ||
    result.title !== c.title ||
    result.description !== c.description.trim() ||
    result.curriculum_label !== c.curriculum_label ||
    JSON.stringify(result.plans) !== JSON.stringify(c.plans) ||
    result.status !== c.status ||
    (c.status === "published" &&
      result.review_fingerprint !== c.review_fingerprint)
  )
    throw Error("library_receipt_invalid");
  return result;
}
export function publicationError(e: unknown) {
  const key = (e as { message?: string })?.message;
  if (key === "library_publication_changed")
    return "Yayın ayarları başka bir yönetici tarafından değiştirildi. Yazdıkların korundu; güncel kayıtla karşılaştır.";
  if (key === "library_publication_review_changed")
    return "Soru incelemeleri değişti. Güncel kontrolleri açıp tekrar değerlendir.";
  if (key === "library_publication_review_required")
    return "Bütün sorular uygun bulunmadan bu paket yayımlanamaz. İncelemeye dön.";
  if (
    key === "library_publication_media_required" ||
    key === "library_media_invalid"
  )
    return "Görseller doğrulanamadı. Kaynak dosyaları kontrol et; henüz yayın yapılmadı.";
  return "İşlem tamamlanamadı. Bağlantıyı ve yayın kontrollerini yeniden kontrol et.";
}
