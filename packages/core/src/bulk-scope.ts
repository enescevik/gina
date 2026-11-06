import type { BulkArchivePreview, BulkArchivePreviewItem } from "./bulk-archive";

// C03/L02: takvim, Prova taslağı, çalışma planı ve çanta seçimleri mevcut bulk_archive_* sözleşmesini kullanır.
// Sunucu önizlemesi tür başına en çok 300 kayıt listeler; bir uygulama en çok 200 kayıt alır.
export const BULK_PREVIEW_LIMIT = 300;
export const BULK_APPLY_LIMIT = 200;

/** Önizlemede seçilebilir (arşivlenebilir veya geri alınabilir) satırlar. */
export function bulkSelectableRows(preview: BulkArchivePreview | null, mode: "archive" | "restore"): BulkArchivePreviewItem[] {
  return (preview?.items ?? []).filter((row) =>
    mode === "archive" ? !row.blocked && !row.archived : row.archived && row.type !== "school_bag"
  );
}

/**
 * Seçim özeti: "tümü" yalnız önizleme kesilmediyse gerçekten tümdür. Kesilmişse yalnız listelenen kayıtlar seçilir
 * ve ekran bunu açıkça söyler; uygulama sınırını aşan seçim gönderilmez.
 */
export function bulkSelectionState(input: {
  preview: BulkArchivePreview | null;
  mode: "archive" | "restore";
  selected: number;
}): { listed: number; selectable: number; truncated: boolean; overApplyLimit: boolean; allListedPicked: boolean } {
  const selectable = bulkSelectableRows(input.preview, input.mode).length;
  return {
    listed: input.preview?.items.length ?? 0,
    selectable,
    truncated: !!input.preview?.truncated,
    overApplyLimit: input.selected > BULK_APPLY_LIMIT,
    allListedPicked: selectable > 0 && input.selected === selectable,
  };
}
