import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "./supabase";
import { sourceAction } from "./learning-files";
import i18n from "./i18n";
import { Platform } from "react-native";

/** Kitapçık (PDF) için HTML üretir ve yazdırır/paylaşır. Tüm metinler kaçışlanır; sayfa A4. */

import type { BookletQuestion } from "@gina/core";
export { buildBookletHtml, escapeHtml } from "@gina/core";
export type {
  BookletChoice,
  BookletLabels,
  BookletOptions,
  BookletQuestion,
} from "@gina/core";

/**
 * Yerelde PDF'e çevirip paylaşım sayfasını açar; webde tarayıcı yazdırma penceresini açar
 * (expo-print web'de yalnız window.print çağırdığı için HTML gizli bir iframe'e yazılır).
 */
export async function printBooklet(
  html: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === "web") {
    const doc = globalThis.document;
    const frame = doc.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    doc.body.appendChild(frame);
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      await Print.printAsync({ html });
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    await Promise.all(
      Array.from(win.document.images).map((image) => image.decode()),
    );
    await win.document.fonts.ready;
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
    return;
  }
  // A4: 595 × 842 pt.
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle,
    });
  } else {
    await Print.printAsync({ uri });
  }
}

/** Embed bytes, not short-lived URLs: exported PDFs remain self-contained. */
export async function attachBookletImages(
  questions: BookletQuestion[],
): Promise<BookletQuestion[]> {
  const ids = questions.map((q) => q.id);
  const [mediaResult, contextResult] = await Promise.all([
    supabase.rpc("get_question_media", { p_question_ids: ids }),
    supabase.rpc("get_question_context", { p_question_ids: ids }),
  ]);
  if (mediaResult.error || contextResult.error) {
    throw mediaResult.error ?? contextResult.error;
  }
  const media = mediaResult.data as unknown as {
    question_id: string;
    source_id: string;
    alt: string;
  }[];
  const contexts = contextResult
    .data as unknown as (NonNullable<BookletQuestion["context"]> & {
      question_id: string;
    })[];
  const result = questions.map((q) => ({
    ...q,
    context: contexts.find((c) => c.question_id === q.id),
    images: [] as { dataUri: string; alt: string }[],
  }));
  const embedded = new Map<string, string>();
  let total = 0;
  for (const m of media) {
    let dataUri = embedded.get(m.source_id);
    if (!dataUri) {
      const signed = await sourceAction<{ url: string; mime: string }>({
        action: "view",
        id: m.source_id,
        question_id: m.question_id,
      });
      const response = await fetch(signed.url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(i18n.t("sources.imageFailed"));
      const bytes = new Uint8Array(await response.arrayBuffer());
      total += bytes.length;
      if (total > 12 * 1024 * 1024) {
        throw new Error(i18n.t("sources.bookletTooLarge"));
      }
      if (!["image/png", "image/jpeg"].includes(signed.mime)) {
        throw new Error(i18n.t("sources.imageFailed"));
      }
      let binary = "";
      for (let at = 0; at < bytes.length; at += 8192) {
        binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
      }
      dataUri = `data:${signed.mime};base64,${btoa(binary)}`;
      embedded.set(m.source_id, dataUri);
    }
    result.find((q) => q.id === m.question_id)?.images.push({
      dataUri,
      alt: m.alt,
    });
  }
  return result;
}
