/** Only values explicitly present in the question text; never infer diagram labels. */
export function notebookTokens(stem: string): string[] {
  return Array.from(
    new Set(
      stem.match(
        /\|[^|\n]{1,16}\|(?:\s*=\s*\d+(?:[.,]\d+)?(?:\s*(?:cm|mm|m|km))?)?|\d+(?:[.,]\d+)?\s*(?:°|derece|cm|mm|km|kg|m²|cm²)|[∠Δ√π][A-Z\d]*/g,
      ) ?? [],
    ),
  ).slice(0, 16);
}
