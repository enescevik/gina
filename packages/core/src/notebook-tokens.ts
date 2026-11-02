/** Copy only values explicitly written in the source, never inferred diagram labels. */
export function notebookTokens(text: string): string[] {
  return Array.from(
    new Set(
      text.match(
        /\|[^|\n]{1,16}\|(?:\s*=\s*\d+(?:[.,]\d+)?(?:\s*(?:km|cm|mm|m)(?![\p{L}\p{N}]))?)?|\d+(?:[.,]\d+)?\s*(?:cm²|m²|km|cm|mm|kg|m|°|derece)(?![\p{L}\p{N}])|[∠Δ√π][A-Z\d]*/gu,
      ) ?? [],
    ),
  ).slice(0, 16);
}
